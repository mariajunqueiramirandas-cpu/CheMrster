/** Rounded outlines around point sets, for dashed functional-group annotations. */
import { type Vec, add, cross, fromAngle, sub } from './geometry.ts';

/** Convex hull (Andrew's monotone chain). */
export function convexHull(points: Vec[]): Vec[] {
  const pts = [...points].sort((p, q) => p.x - q.x || p.y - q.y);
  if (pts.length < 3) return pts;
  const half = (list: Vec[]) => {
    const out: Vec[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(sub(out[out.length - 1], out[out.length - 2]), sub(p, out[out.length - 2])) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/**
 * The convex hull grown by `r` with round corners (a Minkowski sum with a disc),
 * as a closed polygon: a circle for one point, a capsule for two.
 */
export function roundedHull(points: Vec[], r: number, segments = 24): Vec[] {
  const ring = points.flatMap((p) => Array.from({ length: segments }, (_, k) => add(p, fromAngle((k * 2 * Math.PI) / segments, r))));
  return convexHull(ring);
}
