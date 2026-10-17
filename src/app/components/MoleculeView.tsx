/**
 * Renders a Nanquim drawing as native SVG elements, so structures inherit the page's
 * colour, scale crisply and can be tapped atom by atom.
 */
import { type CSSProperties, type KeyboardEvent, memo, useMemo } from 'react';
import { type Drawing, type FormulaKind, type Molecule, STYLES, depict, moleculeFromSmiles } from '../../nanquim/index.ts';

export type AtomMark = 'selected' | 'correct' | 'wrong' | 'missed';

export interface MoleculeViewProps {
  smiles: string;
  formula?: FormulaKind;
  /** Bond length in px; the drawing never scales above it, only shrinks to fit. */
  size?: number;
  highlight?: number[];
  aromaticCircles?: boolean;
  colored?: boolean;
  journal?: boolean;
  /** Draw the bonds in, one after another, like ink. */
  animate?: boolean;
  /** Atoms that respond to taps. */
  tappable?: number[];
  marks?: Record<number, AtomMark>;
  onAtomTap?: (atom: number) => void;
  title?: string;
  className?: string;
}

const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif";

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

/** Order bonds by a walk through the molecule so the ink flows along the chain. */
function inkOrder(d: Drawing): Map<number, number> {
  const mol = d.molecule;
  const rank = new Map<number, number>();
  const seen = new Set<number>();
  const start = d.atoms.reduce((best, a) => (a.x < d.atoms[best].x ? a.index : best), 0);
  const queue = [start];
  seen.add(start);
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
  highlight,
  aromaticCircles,
  colored,
  journal,
  animate,
  tappable,
  marks,
  onAtomTap,
  title,
  className,
}: MoleculeViewProps) {
  const drawing = useMemo(() => {
    const base = journal ? STYLES.acs : STYLES.textbook;
    return depict(smiles, {
      formula,
      aromaticCircles,
      style: {
        ...base,
        bondLength: size,
        fontFamily: FONT,
        palette: colored ? 'color' : 'mono',
        padding: 0.45,
      },
      // Colour comes from CSS (.mol-highlight); the value here is only a fallback.
      highlights: highlight?.length ? [{ atoms: highlight, bonds: groupBonds(smiles, highlight), color: 'currentColor' }] : [],
    });
  }, [smiles, formula, size, highlight, aromaticCircles, colored, journal]);
  const order = useMemo(() => (animate ? inkOrder(drawing) : undefined), [drawing, animate]);
  const { viewBox: vb } = drawing;
  const L = drawing.style.bondLength;
  const totalSteps = order ? Math.max(1, order.size) : 1;
  const delay = (bond?: number) => ({ '--i': bond === undefined ? totalSteps : (order?.get(bond) ?? 0) }) as CSSProperties;

  const tapSet = new Set(tappable ?? []);
  const onKey = (e: KeyboardEvent, atom: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onAtomTap?.(atom);
    }
  };

  return (
    <svg
      className={`mol${animate ? ' mol--animate' : ''}${className ? ` ${className}` : ''}`}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      width={vb.width}
      height={vb.height}
      role="img"
      aria-label={title ?? 'Estrutura química'}
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
          const a = drawing.atoms[Number(atom)];
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
      </g>
      {onAtomTap &&
        drawing.atoms
          .filter((a) => tapSet.has(a.index) && !a.labelled && !marks?.[a.index])
          .map((a) => <circle key={`d${a.index}`} className="mol-dot" cx={a.x} cy={a.y} r={L * 0.13} />)}
      {onAtomTap &&
        drawing.atoms
          .filter((a) => tapSet.has(a.index))
          .map((a) => {
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
                onClick={() => onAtomTap(a.index)}
                onKeyDown={(e) => onKey(e, a.index)}
              />
            );
          })}
    </svg>
  );
});

/** Bonds whose both ends are highlighted, so a group lights up as a whole. */
function groupBonds(smiles: string, atoms: number[]): number[] {
  const set = new Set(atoms);
  return parsed(smiles)
    .bonds.filter((b) => set.has(b.a) && set.has(b.b))
    .map((b) => b.index);
}

const parsedCache = new Map<string, Molecule>();
function parsed(smiles: string): Molecule {
  let m = parsedCache.get(smiles);
  if (!m) {
    m = moleculeFromSmiles(smiles);
    parsedCache.set(smiles, m);
  }
  return m;
}
