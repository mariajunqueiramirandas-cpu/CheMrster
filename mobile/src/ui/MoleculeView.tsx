/**
 * Renders a Nanquim drawing with react-native-svg, the way src/app/components/MoleculeView.tsx
 * does on the web: the ENEM booklets' look, atoms that respond to taps, and new structures
 * inked in bond by bond.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText, TSpan } from 'react-native-svg';
import { type Annotation, type Drawing, type FormulaKind, STYLES, depict } from '../../../src/nanquim/index.ts';
import { prefersReducedMotion } from '../lib/haptics.ts';
import { FONT, GUTTER } from '../theme.ts';

export type AtomMark = 'selected' | 'correct' | 'wrong' | 'missed';
export type MoleculeLook = 'enem' | 'textbook' | 'acs';

export interface MoleculeViewProps {
  smiles: string;
  formula?: FormulaKind;
  /** Bond length in px; the drawing never scales above it, only shrinks to fit. */
  size?: number;
  /** Widest the drawing may be; defaults to the screen less the page margins. */
  maxWidth?: number;
  look?: MoleculeLook;
  outline?: number[];
  annotations?: Annotation[];
  aromaticCircles?: boolean;
  colored?: boolean;
  caption?: string;
  source?: string;
  polymer?: boolean;
  /** Draw the bonds in, one after another, like ink. */
  animate?: boolean;
  tappable?: number[];
  marks?: Record<number, AtomMark>;
  onAtomTap?: (atom: number) => void;
  title?: string;
  /** Ink colour; molecules sit on white paper, so black by default. */
  color?: string;
}

const MARK: Record<AtomMark, { fill: string; stroke: string; dash?: string }> = {
  selected: { fill: 'rgba(192,21,122,0.16)', stroke: '#c0157a' },
  correct: { fill: 'rgba(23,120,74,0.16)', stroke: '#17784a' },
  wrong: { fill: 'rgba(194,48,42,0.16)', stroke: '#c2302a' },
  missed: { fill: 'none', stroke: '#17784a', dash: '4 4' },
};

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

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Labels are typeset with Helvetica metrics; Arimo has the same widths. */
const molFont = (weight: number) => (weight >= 600 ? FONT.molBold : FONT.mol);

