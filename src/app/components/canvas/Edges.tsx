/**
 * Links between cards, drawn like the arrows of a reaction scheme: a hairline with an open
 * head, and the label written over it the way reagents sit over the arrow.
 */
import { memo } from 'react';
import { type MapEdge, type Point, type Rect, anchor, edgeLine } from '../../../study/canvas.ts';

function arrowPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = (side: number) => `${to.x - 11 * ux + side * 4.6 * -uy} ${to.y - 11 * uy + side * 4.6 * ux}`;
  return `M${from.x} ${from.y}L${to.x} ${to.y}M${head(1)}L${to.x} ${to.y}L${head(-1)}`;
}

/** Label placement: centred over the line, rotated with it but never upside down. */
function labelTransform(from: Point, to: Point): string {
  let angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return `translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2}) rotate(${angle})`;
}

export const Edges = memo(function Edges({
  rects,
  edges,
  selected,
  pending,
}: {
  rects: Record<string, Rect>;
  edges: MapEdge[];
  selected?: string;
  /** A link being drawn from a card to the pointer. */
  pending?: { from: Rect; to: Point };
}) {
  return (
    <svg className="edges" aria-hidden="true">
      {edges.map((e) => {
        const a = rects[e.from];
        const b = rects[e.to];
        if (!a || !b) return null;
        const line = edgeLine(a, b, 8);
        if (!line) return null;
        return (
          <g key={e.id} className={`edge${e.id === selected ? ' is-selected' : ''}`} data-edge={e.id}>
            <line className="edge-hit" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
            <path className="edge-line" d={arrowPath(line.from, line.to)} />
            {e.label && (
              <text className="edge-label" transform={labelTransform(line.from, line.to)} y={-8} textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {pending && (
        <path className="edge-line edge-line--pending" d={arrowPath(anchor(pending.from, pending.to, 8), pending.to)} />
      )}
    </svg>
  );
});
