/**
 * 2D coordinate generation tuned for textbook-style drawings:
 *  - ring systems are built from regular polygons, fused edge-to-edge;
 *  - chains grow as 120° zig-zags, quaternary centres as 90° crosses, sp atoms straight;
 *  - cis/trans requirements are honoured while placing;
 *  - overlaps are removed by mirroring branches across rotatable bonds;
 *  - the result is turned to the most "readable" orientation on a 60° grid.
 * Coordinates are y-up with a bond length of 1.
 */
import {
  type Vec,
  add,
  angleOf,
  centroid,
  cross,
  dist,
  fromAngle,
  norm,
  perp,
  reflect,
  rotate,
  scale,
  segmentsCross,
  sub,
  vec,
  wrapAngle,
} from './geometry.ts';
import type { Molecule } from './molecule.ts';
import { ringInfo, type RingInfo } from './rings.ts';

const DEG = Math.PI / 180;

export interface LayoutOptions {
  /**
   * Rotation grid for the final orientation in degrees. Default: 30 for open chains,
   * 60 for ring systems (keeps hexagons upright). Full structural formulas use 90.
   */
  rotationStep?: number;
  /** Let hydrogens overlap freely (they are folded into labels afterwards). */
  ignoreHydrogenClashes?: boolean;
  /**
   * 'upright' stands a ring with one substituent (or two, ortho/meta) on end with the
   * main group pointing up, as in ENEM booklets. Default 'landscape'.
   */
  pose?: 'landscape' | 'upright';
  /**
   * Which path becomes the straight main chain of written-out formulas: the longest
   * carbon path (default) or the longest path ending in functional groups (HS–C–C–COOH).
   */
  chain?: 'carbon' | 'functional';
  /**
   * The formula writes hydrogens and carbons out (structural, condensed, plana): chains
   * run straight through 2-connected atoms. Default: detected from explicit H atoms.
   */
  writtenOut?: boolean;
}

export function computeLayout(mol: Molecule, options: LayoutOptions = {}): Vec[] {
  const info = ringInfo(mol, mol.rings);
  const coords: Vec[] = mol.atoms.map(() => vec(0, 0));
  const components = mol.components();
  for (const comp of components) {
    const placer = new ComponentPlacer(mol, info, comp, coords, options.chain ?? 'carbon', options.writtenOut);
    placer.run();
    refineOverlaps(mol, options.ignoreHydrogenClashes ? comp.filter((a) => mol.atoms[a].element !== 'H') : comp, coords, info);
    orient(mol, comp, coords, info, options.rotationStep, options.pose ?? 'landscape');
  }
  arrangeComponents(mol, components, coords);
  return coords;
}

// ---------------------------------------------------------------------------
// Ring systems

function regularPolygonStart(n: number): number {
  if (n % 2 === 1) return 90 * DEG;
  return (n / 2) % 2 === 1 ? 90 * DEG : 90 * DEG + Math.PI / n;
}

/** Place `m` new atoms on a circular arc between e1 and e2 with unit chords, bulging toward `side`. */
function arcPoints(e1: Vec, e2: Vec, m: number, side: Vec): Vec[] {
  const d = dist(e1, e2);
  const steps = m + 1;
  const mid = scale(add(e1, e2), 0.5);
  const chordDir = norm(sub(e2, e1));
  let normal = vec(-chordDir.y, chordDir.x);
  if (d < 1e-6) normal = norm(side);
  else if (cross(chordDir, side) < 0) normal = scale(normal, -1);
  if (d >= steps - 1e-9) {
    // Too far apart for unit bonds: space evenly on the straight line.
    return Array.from({ length: m }, (_, k) => add(e1, scale(sub(e2, e1), (k + 1) / steps)));
  }
  // Solve sin(steps*b)/sin(b) = d for b in (0, PI/steps).
  let lo = 1e-9;
  let hi = Math.PI / steps - 1e-9;
  for (let it = 0; it < 80; it++) {
    const b = (lo + hi) / 2;
    const f = Math.sin(steps * b) / Math.sin(b) - d;
    if (f > 0) lo = b;
    else hi = b;
  }
  const beta = (lo + hi) / 2;
  const r = 1 / (2 * Math.sin(beta));
  const phi = 2 * beta * steps; // total arc angle
  const center = sub(mid, scale(normal, r * Math.cos(phi / 2)));
  const start = angleOf(sub(e1, center));
  // Walk from e1 in the rotational sense that reaches e2 after the full arc. For a
  // semicircle both senses do, so pick the one whose midpoint bulges along `normal`.
  const landing = (sign: number) => dist(add(center, fromAngle(start + sign * phi, r)), e2);
  let sign = landing(1) < landing(-1) ? 1 : -1;
  if (Math.abs(landing(1) - landing(-1)) < 1e-6) {
    const probe = add(center, fromAngle(start + phi / 2, r));
    sign = cross(chordDir, sub(probe, mid)) * cross(chordDir, normal) > 0 ? 1 : -1;
  }
  return Array.from({ length: m }, (_, k) => add(center, fromAngle(start + sign * 2 * beta * (k + 1), r)));
}