export const MoleculeView = memo(function MoleculeView({
  smiles,
  formula = 'skeletal',
  size = 40,
  maxWidth,
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
  color = '#000',
}: MoleculeViewProps) {
  const window = useWindowDimensions();
  const drawing = useMemo(() => {
    const base = STYLES[look];
    const notes: Annotation[] = [...(annotations ?? []), ...(outline?.length ? [{ atoms: outline }] : [])];
    return depict(smiles, {
      formula,
      aromaticCircles,
      conventions: look === 'enem' ? 'enem' : 'textbook',
      style: { ...base, bondLength: size, fontFamily: FONT.mol, palette: colored ? 'color' : 'mono', padding: 0.45 },
      annotations: notes,
      caption,
      source,
      polymer,
    });
  }, [smiles, formula, size, look, outline, annotations, aromaticCircles, colored, caption, source, polymer]);

  const still = !animate || prefersReducedMotion();
  const order = useMemo(() => (still ? undefined : inkOrder(drawing)), [drawing, still]);
  const steps = order ? Math.max(1, order.size) : 1;
  // One clock for the whole drawing: bond i inks between i·pace and i·pace + 240ms.
  const clock = useRef(new Animated.Value(still ? 1 : 0)).current;
  const pace = Math.min(26, 640 / steps);
  const total = steps * pace + 260;
  useEffect(() => {
    if (still) return clock.setValue(1);
    clock.setValue(0);
    const run = Animated.timing(clock, { toValue: 1, duration: total, easing: Easing.linear, useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [drawing, still, clock, total]);
  const ink = (i: number, ms = 240) => {
    const from = Math.min(0.999, (i * pace) / total);
    const to = Math.min(1, from + ms / total);
    return clock.interpolate({ inputRange: [0, from, to, 1], outputRange: [0, 0, 1, 1] });
  };
  const fadeIn = ink(steps, 260);

  const { viewBox: vb } = drawing;
  const L = drawing.style.bondLength;
  const room = maxWidth ?? window.width - GUTTER * 2 - 24;
  const scale = Math.min(1, room / vb.width);
  const siteOf = new Map(drawing.atoms.filter((a) => a.index >= 0).map((a) => [a.index, a]));
  const tapSet = new Set(tappable ?? []);
  const targets = onAtomTap ? [...tapSet].map((i) => siteOf.get(i)).filter((a) => a !== undefined) : [];

  return (
    <Svg
      width={vb.width * scale}
      height={vb.height * scale}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      accessibilityRole="image"
      accessibilityLabel={title ?? caption ?? 'Estrutura química'}
    >
      {drawing.underlay.length > 0 && (
        <G opacity={0.55}>
          {drawing.underlay.map((p, k) =>
            p.type === 'line' ? (
              <Line key={k} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} strokeWidth={p.width} stroke="#f39bc9" strokeLinecap="round" />
            ) : p.type === 'circle' ? (
              <Circle key={k} cx={p.center.x} cy={p.center.y} r={p.r} fill="#f39bc9" />
            ) : null,
          )}
        </G>
      )}
      {marks &&
        Object.entries(marks).map(([atom, mark]) => {
          const a = siteOf.get(Number(atom));
          if (!a) return null;
          const m = MARK[mark];
          return <Circle key={`m${atom}`} cx={a.x} cy={a.y} r={L * 0.36} fill={m.fill} stroke={m.stroke} strokeWidth={2.5} strokeDasharray={m.dash} />;
        })}
      <G stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {drawing.primitives.map((p, k) => {
          if (p.type === 'line') {
            if (!order) return <Line key={k} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} strokeWidth={p.width} />;
            const len = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y) || 1;
            const t = ink(p.bond === undefined ? steps : (order.get(p.bond) ?? 0));
            return (
              <AnimatedLine
                key={k}
                x1={p.a.x}
                y1={p.a.y}
                x2={p.b.x}
                y2={p.b.y}
                strokeWidth={p.width}
                strokeDasharray={[len, len]}
                strokeDashoffset={t.interpolate({ inputRange: [0, 1], outputRange: [len, 0] })}
              />
            );
          }
          if (p.type === 'polygon') {
            const shape = <Polygon points={p.points.map((q) => `${q.x},${q.y}`).join(' ')} fill={color} strokeWidth={0.4} />;
            return order ? (
              <AnimatedG key={k} opacity={ink(p.bond === undefined ? steps : (order.get(p.bond) ?? 0), 260)}>
                {shape}
              </AnimatedG>
            ) : (
              <G key={k}>{shape}</G>
            );
          }
          return <Circle key={k} cx={p.center.x} cy={p.center.y} r={p.r} strokeWidth={p.width} />;
        })}
      </G>
      <AnimatedG opacity={order ? fadeIn : 1}>
        {drawing.outlines.map((o, k) => (
          <Path
            key={k}
            d={o.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('') + 'Z'}
            fill="none"
            stroke="#c0157a"
            strokeWidth={o.width * 1.3}
            strokeDasharray={`${o.dash[0]} ${o.dash[1]}`}
            strokeLinecap="round"
          />
        ))}
        {drawing.labels.map((label) => (
          <SvgText
            key={label.atom}
            fill={label.color === 'currentColor' ? color : label.color}
            fontFamily={molFont(drawing.style.fontWeight)}
          >
            {label.runs.map((r, k) => (
              <TSpan key={k} x={r.x} y={r.y} fontSize={r.size}>
                {r.text}
              </TSpan>
            ))}
          </SvgText>
        ))}
        {drawing.texts.map((t, k) => (
          <SvgText key={`t${k}`} x={t.x} y={t.y} fontSize={t.size} fontFamily={molFont(t.weight)} textAnchor={t.anchor} fill={color}>
            {t.text}
          </SvgText>
        ))}
      </AnimatedG>
      {targets
        .filter((a) => !a.labelled && !marks?.[a.index])
        .map((a) => (
          <Circle key={`d${a.index}`} cx={a.x} cy={a.y} r={L * 0.13} fill="#ffffff" stroke="#8a96a3" strokeWidth={2} />
        ))}
      {targets.map((a) => (
        <Circle
          key={`t${a.index}`}
          cx={a.x}
          cy={a.y}
          // Fingers are bigger than the circle the web uses; never under 24px on screen.
          r={Math.max(L * 0.48, 24 / scale / 2)}
          fill="rgba(0,0,0,0.001)"
          onPress={() => onAtomTap?.(a.index)}
          accessible
          accessibilityLabel={`${ATOM_NAMES[a.element] ?? a.element} ${a.index + 1}`}
        />
      ))}
    </Svg>
  );
});
