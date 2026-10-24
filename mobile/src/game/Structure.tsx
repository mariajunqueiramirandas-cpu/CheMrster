/**
 * An organic compound as the exam booklets print it: a Nanquim drawing (the engine the web app
 * draws with) in react-native-svg, condensed (H₃C–CH₂–OH) or skeletal (bastão).
 */
import { memo, useMemo } from 'react';
import Svg, { Circle, G, Line, Polygon, Text as SvgText, TSpan } from 'react-native-svg';
import { type Drawing, STYLES, depict } from '../../../src/nanquim/index.ts';
import { FONT } from '../theme.ts';

export type StructureKind = 'condensed' | 'skeletal';

const draw = (smiles: string, kind: StructureKind, size: number): Drawing =>
  depict(smiles, {
    formula: kind,
    conventions: 'enem',
    style: { ...STYLES.enem, bondLength: size, fontFamily: FONT.mol, palette: 'mono', padding: 0.3 },
  });

/** Condensed, unless it would have to shrink below `shrink` to fit (long chains) or has a benzene ring: then skeletal. */
export function defaultKind(smiles: string, room: number, shrink = 0.6): StructureKind {
  if (/c/.test(smiles)) return 'skeletal';
  return room / draw(smiles, 'condensed', 40).viewBox.width < shrink ? 'skeletal' : 'condensed';
}

/** Labels are typeset with Helvetica metrics; Arimo has the same widths. */
const molFont = (weight: number) => (weight >= 600 ? FONT.molBold : FONT.mol);

export const Structure = memo(function Structure({
  smiles,
  kind,
  size = 40,
  maxWidth,
  maxHeight = Infinity,
  color = '#000',
  title,
}: {
  smiles: string;
  kind: StructureKind;
  /** Bond length in px; the drawing never grows past it, only shrinks to fit. */
  size?: number;
  maxWidth: number;
  maxHeight?: number;
  color?: string;
  title?: string;
}) {
  const drawing = useMemo(() => draw(smiles, kind, size), [smiles, kind, size]);
  const { viewBox: vb } = drawing;
  const scale = Math.min(1, maxWidth / vb.width, maxHeight / vb.height);
  return (
    <Svg
      width={vb.width * scale}
      height={vb.height * scale}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      accessibilityRole="image"
      accessibilityLabel={title ?? 'Fórmula estrutural'}
    >
      <G stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {drawing.primitives.map((p, k) =>
          p.type === 'line' ? (
            <Line key={k} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} strokeWidth={p.width} />
          ) : p.type === 'polygon' ? (
            <Polygon key={k} points={p.points.map((q) => `${q.x},${q.y}`).join(' ')} fill={color} strokeWidth={0.4} />
          ) : (
            <Circle key={k} cx={p.center.x} cy={p.center.y} r={p.r} strokeWidth={p.width} />
          ),
        )}
      </G>
      {drawing.labels.map((label) => (
        <SvgText key={label.atom} fill={label.color === 'currentColor' ? color : label.color} fontFamily={molFont(drawing.style.fontWeight)}>
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
    </Svg>
  );
});