/** Longest simple cycle through the given atoms (bounded search; fine for real ring systems). */
function longestCycle(mol: Molecule, atoms: Set<number>): number[] {
  let best: number[] = [];
  let budget = 400000;
  const sorted = [...atoms].sort((p, q) => p - q);
  for (const start of sorted) {
    const path = [start];
    const onPath = new Set(path);
    const dfs = (v: number) => {
      if (--budget < 0) return;
      for (const w of mol.neighbors(v)) {
        if (!atoms.has(w)) continue;
        if (w === start && path.length >= 3 && path.length > best.length) best = [...path];
        // Only extend through atoms greater than start to enumerate each cycle once.
        if (w <= start || onPath.has(w)) continue;
        path.push(w);
        onPath.add(w);
        dfs(w);
        path.pop();
        onPath.delete(w);
      }
    };
    dfs(start);
    if (best.length === atoms.size) break;
  }
  return best;
}

/**
 * Bridged systems (norbornane, camphor, tropane, ...) cannot be tiled with regular
 * polygons. Draw the largest cycle as the outline and run the bridges across it.
 */
function layoutBridgedSystem(mol: Molecule, atoms: Set<number>): Map<number, Vec> | undefined {
  const envelope = longestCycle(mol, atoms);
  if (envelope.length < 4) return undefined;
  const pos = new Map<number, Vec>();
  const n = envelope.length;
  const radius = 1 / (2 * Math.sin(Math.PI / n));
  const start = regularPolygonStart(n);
  envelope.forEach((a, k) => pos.set(a, fromAngle(start - (k * 2 * Math.PI) / n, radius)));
  const isAdjacentOnEnvelope = (x: number, y: number) => {
    const i = envelope.indexOf(x);
    const j = envelope.indexOf(y);
    return i >= 0 && j >= 0 && ((i + 1) % n === j || (j + 1) % n === i);
  };
  for (let guard = 0; guard < atoms.size && pos.size < atoms.size; guard++) {
    // Shortest path of unplaced atoms joining two placed atoms (an "ear" or a bridge).
    let bestPath: number[] | undefined;
    for (const from of pos.keys()) {
      const prev = new Map<number, number>([[from, -1]]);
      const q = [from];
      for (let qi = 0; qi < q.length; qi++) {
        const v = q[qi];
        for (const w of mol.neighbors(v)) {
          if (!atoms.has(w) || prev.has(w)) continue;
          if (pos.has(w)) {
            if (v === from) continue; // direct bond between placed atoms
            const path = [w];
            for (let x = v; x !== -1; x = prev.get(x)!) path.push(x);
            if (!bestPath || path.length < bestPath.length) bestPath = path;
            continue;
          }
          prev.set(w, v);
          q.push(w);
        }
      }
    }
    if (!bestPath) break;
    const e1 = bestPath[0];
    const e2 = bestPath[bestPath.length - 1];
    const inner = bestPath.slice(1, -1);
    const p1 = pos.get(e1)!;
    const p2 = pos.get(e2)!;
    const mid = scale(add(p1, p2), 0.5);
    const center = centroid([...pos.values()]);
    let toCenter = sub(center, mid);
    if (Math.hypot(toCenter.x, toCenter.y) < 1e-6) toCenter = perp(sub(p2, p1));
    // Fused ears go outside the outline; true bridges cross the inside.
    const side = isAdjacentOnEnvelope(e1, e2) ? scale(toCenter, -1) : toCenter;
    let pts = arcPoints(p1, p2, inner.length, side);
    if (!isAdjacentOnEnvelope(e1, e2)) {
      // A bridge laid straight through the middle hides its vertex; bow it a little.
      const bow = norm(side);
      pts = pts.map((p, i) => {
        const t = (i + 1) / (inner.length + 1);
        const lift = 0.5 * Math.sin(Math.PI * t);
        return add(p, scale(bow, Math.abs(cross(norm(sub(p2, p1)), sub(p, p1))) < 0.2 ? lift : 0));
      });
    }
    inner.forEach((a, i) => pos.set(a, pts[i]));
  }
  return pos.size === atoms.size ? pos : undefined;
}

function isBridged(rings: number[][], ringIds: number[]): boolean {
  for (let i = 0; i < ringIds.length; i++) {
    for (let j = i + 1; j < ringIds.length; j++) {
      const a = rings[ringIds[i]];
      const b = rings[ringIds[j]];
      if (a.filter((x) => b.includes(x)).length >= 3) return true;
    }
  }
  return false;
}

function layoutRingSystem(mol: Molecule, rings: number[][], ringIds: number[]): Map<number, Vec> {
  if (isBridged(rings, ringIds)) {
    const atoms = new Set(ringIds.flatMap((ri) => rings[ri]));
    if (atoms.size <= 30) {
      const bridged = layoutBridgedSystem(mol, atoms);
      if (bridged) return bridged;
    }
  }
  const pos = new Map<number, Vec>();
  const remaining = new Set(ringIds);
  const sharedCount = (ri: number) =>
    ringIds.filter((rj) => rj !== ri && rings[rj].some((a) => rings[ri].includes(a))).length;
  // Start with the largest ring, then the most fused one.
  const first = [...ringIds].sort((p, q) => rings[q].length - rings[p].length || sharedCount(q) - sharedCount(p))[0];
  const ring0 = rings[first];
  const n0 = ring0.length;
  const radius = 1 / (2 * Math.sin(Math.PI / n0));
  const start = regularPolygonStart(n0);
  ring0.forEach((a, k) => pos.set(a, fromAngle(start - (k * 2 * Math.PI) / n0, radius)));
  remaining.delete(first);

  while (remaining.size) {
    // Prefer rings that share exactly one bond with the placed part (simple fusion).
    let best = -1;
    let bestScore = -Infinity;
    for (const ri of remaining) {
      const placed = rings[ri].filter((a) => pos.has(a)).length;
      if (!placed) continue;
      const score = (placed === 2 ? 100 : 0) + placed * 10 + rings[ri].length * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = ri;
      }
    }
    if (best < 0) break;
    remaining.delete(best);
    placeRingOnto(mol, rings[best], pos);
  }
  return pos;
}

