/** Small, allocation-light 2D vector helpers. Layout space is y-up, bond length = 1. */

export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const fromAngle = (t: number, r = 1): Vec => ({ x: Math.cos(t) * r, y: Math.sin(t) * r });
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export function norm(a: Vec): Vec {
  const l = Math.hypot(a.x, a.y);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export function rotate(a: Vec, t: number): Vec {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export function rotateAround(p: Vec, center: Vec, t: number): Vec {
  return add(center, rotate(sub(p, center), t));
}

/** Mirror point p across the infinite line through a and b. */
export function reflect(p: Vec, a: Vec, b: Vec): Vec {
  const d = norm(sub(b, a));
  const v = sub(p, a);
  const along = scale(d, dot(v, d));
  return add(a, sub(scale(along, 2), v));
}

export function centroid(points: Vec[]): Vec {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(points.length, 1);
  return { x: x / n, y: y / n };
}

/** Normalise an angle into (-PI, PI]. */
export function wrapAngle(t: number): number {
  let a = t % (2 * Math.PI);
  if (a <= -Math.PI) a += 2 * Math.PI;
  if (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** Intersection of the infinite lines p1 + t*d1 and p2 + s*d2; returns t, or null when parallel. */
export function lineIntersectionT(p1: Vec, d1: Vec, p2: Vec, d2: Vec): number | null {
  const den = cross(d1, d2);
  if (Math.abs(den) < 1e-9) return null;
  return cross(sub(p2, p1), d2) / den;
}

/** True when the open segments ab and cd properly cross each other. */
export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const d1 = cross(sub(b, a), sub(c, a));
  const d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c));
  const d4 = cross(sub(d, c), sub(b, c));
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** Shortest distance from point p to the segment ab. */
export function pointSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}
