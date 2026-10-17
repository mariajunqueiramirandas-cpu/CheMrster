/**
 * Renders a Nanquim drawing as native SVG elements, so structures inherit the page's
 * colour, scale crisply and can be tapped atom by atom. By default structures follow
 * the look of the printed ENEM booklets.
 */
import { type CSSProperties, type KeyboardEvent, memo, useMemo } from 'react';
import { type Annotation, type Drawing, type FormulaKind, STYLES, depict } from '../../nanquim/index.ts';

export type AtomMark = 'selected' | 'correct' | 'wrong' | 'missed';
export type MoleculeLook = 'enem' | 'textbook' | 'acs';

export interface MoleculeViewProps {
  smiles: string;
  formula?: FormulaKind;
  /** Bond length in px; the drawing never scales above it, only shrinks to fit. */
  size?: number;
  /** 'enem' (default): the booklets' strokes, type and drawing conventions. */
  look?: MoleculeLook;
  /** Atoms to point out with a dashed outline, as the booklets do. */
  outline?: number[];
  annotations?: Annotation[];
  aromaticCircles?: boolean;
  colored?: boolean;
  /** Bold name under the structure (and an optional source line). */
  caption?: string;
  source?: string;
  /** A repeat unit: its two `*` atoms are open ends, drawn crossing brackets with n. */
  polymer?: boolean;
  /** Draw the bonds in, one after another, like ink. */
  animate?: boolean;
  /** Atoms (of the parsed SMILES) that respond to taps. */
  tappable?: number[];
  marks?: Record<number, AtomMark>;
  onAtomTap?: (atom: number) => void;
  title?: string;
  className?: string;
}

/** Arimo is metric-identical to Arial and is loaded as a web font, so every device matches. */
const FONT = "Arimo, Arial, 'Liberation Sans', Helvetica, sans-serif";

const ATOM_NAMES: Record<string, string> = {
  C: 'carbono',
  O: 'oxigênio',
  N: 'nitrogênio',
  S: 'enxofre',
  Cl: 'cloro',
  Br: 'bromo',
  F: 'flúor',
  I: 'iodo',
  P: 'fósforo',
};

/** Order bonds by a walk through the drawn molecule so the ink flows along the chain. */
function inkOrder(d: Drawing): Map<number, number> {
  const mol = d.molecule;
  const rank = new Map<number, number>();
  if (!mol.atoms.length) return rank;
  const start = d.atoms.reduce((best, a, i) => (a.x < d.atoms[best].x ? i : best), 0);
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const bi of mol.adjacency[queue[i]] ?? []) {
      if (!rank.has(bi)) rank.set(bi, rank.size);
      const next = mol.other(bi, queue[i]);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
    if (i === queue.length - 1 && seen.size < mol.atoms.length) {
      const rest = mol.atoms.find((a) => !seen.has(a.index));
      if (rest) {
        seen.add(rest.index);
        queue.push(rest.index);
      }
    }
  }
  return rank;
}