function placeRingOnto(mol: Molecule, ring: number[], pos: Map<number, Vec>) {
  const n = ring.length;
  const placedFlags = ring.map((a) => pos.has(a));
  const k = placedFlags.filter(Boolean).length;
  if (k === n) return;
  // Rotate the ring so that the placed atoms form the prefix (pick the longest contiguous run).
  let bestStart = 0;
  let bestRun = -1;
  for (let s = 0; s < n; s++) {
    if (!placedFlags[s] || placedFlags[(s - 1 + n) % n]) continue;
    let run = 0;
    while (run < n && placedFlags[(s + run) % n]) run++;
    if (run > bestRun) {
      bestRun = run;
      bestStart = s;
    }
  }
  const ordered = Array.from({ length: n }, (_, i) => ring[(bestStart + i) % n]);
  const run = bestRun;
  if (run === 1) {
    // Spiro junction: grow the new ring away from the atom's placed neighbours.
    const a = ordered[0];
    const pa = pos.get(a)!;
    let away = vec(0, 0);
    for (const nb of mol.neighbors(a)) {
      const p = pos.get(nb);
      if (p) away = sub(away, norm(sub(p, pa)));
    }
    if (Math.hypot(away.x, away.y) < 1e-6) away = vec(1, 0);
    away = norm(away);
    const r = 1 / (2 * Math.sin(Math.PI / n));
    const center = add(pa, scale(away, r));
    const a0 = angleOf(sub(pa, center));
    for (let i = 1; i < n; i++) {
      const atom = ordered[i];
      if (!pos.has(atom)) pos.set(atom, add(center, fromAngle(a0 + (i * 2 * Math.PI) / n, r)));
    }
    return;
  }
  const pathEnd = ordered[run - 1];
  const pathStart = ordered[0];
  const unplaced = ordered.slice(run).filter((a) => !pos.has(a));
  // Bulge away from what is already drawn around the shared path.
  const near: Vec[] = [];
  for (let i = 0; i < run; i++) {
    const atom = ordered[i];
    if (i > 0 && i < run - 1) near.push(pos.get(atom)!);
    for (const nb of mol.neighbors(atom)) {
      const p = pos.get(nb);
      if (p && !ordered.slice(0, run).includes(nb)) near.push(p);
    }
  }
  const mid = scale(add(pos.get(pathStart)!, pos.get(pathEnd)!), 0.5);
  const side = near.length ? sub(mid, centroid(near)) : vec(0, 1);
  const pts = arcPoints(pos.get(pathEnd)!, pos.get(pathStart)!, unplaced.length, side);
  // Bridged systems can fold onto themselves; take the mirror arc if it is less crowded.
  const altPts = arcPoints(pos.get(pathEnd)!, pos.get(pathStart)!, unplaced.length, scale(side, -1));
  const crowd = (cands: Vec[]) => {
    let c = 0;
    for (const p of cands) for (const q of pos.values()) c += Math.max(0, 0.8 - dist(p, q));
    return c;
  };
  const chosen = run > 2 && crowd(altPts) + 1e-6 < crowd(pts) ? altPts : pts;
  unplaced.forEach((atom, i) => pos.set(atom, chosen[i]));
}

// ---------------------------------------------------------------------------
// Component placement

class ComponentPlacer {
  private readonly mol: Molecule;
  private readonly comp: number[];
  private readonly out: Vec[];
  private readonly pos: (Vec | undefined)[];
  private readonly dir: number[];
  private readonly turn: number[];
  private readonly systemOf: number[];
  private readonly systemPlaced: boolean[];
  private readonly systemLayouts: Map<number, Vec>[];
  private readonly queue: number[] = [];
  private readonly explicitH: boolean;
  private readonly chain: 'carbon' | 'functional';

  constructor(
    mol: Molecule,
    info: RingInfo,
    comp: number[],
    out: Vec[],
    chain: 'carbon' | 'functional',
    writtenOut?: boolean,
  ) {
    this.mol = mol;
    this.chain = chain;
    this.explicitH = writtenOut ?? comp.some((a) => mol.atoms[a].element === 'H' && mol.degree(a) === 1);
    this.comp = comp;
    this.out = out;
    this.pos = mol.atoms.map(() => undefined);
    this.dir = mol.atoms.map(() => 0);
    this.turn = mol.atoms.map(() => 0);
    this.systemOf = mol.atoms.map(() => -1);
    const compSet = new Set(comp);
    const systems = info.systems.filter((sys) => compSet.has(info.rings[sys[0]][0]));
    this.systemLayouts = systems.map((sys) => layoutRingSystem(mol, info.rings, sys));
    this.systemPlaced = systems.map(() => false);
    systems.forEach((sys, si) => {
      for (const ri of sys) for (const a of info.rings[ri]) this.systemOf[a] = si;
    });
  }

