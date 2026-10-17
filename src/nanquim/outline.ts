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

/**
 * The smallest ellipse of the cloud's own proportions (axes along its principal
 * directions) that keeps every point `r` inside, the shape the booklets draw by hand.
 */
export function roundedEllipse(points: Vec[], r: number, segments = 48): Vec[] {
  const ring = points.flatMap((p) => Array.from({ length: 16 }, (_, k) => add(p, fromAngle((k * 2 * Math.PI) / 16, r))));
  const mx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
  const my = ring.reduce((s, p) => s + p.y, 0) / ring.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of ring) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const t = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = fromAngle(t, 1);
  const vx = fromAngle(t + Math.PI / 2, 1);
  const us = ring.map((p) => p.x * ux.x + p.y * ux.y);
  const vs = ring.map((p) => p.x * vx.x + p.y * vx.y);
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const hu = Math.max((u1 - u0) / 2, 1e-6);
  const hv = Math.max((v1 - v0) / 2, 1e-6);
  const s = Math.max(...us.map((u, i) => Math.hypot((u - cu) / hu, (vs[i] - cv) / hv)));
  const center = add(fromAngle(t, cu), fromAngle(t + Math.PI / 2, cv));
  return Array.from({ length: segments }, (_, k) => {
    const a = (k * 2 * Math.PI) / segments;
    return add(center, add(fromAngle(t, s * hu * Math.cos(a)), fromAngle(t + Math.PI / 2, s * hv * Math.sin(a))));
  });
}
