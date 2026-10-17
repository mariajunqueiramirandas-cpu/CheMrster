/**
 * Chemical perception: ring finding, kekulisation of aromatic input,
 * implicit hydrogens and cis/trans double-bond requirements.
 */
import { chargedValences, elementInfo } from './elements.ts';
import type { Molecule } from './molecule.ts';
import { findRings, ringInfo } from './rings.ts';

export class PerceptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PerceptionError';
  }
}

/** Valence used while kekulising: aromatic bonds count as 1. */
function usedValence(mol: Molecule, atom: number): number {
  let used = 0;
  for (const bi of mol.adjacency[atom]) {
    const b = mol.bonds[bi];
    used += b.aromatic ? 1 : b.order;
  }
  return used;
}

function needsPiBond(mol: Molecule, atom: number): boolean {
  const a = mol.atoms[atom];
  if (!a.aromatic) return false;
  if (!mol.adjacency[atom].some((bi) => mol.bonds[bi].aromatic)) return false;
  const used = usedValence(mol, atom) + (a.bracket ? a.hydrogens : 0);
  return chargedValences(a.element, a.charge)[0] - used >= 1;
}

/**
 * Assign alternating single/double bonds to aromatic bonds so that every atom that
 * needs a pi bond gets exactly one. Uses constrained backtracking (most-constrained
 * atom first), which is effectively linear for real molecules.
 */
export function kekulize(mol: Molecule): void {
  const aromaticBonds = mol.bonds.filter((b) => b.aromatic);
  if (!aromaticBonds.length) return;
  const needs = mol.atoms.map((_, i) => needsPiBond(mol, i));
  const matched = new Array<boolean>(mol.atoms.length).fill(false);
  const doubled = new Set<number>();
  const candidates = (atom: number) =>
    mol.adjacency[atom].filter((bi) => {
      const b = mol.bonds[bi];
      const other = mol.other(b, atom);
      return b.aromatic && needs[other] && !matched[other];
    });

  let budget = 200000;
  const solve = (): boolean => {
    if (--budget < 0) return false;
    let best = -1;
    let bestOptions: number[] = [];
    for (let i = 0; i < mol.atoms.length; i++) {
      if (!needs[i] || matched[i]) continue;
      const opts = candidates(i);
      if (opts.length === 0) return false;
      if (best < 0 || opts.length < bestOptions.length) {
        best = i;
        bestOptions = opts;
        if (opts.length === 1) break;
      }
    }
    if (best < 0) return true;
    for (const bi of bestOptions) {
      const other = mol.other(bi, best);
      matched[best] = matched[other] = true;
      doubled.add(bi);
      if (solve()) return true;
      doubled.delete(bi);
      matched[best] = matched[other] = false;
    }
    return false;
  };

  if (!solve()) {
    throw new PerceptionError('Não foi possível representar o anel aromático com ligações simples e duplas alternadas.');
  }
  for (const b of aromaticBonds) b.order = doubled.has(b.index) ? 2 : 1;
}

/** Fill in implicit hydrogens for organic-subset atoms (bracket atoms keep their explicit count). */
export function assignHydrogens(mol: Molecule): void {
  for (const a of mol.atoms) {
    if (a.bracket || a.element === '*') continue;
    const valences = elementInfo(a.element)?.valences ?? [0];
    const used = mol.bondOrderSum(a.index);
    const target = valences.find((v) => v >= used) ?? used;
    a.hydrogens = Math.max(0, target - used);
  }
}

function upwards(mol: Molecule, from: number, to: number): number | undefined {
  const b = mol.bondBetween(from, to);
  if (!b?.direction) return undefined;
  const sense = b.direction === '/' ? 1 : -1;
  return b.a === from ? sense : -sense;
}

/** Translate '/' and '\' marks into explicit cis/trans requirements on double bonds. */
export function perceiveDoubleBondStereo(mol: Molecule, bondInRing: boolean[], smallRingBond: boolean[]): void {
  mol.doubleBondStereo = [];
  for (const bond of mol.bonds) {
    if (bond.order !== 2 || bond.aromatic) continue;
    if (bondInRing[bond.index] && smallRingBond[bond.index]) continue;
    const pick = (center: number, partner: number) => {
      for (const nb of mol.neighbors(center)) {
        if (nb === partner) continue;
        const up = upwards(mol, center, nb);
        if (up !== undefined) return { atom: nb, up };
      }
      return undefined;
    };
    const x = pick(bond.a, bond.b);
    const y = pick(bond.b, bond.a);
    if (!x || !y) continue;
    mol.doubleBondStereo.push({ bond: bond.index, a: bond.a, b: bond.b, x: x.atom, y: y.atom, cis: x.up === y.up });
  }
}

/** Run the full perception pipeline in place. */
export function perceive(mol: Molecule): Molecule {
  const rings = findRings(mol);
  mol.rings = rings;
  const info = ringInfo(mol, rings);
  // Aromatic flags only make sense inside rings (e.g. biphenyl's central bond).
  for (const b of mol.bonds) {
    if (b.aromatic && !info.bondInRing[b.index]) b.aromatic = false;
  }
  for (const a of mol.atoms) {
    if (a.aromatic && !mol.adjacency[a.index].some((bi) => mol.bonds[bi].aromatic)) a.aromatic = false;
  }
  kekulize(mol);
  assignHydrogens(mol);
  const smallRingBond = mol.bonds.map(() => false);
  for (const ring of rings) {
    if (ring.length >= 8) continue;
    for (let k = 0; k < ring.length; k++) {
      const b = mol.bondBetween(ring[k], ring[(k + 1) % ring.length]);
      if (b) smallRingBond[b.index] = true;
    }
  }
  perceiveDoubleBondStereo(mol, info.bondInRing, smallRingBond);
  return mol;
}