  run() {
    const { comp } = this;
    if (this.systemLayouts.length) {
      // Seed with the biggest ring system.
      let best = 0;
      this.systemLayouts.forEach((l, i) => {
        if (l.size > this.systemLayouts[best].size) best = i;
      });
      for (const [atom, p] of this.systemLayouts[best]) this.setPos(atom, p);
      this.systemPlaced[best] = true;
      for (const atom of this.systemLayouts[best].keys()) this.queue.push(atom);
    } else {
      const seed = this.chainSeed();
      this.setPos(seed, vec(0, 0));
      this.queue.push(seed);
    }
    while (this.queue.length) this.placeNeighbors(this.queue.shift()!);
    for (const atom of comp) this.out[atom] = this.pos[atom] ?? vec(0, 0);
  }

  private setPos(atom: number, p: Vec) {
    this.pos[atom] = p;
  }

  /** One end of the longest heavy-atom path, so the backbone becomes the horizontal zig-zag. */
  private chainSeed(): number {
    const heavyAtom = (x: number) => this.mol.atoms[x].element !== 'H';
    if (this.chain === 'functional') return this.functionalSeed(heavyAtom);
    // Written-out formulas hang everything off the carbon backbone.
    const carbons = this.comp.filter((a) => this.mol.atoms[a].element === 'C');
    const backbone = this.explicitH && carbons.length ? (x: number) => this.mol.atoms[x].element === 'C' : heavyAtom;
    const members = this.comp.filter(backbone);
    if (!members.length) return this.comp[0];
    const far = (from: number) => {
      const d = new Map<number, number>([[from, 0]]);
      const q = [from];
      let last = from;
      for (let i = 0; i < q.length; i++) {
        const v = q[i];
        last = v;
        for (const w of this.mol.neighbors(v)) {
          if (d.has(w) || !backbone(w)) continue;
          d.set(w, d.get(v)! + 1);
          q.push(w);
        }
      }
      return last;
    };
    const a = far(members[0]);
    const b = far(a);
    const heavyDegree = (x: number) => this.mol.neighbors(x).filter(heavyAtom).length;
    if (heavyDegree(a) !== heavyDegree(b)) return heavyDegree(a) < heavyDegree(b) ? a : b;
    // Start from the carbon end so heteroatom groups tend to end up at the right.
    const isHetero = (x: number) => this.mol.atoms[x].element !== 'C';
    return isHetero(a) && !isHetero(b) ? b : a;
  }

