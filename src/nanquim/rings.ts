/**
 * Ring perception: a minimum cycle basis (SSSR) via Horton's candidate set and
 * Gaussian elimination over GF(2). Molecules drawn here are small, so the simple
 * O(V·E) candidate generation is plenty fast.
 */
import type { Molecule } from './molecule.ts';

interface Candidate {
  atoms: number[];
  bonds: bigint;
  size: number;
}

/** Shortest-path tree (BFS parents) from root. */
function bfsTree(mol: Molecule, root: number) {
  const n = mol.atoms.length;
  const parent = new Int32Array(n).fill(-2);
  const depth = new Int32Array(n).fill(-1);
  parent[root] = -1;
  depth[root] = 0;
  const queue = [root];
  for (let qi = 0; qi < queue.length; qi++) {
    const v = queue[qi];
    for (const w of mol.neighbors(v)) {
      if (depth[w] < 0) {
        depth[w] = depth[v] + 1;
        parent[w] = v;
        queue.push(w);
      }
    }
  }
  return { parent, depth };
}

function pathToRoot(parent: Int32Array, v: number): number[] {
  const path = [v];
  while (parent[v] >= 0) {
    v = parent[v];
    path.push(v);
  }
  return path;
}

export function findRings(mol: Molecule): number[][] {
  const n = mol.atoms.length;
  const comps = mol.components().length;
  const cyclomatic = mol.bonds.length - n + comps;
  if (cyclomatic <= 0) return [];

  // Only atoms on cycles matter: strip tree-like parts by repeatedly removing degree-1 atoms.
  const deg = mol.adjacency.map((a) => a.length);
  const removed = new Array<boolean>(n).fill(false);
  const stack: number[] = [];
  for (let v = 0; v < n; v++) if (deg[v] <= 1) stack.push(v);
  while (stack.length) {
    const v = stack.pop()!;
    if (removed[v]) continue;
    removed[v] = true;
    for (const w of mol.neighbors(v)) {
      if (!removed[w] && --deg[w] <= 1) stack.push(w);
    }
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (let r = 0; r < n; r++) {
    if (removed[r]) continue;
    const { parent, depth } = bfsTree(mol, r);
    for (const bond of mol.bonds) {
      const { a: x, b: y } = bond;
      if (removed[x] || removed[y] || depth[x] < 0 || depth[y] < 0) continue;
      if (parent[x] === y || parent[y] === x) continue;
      const px = pathToRoot(parent, x);
      const py = pathToRoot(parent, y);
      // Paths must only share the root.
      const setX = new Set(px);
      let shared = 0;
      for (const v of py) if (setX.has(v)) shared++;
      if (shared !== 1) continue;
      const cycle = [...px, ...py.slice(0, -1).reverse()];
      const key = [...cycle].sort((p, q) => p - q).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      let mask = 0n;
      for (let k = 0; k < cycle.length; k++) {
        const b = mol.bondBetween(cycle[k], cycle[(k + 1) % cycle.length]);
        if (!b) {
          mask = -1n;
          break;
        }
        mask |= 1n << BigInt(b.index);
      }
      if (mask < 0n) continue;
      candidates.push({ atoms: cycle, bonds: mask, size: cycle.length });
    }
  }
  candidates.sort((p, q) => p.size - q.size || p.atoms[0] - q.atoms[0]);

  // Greedy independent selection (Gaussian elimination over GF(2)).
  const basis: bigint[] = [];
  const pivots: bigint[] = [];
  const rings: number[][] = [];
  for (const c of candidates) {
    let v = c.bonds;
    for (let k = 0; k < basis.length; k++) {
      if (v & pivots[k]) v ^= basis[k];
    }
    if (v === 0n) continue;
    const pivot = v & -v;
    // Keep the basis reduced so every pivot appears in exactly one row.
    for (let k = 0; k < basis.length; k++) {
      if (basis[k] & pivot) basis[k] ^= v;
    }
    basis.push(v);
    pivots.push(pivot);
    rings.push(c.atoms);
    if (rings.length === cyclomatic) break;
  }
  return rings;
}

export interface RingInfo {
  rings: number[][];
  /** Ring indices each atom belongs to. */
  atomRings: number[][];
  /** For each bond, whether it is part of any ring. */
  bondInRing: boolean[];
  /** Groups of ring indices connected through shared atoms (fused, spiro or bridged systems). */
  systems: number[][];
}

export function ringInfo(mol: Molecule, rings: number[][]): RingInfo {
  const atomRings: number[][] = mol.atoms.map(() => []);
  rings.forEach((ring, ri) => ring.forEach((a) => atomRings[a].push(ri)));
  const bondInRing = mol.bonds.map(() => false);
  for (const ring of rings) {
    for (let k = 0; k < ring.length; k++) {
      const b = mol.bondBetween(ring[k], ring[(k + 1) % ring.length]);
      if (b) bondInRing[b.index] = true;
    }
  }
  // Union rings that share at least one atom.
  const parent = rings.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const list of atomRings) {
    for (let k = 1; k < list.length; k++) parent[find(list[k])] = find(list[0]);
  }
  const groups = new Map<number, number[]>();
  rings.forEach((_, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  });
  return { rings, atomRings, bondInRing, systems: [...groups.values()] };
}