export const MoleculeView = memo(function MoleculeView({
  smiles,
  formula = 'skeletal',
  size = 40,
  look = 'enem',
  outline,
  annotations,
  aromaticCircles,
  colored,
  caption,
  source,
  polymer,
  animate,
  tappable,
  marks,
  onAtomTap,
  title,
  className,
}: MoleculeViewProps) {
  const drawing = useMemo(() => {
    const base = STYLES[look];
    const notes: Annotation[] = [...(annotations ?? []), ...(outline?.length ? [{ atoms: outline }] : [])];
    return depict(smiles, {
      formula,
      aromaticCircles,
      conventions: look === 'enem' ? 'enem' : 'textbook',
      style: {
        ...base,
        bondLength: size,
        fontFamily: FONT,
        palette: colored ? 'color' : 'mono',
        padding: 0.45,
      },
      annotations: notes,
      caption,
      source,
      polymer,
    });
  }, [smiles, formula, size, look, outline, annotations, aromaticCircles, colored, caption, source, polymer]);
  const order = useMemo(() => (animate ? inkOrder(drawing) : undefined), [drawing, animate]);
  const { viewBox: vb } = drawing;
  const L = drawing.style.bondLength;
  const totalSteps = order ? Math.max(1, order.size) : 1;
  const delay = (bond?: number) => ({ '--i': bond === undefined ? totalSteps : (order?.get(bond) ?? 0) }) as CSSProperties;
  // Exercises address atoms of the parsed SMILES; drawn atoms remember which one they are.
  const siteOf = new Map(drawing.atoms.filter((a) => a.index >= 0).map((a) => [a.index, a]));

  const tapSet = new Set(tappable ?? []);
  const onKey = (e: KeyboardEvent, atom: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAtomTap?.(atom);
    }
  };
  const targets = onAtomTap ? [...tapSet].map((i) => siteOf.get(i)).filter((a) => a !== undefined) : [];

  return (
    <svg
      className={`mol${animate ? ' mol--animate' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      width={vb.width}
      height={vb.height}
      role="img"
      aria-label={title ?? caption ?? 'Estrutura química'}
      style={{ '--steps': totalSteps } as CSSProperties}
    >
      {drawing.underlay.length > 0 && (
        <g className="mol-highlight">
          {drawing.underlay.map((p, k) =>
            p.type === 'line' ? (
              <line key={k} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} strokeWidth={p.width} />
            ) : p.type === 'circle' ? (
              <circle key={k} cx={p.center.x} cy={p.center.y} r={p.r} />
            ) : null,
          )}
        </g>
      )}
      {marks &&
        Object.entries(marks).map(([atom, mark]) => {
          const a = siteOf.get(Number(atom));
          if (!a) return null;
          return <circle key={`m${atom}`} className={`mol-mark mol-mark--${mark}`} cx={a.x} cy={a.y} r={L * 0.36} />;
        })}
      <g className="mol-ink" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {drawing.primitives.map((p, k) => {
          if (p.type === 'line') {
            return (
              <line
                key={k}
                x1={p.a.x}
                y1={p.a.y}
                x2={p.b.x}
                y2={p.b.y}
                strokeWidth={p.width}
                pathLength={1}
                className="mol-stroke"
                style={delay(p.bond)}
              />
            );
          }
          if (p.type === 'polygon') {
            return (
              <polygon
                key={k}
                points={p.points.map((q) => `${q.x},${q.y}`).join(' ')}
                fill="currentColor"
                strokeWidth={0.4}
                className="mol-fill"
                style={delay(p.bond)}
              />
            );
          }
          return <circle key={k} cx={p.center.x} cy={p.center.y} r={p.r} strokeWidth={p.width} className="mol-fill" style={delay()} />;
        })}
      </g>
      {drawing.outlines.length > 0 && (
        <g className="mol-outline mol-fill" fill="none" style={delay()}>
          {drawing.outlines.map((o, k) => (
            <path
              key={k}
              d={o.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z'}
              strokeWidth={o.width * 1.3}
              strokeDasharray={`${o.dash[0]} ${o.dash[1]}`}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}
      <g
        className="mol-labels"
        fontFamily={drawing.style.fontFamily}
        fontWeight={drawing.style.fontWeight}
        style={{ fontKerning: 'none', ...delay() }}
      >
        {drawing.labels.map((label) => (
          <text key={label.atom} fill={label.color === 'currentColor' ? 'currentColor' : label.color}>
            {label.runs.map((r, k) => (
              <tspan key={k} x={r.x} y={r.y} fontSize={r.size}>
                {r.text}
              </tspan>
            ))}
          </text>
        ))}
        {drawing.texts.map((t, k) => (
          <text
            key={`t${k}`}
            x={t.x}
            y={t.y}
            fontSize={t.size}
            fontWeight={t.weight}
            textAnchor={t.anchor}
            fill="currentColor"
          >
            {t.text}
          </text>
        ))}
      </g>
      {targets
        .filter((a) => !a.labelled && !marks?.[a.index])
        .map((a) => (
          <circle key={`d${a.index}`} className="mol-dot" cx={a.x} cy={a.y} r={L * 0.13} />
        ))}
      {targets.map((a) => {
        const name = ATOM_NAMES[a.element] ?? a.element;
        const mark = marks?.[a.index];
        return (
          <circle
            key={`t${a.index}`}
            className="mol-target"
            cx={a.x}
            cy={a.y}
            r={L * 0.48}
            role="button"
            tabIndex={0}
            aria-label={`${name} ${a.index + 1}`}
            aria-pressed={mark === 'selected'}
            onClick={() => onAtomTap?.(a.index)}
            onKeyDown={(e) => onKey(e, a.index)}
          />
        );
      })}
    </svg>
  );
});