  /**
   * End of the longest heavy-atom path, preferring paths whose two ends are functional
   * groups (heteroatoms or condensed groups), so the chain reads HS–C–C–COOH.
   */
  private functionalSeed(heavyAtom: (x: number) => boolean): number {
    const heavy = this.comp.filter(heavyAtom);
    if (!heavy.length) return this.comp[0];
    const functional = (x: number) => {
      const a = this.mol.atoms[x];
      return a.element !== 'C' || !!a.abbreviation;
    };
    let best: [number, number] = [heavy[0], heavy[0]];
    let bestKey = [-1, -1];
    for (const s0 of heavy) {
      const d = new Map<number, number>([[s0, 0]]);
      const q = [s0];
      for (let i = 0; i < q.length; i++) {
        for (const w of this.mol.neighbors(q[i])) {
          if (d.has(w) || !heavyAtom(w)) continue;
          d.set(w, d.get(q[i])! + 1);
          q.push(w);
        }
      }
      for (const [t, dist] of d) {
        const key = [dist, Number(functional(s0)) + Number(functional(t))];
        if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
          bestKey = key;
          best = [s0, t];
        }
      }
    }
    // Start from the end that is not a condensed group, so "COOH" closes the line.
    return this.mol.atoms[best[0]].abbreviation ? best[1] : best[0];
  }

  /** Size and depth of the branch reached through `child` without passing `from`. */
  private branchWeight(from: number, child: number): number {
    const seen = new Set([from, child]);
    const q: Array<[number, number]> = [[child, 0]];
    let depth = 0;
    let heavy = 0;
    for (let i = 0; i < q.length; i++) {
      const [v, d] = q[i];
      if (this.mol.atoms[v].element !== 'H') {
        // A condensed group (COOH) weighs as much as the atoms it stands for.
        heavy += this.mol.atoms[v].members?.length ?? 1;
        depth = Math.max(depth, d);
      }
      for (const w of this.mol.neighbors(v)) {
        if (!seen.has(w)) {
          seen.add(w);
          q.push([w, d + 1]);
        }
      }
    }
    return heavy === 0 ? 0 : depth * 1000 + heavy;
  }

  private isLinear(atom: number): boolean {
    if (this.mol.degree(atom) !== 2) return false;
    // In written-out formulas (explicit H atoms) chains run straight through -O-, -NH-,
    // and end groups read straight too (C–O–H, HS–C). Water stays bent.
    if (this.explicitH && this.systemOf[atom] < 0 && this.mol.neighbors(atom).some((n) => this.mol.atoms[n].element !== 'H')) {
      return true;
    }
    let doubles = 0;
    for (const bi of this.mol.adjacency[atom]) {
      const o = this.mol.bonds[bi].order;
      if (o === 3) return true;
      if (o === 2) doubles++;
    }
    return doubles >= 2;
  }

  private placeNeighbors(atom: number) {
    const { mol } = this;
    const here = this.pos[atom]!;
    const nbrs = mol.neighbors(atom);
    const placed = nbrs.filter((n) => this.pos[n]);
    const unplaced = nbrs.filter((n) => !this.pos[n]);
    if (!unplaced.length) return;
    const weights = new Map(unplaced.map((c) => [c, this.branchWeight(atom, c)]));
    unplaced.sort((p, q) => weights.get(q)! - weights.get(p)! || p - q);
    const n = unplaced.length;

    // Candidate assignments: arrays of angles aligned with `unplaced`.
    const candidates: number[][] = [];
    if (placed.length === 0) {
      if (n === 1) candidates.push([30 * DEG], [-30 * DEG]);
      else if (n === 2 && this.isLinear(atom)) candidates.push([0, Math.PI]);
      else if (n === 2) candidates.push([-30 * DEG, 210 * DEG]);
      else candidates.push(Array.from({ length: n }, (_, k) => (k * 2 * Math.PI) / n));
      if (n === 4) candidates[0] = [0, 90 * DEG, -90 * DEG, 180 * DEG];
    } else if (placed.length === 1) {
      const theta = angleOf(sub(here, this.pos[placed[0]]!));
      const s = this.turn[atom] || 1;
      if (this.isLinear(atom) && n === 1) {
        candidates.push([theta]);
      } else if (n === 1) {
        candidates.push([theta - 60 * DEG * s], [theta + 60 * DEG * s]);
      } else if (n === 2) {
        candidates.push([theta - 60 * DEG * s, theta + 60 * DEG * s], [theta + 60 * DEG * s, theta - 60 * DEG * s]);
      } else if (n === 3) {
        candidates.push([theta, theta - 90 * DEG * s, theta + 90 * DEG * s]);
        candidates.push([theta, theta + 90 * DEG * s, theta - 90 * DEG * s]);
      } else {
        const step = (2 * Math.PI) / (n + 1);
        candidates.push(Array.from({ length: n }, (_, k) => theta + Math.PI + step * (k + 1)));
      }
    } else {
      const angles = placed.map((p) => angleOf(sub(this.pos[p]!, here))).sort((p, q) => p - q);
      // Every angular gap between placed bonds, widest first; crowding picks among them.
      const gaps: Array<[number, number]> = angles.map((a, i) =>
        i === 0 ? [angles[angles.length - 1], a + 2 * Math.PI - angles[angles.length - 1]] : [angles[i - 1], a - angles[i - 1]],
      );
      gaps.sort((p, q) => q[1] - p[1]);
      for (const [gapStart, gap] of gaps) {
        if (gap < gaps[0][1] * 0.5 && candidates.length) break;
        const spread = Array.from({ length: n }, (_, k) => gapStart + (gap * (k + 1)) / (n + 1));
        // Heaviest branch in the middle of the gap, the rest alternating outwards.
        const order = [...spread.keys()].sort(
          (p, q) => Math.abs(p - (n - 1) / 2) - Math.abs(q - (n - 1) / 2) || p - q,
        );
        candidates.push(order.map((i) => spread[i]));
        if (n >= 2) candidates.push([...order].reverse().map((i) => spread[i]));
      }
    }

    let best: number[] = candidates[0];
    let bestScore = Infinity;
    for (const cand of candidates) {
      const assign = new Map<number, Vec>();
      unplaced.forEach((c, i) => assign.set(c, add(here, fromAngle(cand[i]))));
      let score = this.crowding(assign, atom);
      if (!this.stereoOK(atom, assign)) score += 1e6;
      // Tiny bias keeps the preferred (first) candidate on ties.
      score += candidates.indexOf(cand) * 1e-6;
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = cand;
      }
    }

    unplaced.forEach((child, i) => {
      if (this.pos[child]) return; // placed meanwhile as part of a ring system
      const angle = best[i];
      const target = add(here, fromAngle(angle));
      const sys = this.systemOf[child];
      if (sys >= 0 && !this.systemPlaced[sys]) {
        this.placeRingSystem(sys, child, target, atom);
        return;
      }
      this.setPos(child, target);
      this.dir[child] = angle;
      const t = wrapAngle(angle - angleOf(sub(here, placed.length ? this.pos[placed[0]]! : vec(here.x - 1, here.y))));
      this.turn[child] = placed.length === 1 && Math.abs(t) > 1e-6 && Math.abs(Math.abs(t) - Math.PI) > 1e-6 ? Math.sign(t) : 0;
      if (placed.length === 0) this.turn[child] = Math.sign(Math.sin(angle)) || 0;
      this.queue.push(child);
    });
  }

  private crowding(assign: Map<number, Vec>, center: number): number {
    let score = 0;
    for (const [child, p] of assign) {
      for (const a of this.comp) {
        const q = this.pos[a];
        if (!q || a === center || a === child) continue;
        const d = dist(p, q);
        if (d < 1.0) score += (1.0 - d) * (1.0 - d) * 50;
        score += Math.exp(-2 * d);
      }
    }
    return score;
  }

  /** Check every cis/trans requirement that the tentative positions make decidable. */
  private stereoOK(atom: number, assign: Map<number, Vec>): boolean {
    const at = (x: number) => assign.get(x) ?? this.pos[x];
    for (const st of this.mol.doubleBondStereo) {
      if (st.a !== atom && st.b !== atom) continue;
      const a = atom;
      const b = st.a === atom ? st.b : st.a;
      const pa = at(a);
      const pb = at(b);
      if (!pa || !pb) continue;
      const refOn = (center: number, partner: number, specified: number) => {
        if (at(specified)) return { atom: specified, flip: false };
        const other = this.mol.neighbors(center).find((x) => x !== partner && x !== specified && at(x));
        return other === undefined ? undefined : { atom: other, flip: true };
      };
      const ra = refOn(a, b, st.a === atom ? st.x : st.y);
      const rb = refOn(b, a, st.a === atom ? st.y : st.x);
      if (!ra || !rb) continue;
      if (!assign.has(ra.atom) && !assign.has(rb.atom)) continue;
      const axis = sub(pb, pa);
      const sa = Math.sign(cross(axis, sub(at(ra.atom)!, pa)));
      const sb = Math.sign(cross(axis, sub(at(rb.atom)!, pa)));
      const wantSame = st.cis !== ra.flip !== rb.flip;
      if (sa === 0 || sb === 0) return false;
      if ((sa === sb) !== wantSame) return false;
    }
    return true;
  }

  /** Drop a whole ring system so that `entry` sits at `target`, pointing back to `from`. */
  private placeRingSystem(sys: number, entry: number, target: Vec, from: number) {
    const local = this.systemLayouts[sys];
    const pe = local.get(entry)!;
    let outward = vec(0, 0);
    for (const nb of this.mol.neighbors(entry)) {
      const p = local.get(nb);
      if (p) outward = sub(outward, norm(sub(p, pe)));
    }
    if (Math.hypot(outward.x, outward.y) < 1e-6) outward = sub(pe, centroid([...local.values()]));
    const want = angleOf(sub(this.pos[from]!, target));
    const rot = want - angleOf(outward);
    const build = (mirror: boolean) => {
      const m = new Map<number, Vec>();
      for (const [atom, p] of local) {
        let v = sub(p, pe);
        if (mirror) v = reflect(v, vec(0, 0), outward);
        m.set(atom, add(target, rotate(v, rot)));
      }
      return m;
    };
    const plain = build(false);
    const mirrored = build(true);
    const score = (m: Map<number, Vec>) => this.crowding(m, from) + (this.stereoOK(from, m) ? 0 : 1e6);
    const chosen = score(mirrored) + 1e-6 < score(plain) ? mirrored : plain;
    for (const [atom, p] of chosen) this.setPos(atom, p);
    this.systemPlaced[sys] = true;
    // Ring atoms grow their substituents after the entry atom.
    this.queue.push(entry);
    for (const atom of chosen.keys()) if (atom !== entry) this.queue.push(atom);
  }
}

