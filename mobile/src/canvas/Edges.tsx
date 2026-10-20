/**
 * The bench under the cards: the dotted grid and the links between cards, drawn like the
 * arrows of a reaction scheme (src/app/components/canvas/Edges.tsx). Drawn in screen space,
 * so lines stay hairline-crisp at any zoom.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import { type MapEdge, type Point, type Rect, type View, anchor, edgeLine, toScreen } from '../../../src/study/canvas.ts';
import type { Palette } from '../theme.ts';
import { FONT } from '../theme.ts';

function arrowPath(from: Point, to: Point, head = 11): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const side = (s: number) => `${to.x - head * ux + s * head * 0.42 * -uy} ${to.y - head * uy + s * head * 0.42 * ux}`;
  return `M${from.x} ${from.y}L${to.x} ${to.y}M${side(1)}L${to.x} ${to.y}L${side(-1)}`;
}

/** Label angle: along the line, never upside down. */
function labelAngle(from: Point, to: Point): number {
  let angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}

/** Distance from `p` to the segment a–b. */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const Edges = memo(function Edges({
  view,
  size,
  rects,
  edges,
  selected,
  pending,
  c,
}: {
  view: View;
  size: { w: number; h: number };
  rects: Record<string, Rect>;
  edges: MapEdge[];
  selected?: string;
  /** A link being drawn from a card to the finger (world units). */
  pending?: { from: Rect; to: Point };
  c: Palette;
}) {
  // Dots every 24 world units, sparser when zoomed far out.
  const grid = 24 * view.zoom * (view.zoom < 0.5 ? 4 : 1);
  const ox = ((view.x % grid) + grid) % grid;
  const oy = ((view.y % grid) + grid) % grid;
  const s = (p: Point) => toScreen(view, p);
  const font = Math.max(10, Math.min(20, 14 * view.zoom));
  return (
    <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h} pointerEvents="none">
      <Defs>
        <Pattern id="dots" x={ox} y={oy} width={grid} height={grid} patternUnits="userSpaceOnUse">
          <Circle cx={grid / 2} cy={grid / 2} r={1.3} fill={c.gridDot} />
        </Pattern>
      </Defs>
      <SvgRect x={0} y={0} width={size.w} height={size.h} fill="url(#dots)" />
      {edges.map((e) => {
        const a = rects[e.from];
        const b = rects[e.to];
        if (!a || !b) return null;
        const line = edgeLine(a, b, 8);
        if (!line) return null;
        const from = s(line.from);
        const to = s(line.to);
        const on = e.id === selected;
        const ink = on ? c.magenta : c.text;
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        return (
          <G key={e.id}>
            <Path
              d={arrowPath(from, to, Math.max(7, 11 * Math.min(1.4, view.zoom)))}
              stroke={ink}
              strokeWidth={on ? 2.4 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {e.label ? (
              // Written over the arrow like a reagent, with a halo of bench so it reads over the dots.
              <G transform={`translate(${mid.x} ${mid.y}) rotate(${labelAngle(from, to)})`}>
                {[true, false].map((halo) => (
                  <SvgText
                    key={String(halo)}
                    y={-8 * Math.min(1.3, Math.max(0.7, view.zoom))}
                    textAnchor="middle"
                    fontFamily={FONT.mol}
                    fontSize={font}
                    fill={halo ? c.bench : ink}
                    stroke={halo ? c.bench : undefined}
                    strokeWidth={halo ? 5 : 0}
                    strokeLinejoin="round"
                  >
                    {e.label}
                  </SvgText>
                ))}
              </G>
            ) : null}
          </G>
        );
      })}
      {pending ? (
        <Line
          x1={s(anchor(pending.from, pending.to, 8)).x}
          y1={s(anchor(pending.from, pending.to, 8)).y}
          x2={s(pending.to).x}
          y2={s(pending.to).y}
          stroke={c.magenta}
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
});