// ---------------------------------------------------------------------------
// Overlap refinement

function congestion(mol: Molecule, comp: number[], coords: Vec[]): number {
  let score = 0;
  for (let i = 0; i < comp.length; i++) {
    for (let j = i + 1; j < comp.length; j++) {
      const a = comp[i];
      const b = comp[j];
      const d = dist(coords[a], coords[b]);
      if (d < 0.9 && !mol.bondBetween(a, b)) score += (0.9 - d) * (0.9 - d) * 100 + (d < 0.2 ? 50 : 0);
    }
  }
  const inComp = new Set(comp);
  const bonds = mol.bonds.filter((b) => inComp.has(b.a) && inComp.has(b.b));
  for (let i = 0; i < bonds.length; i++) {
    for (let j = i + 1; j < bonds.length; j++) {
      const p = bonds[i];
      const q = bonds[j];
      if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue;
      if (segmentsCross(coords[p.a], coords[p.b], coords[q.a], coords[q.b])) score += 10;
    }
  }
  return score;
}

function sideOf(mol: Molecule, start: number, blocked: number): number[] {
  const seen = new Set([start, blocked]);
  const out = [start];
  for (let i = 0; i < out.length; i++) {
    for (const w of mol.neighbors(out[i])) {
      if (!seen.has(w)) {
        seen.add(w);
        out.push(w);
      }
    }
  }
  return out;
}

function refineOverlaps(mol: Molecule, comp: number[], coords: Vec[], info: RingInfo) {
  const compSet = new Set(comp);
  const stereoBonds = new Set(mol.doubleBondStereo.map((s) => s.bond));
  const flippable = mol.bonds.filter(
    (b) =>
      compSet.has(b.a) &&
      !info.bondInRing[b.index] &&
      !stereoBonds.has(b.index) &&
      mol.degree(b.a) > 1 &&
      mol.degree(b.b) > 1,
  );
  type Move = { atoms: number[]; apply: (p: Vec) => Vec; cost: number };
  let current = congestion(mol, comp, coords);
  let stretches = 0;
  for (let iter = 0; iter < 16 && current > 1e-3; iter++) {
    let bestScore = current;
    let bestMove: Move | undefined;
    const tryMove = (move: Move) => {
      const saved = move.atoms.map((a) => coords[a]);
      for (const a of move.atoms) coords[a] = move.apply(coords[a]);
      const s = congestion(mol, comp, coords) + move.cost;
      move.atoms.forEach((a, i) => (coords[a] = saved[i]));
      if (s < bestScore - 1e-6) {
        bestScore = s;
        bestMove = move;
      }
    };
    for (const bond of flippable) {
      const sideA = sideOf(mol, bond.a, bond.b);
      const sideB = sideOf(mol, bond.b, bond.a);
      if (sideA.includes(bond.b)) continue; // bond inside a cycle (should not happen)
      const [moving, pivot, tip] = sideA.length <= sideB.length ? [sideA, bond.b, bond.a] : [sideB, bond.a, bond.b];
      const pa = coords[bond.a];
      const pb = coords[bond.b];
      tryMove({ atoms: moving, apply: (p) => reflect(p, pa, pb), cost: 0 });
      // Last resort (crowded full structural formulas): lengthen the branch bond, as
      // textbooks do when a branch's hydrogens would collide with its neighbours'.
      if (moving.length <= 8 && stretches < 4) {
        const d = norm(sub(coords[tip], coords[pivot]));
        tryMove({ atoms: moving, apply: (p) => add(p, d), cost: 4 });
      }
    }
    if (!bestMove) break;
    const move: Move = bestMove;
    for (const a of move.atoms) coords[a] = move.apply(coords[a]);
    if (move.cost > 0) stretches++;
    current = bestScore - move.cost;
  }
}

// ---------------------------------------------------------------------------
// Orientation and arrangement

/** Rough priority of a substituent for the upright pose: acids and esters first. */
function substituentRank(mol: Molecule, ringAtom: number, first: number): number {
  const a = mol.atoms[first];
  const nbrs = mol.neighbors(first).filter((x) => x !== ringAtom);
  const has = (el: string, order: number) =>
    nbrs.some((x) => mol.atoms[x].element === el && mol.bondBetween(first, x)!.order === order);
  if (a.abbreviation) return a.abbreviation.right.startsWith('CO') ? 90 : 72;
  if (a.element === 'C' && has('O', 2) && has('O', 1)) return 90;
  if (a.element === 'C' && has('O', 2) && has('N', 1)) return 80;
  if (a.element === 'C' && has('N', 3)) return 75;
  if (a.element === 'C' && has('O', 2)) return 70;
  if (a.element === 'O' && a.hydrogens > 0) return 60;
  if (a.element === 'N') return 55;
  if (a.element === 'S') return 50;
  if (a.element === 'O') return 40;
  if (['F', 'Cl', 'Br', 'I'].includes(a.element)) return 20;
  return 30;
}

/**
 * For the upright pose: the bond (ring atom -> substituent) that should point up, or
 * undefined when the molecule does not have a single ring with 1 or 2 (ortho/meta) groups.
 */
type Upright = { kind: 'up'; bond: [number, number] } | { kind: 'para'; bond: [number, number]; other: [number, number] };

function uprightBond(mol: Molecule, comp: number[], info: RingInfo): Upright | undefined {
  const compSet = new Set(comp);
  const systems = info.systems.filter((sys) => compSet.has(info.rings[sys[0]][0]));
  if (systems.length !== 1 || systems[0].length !== 1) return undefined;
  const ring = info.rings[systems[0][0]];
  const subs: Array<[number, number]> = [];
  for (const r of ring) {
    for (const n of mol.neighbors(r)) {
      if (!ring.includes(n) && mol.atoms[n].element !== 'H') subs.push([r, n]);
    }
  }
  if (subs.length === 0 || subs.length > 2) return undefined;
  if (subs.length === 2) {
    const i = ring.indexOf(subs[0][0]);
    const j = ring.indexOf(subs[1][0]);
    const gap = Math.min(Math.abs(i - j), ring.length - Math.abs(i - j));
    if (gap === 0) return undefined;
    if (gap >= ring.length / 2) {
      // Para: the booklets lay the axis rising to the right, the bigger group on the right.
      const size = (s: [number, number]) => branchSize(mol, s[0], s[1]);
      const [small, big] = size(subs[0]) <= size(subs[1]) ? subs : [subs[1], subs[0]];
      return { kind: 'para', bond: big, other: small };
    }
  }
  const bond = subs.sort((p, q) => substituentRank(mol, q[0], q[1]) - substituentRank(mol, p[0], p[1]))[0];
  return { kind: 'up', bond };
}

function branchSize(mol: Molecule, from: number, start: number): number {
  const seen = new Set([from, start]);
  const q = [start];
  let n = 0;
  for (let i = 0; i < q.length; i++) {
    if (mol.atoms[q[i]].element !== 'H') n += mol.atoms[q[i]].members?.length ?? 1;
    for (const w of mol.neighbors(q[i])) if (!seen.has(w)) (seen.add(w), q.push(w));
  }
  return n;
}

function orient(
  mol: Molecule,
  comp: number[],
  coords: Vec[],
  info: RingInfo,
  rotationStep?: number,
  pose: 'landscape' | 'upright' = 'landscape',
) {
  if (comp.length < 2) return;
  const upright = pose === 'upright' ? uprightBond(mol, comp, info) : undefined;
  const carbonylOf = upright
    ? mol
        .neighbors(upright.bond[1])
        .find((x) => mol.atoms[x].element === 'O' && mol.degree(x) === 1 && mol.bondBetween(upright.bond[1], x)!.order === 2)
    : undefined;
  const compSet = new Set(comp);
  const hasRings = comp.some((a) => info.atomRings[a].length > 0);
  const c = centroid(comp.map((a) => coords[a]));
  const base = comp.map((a) => sub(coords[a], c));
  const index = new Map(comp.map((a, i) => [a, i]));
  const hetero = comp.map((a) => !['C', 'H'].includes(mol.atoms[a].element));
  const condensed = comp.map((a) => !!mol.atoms[a].abbreviation);
  const carbonylO = comp.map(
    (a) => mol.atoms[a].element === 'O' && mol.degree(a) === 1 && mol.bonds[mol.adjacency[a][0]].order === 2,
  );
  // The largest fused system decides the pose of steroids, PAHs and friends.
  const systems = info.systems
    .filter((sys) => compSet.has(info.rings[sys[0]][0]))
    .sort((p, q) => q.length - p.length);
  const mainSystem = systems[0] && systems[0].length >= 2 ? systems[0] : undefined;
  const systemAtoms = mainSystem ? [...new Set(mainSystem.flatMap((ri) => info.rings[ri]))].map((a) => index.get(a)!) : [];
  const ringCenters = mainSystem ? mainSystem.map((ri) => info.rings[ri].map((a) => index.get(a)!)) : [];

  const extent = (pts: Vec[], ids?: number[]) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const i of ids ?? pts.keys()) {
      const p = pts[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return maxX - minX - (maxY - minY);
  };
  const q = (v: number) => Math.round(v * 2);

  let best: Vec[] = base;
  let bestKey: number[] | undefined;
  // Rings keep their textbook pose (vertical hexagon sides), so they turn in 60° steps;
  // open chains may also turn by 30° (e.g. to lay ethene or a triple bond flat).
  const step = rotationStep ? (hasRings ? Math.max(rotationStep, 180) : rotationStep) : hasRings ? 60 : 30;
  for (const mirror of [false, true]) {
    for (let k = 0; k < 360 / step; k++) {
      const pts = base.map((p) => rotate(mirror ? vec(-p.x, p.y) : p, k * step * DEG));
      let hx = 0;
      let hy = 0;
      let oy = 0;
      let ax = 0;
      pts.forEach((p, i) => {
        if (condensed[i]) ax += p.x;
        if (hetero[i]) {
          hx += p.x;
          hy += p.y;
        }
        if (carbonylO[i]) oy += p.y;
      });
      // Fused systems read best rising from lower left to upper right, with the
      // smaller rings (steroid ring D, the imidazole of purines) on the right.
      let rising = 0;
      let smallX = 0;
      let smallY = 0;
      for (const ring of ringCenters) {
        const rc = centroid(ring.map((i) => pts[i]));
        rising += rc.x * rc.y;
        const w = 6 - ring.length;
        smallX += w * rc.x;
        smallY += w * rc.y;
      }
      const big = ringCenters.length >= 3 ? q(rising) : 0;
      // Last resort: bonds on the textbook grid (horizontal, vertical, ±30°).
      let onGrid = 0;
      for (const b of mol.bonds) {
        const ia = index.get(b.a);
        const ib = index.get(b.b);
        if (ia === undefined || ib === undefined) continue;
        const deg = ((Math.atan2(pts[ib].y - pts[ia].y, pts[ib].x - pts[ia].x) / DEG) % 180 + 180) % 180;
        if ([0, 30, 90, 150, 180].some((g) => Math.abs(deg - g) < 1)) onGrid++;
      }
      let up = 0;
      if (upright) {
        const ia = index.get(upright.bond[0])!;
        const ib = index.get(upright.bond[1])!;
        const dir = Math.atan2(pts[ib].y - pts[ia].y, pts[ib].x - pts[ia].x);
        const target = upright.kind === 'up' ? Math.PI / 2 : Math.PI / 6;
        up = Math.abs(dir - target) < 0.05 ? 2 : 0;
        // Booklets put the C=O of the top group up-left (O=C–H, O=C–OH).
        if (up && upright.kind === 'up' && carbonylOf !== undefined) {
          const io = index.get(carbonylOf)!;
          if (pts[io].x < pts[ib].x - 1e-6) up += 1;
        }
      }
      const key = [
        up,
        systemAtoms.length ? q(extent(pts, systemAtoms)) : 0,
        q(extent(pts)),
        big,
        q(smallX),
        q(smallY),
        q(ax),
        q(hx),
        q(oy),
        q(hy),
        q(rising),
        onGrid,
      ];
      let better = !bestKey;
      if (bestKey) {
        for (let i = 0; i < key.length; i++) {
          if (key[i] !== bestKey[i]) {
            better = key[i] > bestKey[i];
            break;
          }
        }
      }
      if (better) {
        bestKey = key;
        best = pts;
      }
    }
  }
  comp.forEach((a, i) => (coords[a] = best[i]));
}

function arrangeComponents(mol: Molecule, components: number[][], coords: Vec[]) {
  let cursor = 0;
  for (const comp of components) {
    const xs = comp.map((a) => coords[a].x);
    const ys = comp.map((a) => coords[a].y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const edgeLabelled = (x: number) => comp.some((a) => Math.abs(coords[a].x - x) < 0.3 && mol.atoms[a].element !== 'C');
    const leftPad = cursor === 0 ? 0 : edgeLabelled(minX) ? 0.45 : 0.15;
    const rightPad = edgeLabelled(maxX) ? 0.45 : 0.15;
    const shift = vec(cursor - minX + leftPad, -midY);
    for (const a of comp) coords[a] = add(coords[a], shift);
    cursor = maxX + shift.x + 0.75 + rightPad;
  }
}
