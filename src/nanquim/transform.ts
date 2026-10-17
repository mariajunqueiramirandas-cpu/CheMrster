/**
 * Rewrites applied before layout to follow a house style: condensed group labels
 * (COOH, NO2, ...), selectively explicit hydrogens, and sub-molecules. Every atom keeps
 * `source`, the index of the atom it came from, so callers can keep addressing the
 * molecule they parsed.
 */
import { Molecule } from './molecule.ts';

export type AbbreviationName = 'COOH' | 'COO-' | 'CHO' | 'CN' | 'NO2' | 'SO3H';

const TEXT: Record<AbbreviationName, { right: string; left: string }> = {
  COOH: { right: 'COOH', left: 'HOOC' },
  'COO-': { right: 'COO−', left: '−OOC' },
  CHO: { right: 'CHO', left: 'OHC' },
  CN: { right: 'CN', left: 'NC' },
  NO2: { right: 'NO2', left: 'O2N' },
  SO3H: { right: 'SO3H', left: 'HO3S' },
};

export const ALL_ABBREVIATIONS = Object.keys(TEXT) as AbbreviationName[];

/** Give every atom a `source` pointing at itself (the starting point of any rewrite). */
export function markSources(mol: Molecule): Molecule {
  for (const a of mol.atoms) if (a.source === undefined) a.source = a.index;
  return mol;
}

/** Copy of the atoms in `keep` (in that order) and the bonds between them. */
export function subset(mol: Molecule, keep: number[]): { mol: Molecule; map: Map<number, number> } {
  const out = new Molecule();
  out.title = mol.title;
  const map = new Map<number, number>();
  for (const i of keep) {
    const a = mol.atoms[i];
    map.set(i, out.addAtom({ ...a, stereoOrder: a.stereoOrder && [...a.stereoOrder] }));
  }
  for (const b of mol.bonds) {
    const a = map.get(b.a);
    const c = map.get(b.b);
    if (a === undefined || c === undefined) continue;
    const bi = out.addBond(a, c, b.order, b.aromatic);
    out.bonds[bi].direction = b.direction;
    out.bonds[bi].display = b.display;
  }
  for (const atom of out.atoms) {
    if (!atom.stereoOrder) continue;
    const order = atom.stereoOrder.map((n) => (n < 0 ? n : (map.get(n) ?? -2)));
    if (order.includes(-2)) {
      atom.stereoOrder = undefined;
      atom.chirality = undefined;
    } else {
      atom.stereoOrder = order;
    }
  }
  out.rings = mol.rings.filter((r) => r.every((x) => map.has(x))).map((r) => r.map((x) => map.get(x)!));
  out.doubleBondStereo = mol.doubleBondStereo
    .filter((s) => [s.a, s.b, s.x, s.y].every((x) => map.has(x)))
    .map((s) => {
      const bond = out.bondBetween(map.get(s.a)!, map.get(s.b)!);
      return { ...s, bond: bond!.index, a: map.get(s.a)!, b: map.get(s.b)!, x: map.get(s.x)!, y: map.get(s.y)! };
    });
  return { mol: out, map };
}

/** Copy of `mol` where the implicit hydrogens of the picked atoms become real atoms. */
export function addHydrogens(mol: Molecule, pick: (atom: number) => boolean): Molecule {
  const { mol: out } = subset(mol, mol.atoms.map((a) => a.index));
  for (const a of mol.atoms) {
    if (!a.hydrogens || !pick(a.index)) continue;
    for (let k = 0; k < a.hydrogens; k++) {
      const h = out.addAtom({ element: 'H' });
      out.addBond(a.index, h);
      const order = out.atoms[a.index].stereoOrder;
      const slot = order?.indexOf(-1) ?? -1;
      if (order && slot >= 0) order[slot] = h;
    }
    out.atoms[a.index].hydrogens = 0;
  }
  return out;
}

const terminal = (mol: Molecule, i: number) => mol.degree(i) === 1;
const inRing = (mol: Molecule, i: number) => mol.rings.some((r) => r.includes(i));

/** The group anchored at `atom`, if it matches one of the abbreviations. */
function matchGroup(mol: Molecule, atom: number): { name: AbbreviationName; members: number[] } | undefined {
  const a = mol.atoms[atom];
  if (inRing(mol, atom)) return undefined;
  const nbrs = mol.neighbors(atom);
  const order = (n: number) => mol.bondBetween(atom, n)!.order;
  const oxygen = (n: number) => mol.atoms[n].element === 'O' && terminal(mol, n);
  const doubleO = nbrs.filter((n) => oxygen(n) && order(n) === 2);
  const singleO = nbrs.filter((n) => oxygen(n) && order(n) === 1);
  const rest = (members: number[]) => nbrs.filter((n) => !members.includes(n));
  if (a.element === 'C' && a.hydrogens === 0 && doubleO.length === 1 && singleO.length === 1 && nbrs.length === 3) {
    const o = singleO[0];
    if (mol.atoms[o].hydrogens === 1) return { name: 'COOH', members: [atom, doubleO[0], o] };
    if (mol.atoms[o].charge === -1) return { name: 'COO-', members: [atom, doubleO[0], o] };
  }
  if (a.element === 'C' && a.hydrogens === 1 && doubleO.length === 1 && nbrs.length === 2) {
    return { name: 'CHO', members: [atom, doubleO[0]] };
  }
  if (a.element === 'C' && nbrs.length === 2) {
    const n = nbrs.find((x) => mol.atoms[x].element === 'N' && order(x) === 3 && terminal(mol, x));
    if (n !== undefined) return { name: 'CN', members: [atom, n] };
  }
  if (a.element === 'N' && nbrs.length === 3) {
    const os = nbrs.filter(oxygen);
    if (os.length === 2 && rest([atom, ...os]).length === 1) return { name: 'NO2', members: [atom, ...os] };
  }
  if (a.element === 'S' && nbrs.length === 4 && doubleO.length === 2) {
    const oh = singleO.find((o) => mol.atoms[o].hydrogens === 1);
    if (oh !== undefined) return { name: 'SO3H', members: [atom, ...doubleO, oh] };
  }
  return undefined;
}

/**
 * Fold the requested functional groups into single labelled atoms, keeping the
 * anchor atom (the one bonded to the rest of the molecule) as the label's position.
 */
export function abbreviate(mol: Molecule, names: AbbreviationName[]): Molecule {
  if (!names.length) return mol;
  markSources(mol);
  const wanted = new Set(names);
  const dropped = new Set<number>();
  const anchors = new Map<number, { name: AbbreviationName; members: number[] }>();
  for (const a of mol.atoms) {
    if (dropped.has(a.index) || anchors.has(a.index)) continue;
    const g = matchGroup(mol, a.index);
    if (!g || !wanted.has(g.name)) continue;
    // Something must remain to attach to.
    if (mol.atoms.length - g.members.length < 1) continue;
    anchors.set(a.index, g);
    for (const m of g.members) if (m !== a.index) dropped.add(m);
  }
  if (!anchors.size) return mol;
  const keep = mol.atoms.map((a) => a.index).filter((i) => !dropped.has(i));
  const { mol: out, map } = subset(mol, keep);
  for (const [anchor, g] of anchors) {
    const atom = out.atoms[map.get(anchor)!];
    atom.abbreviation = TEXT[g.name];
    atom.hydrogens = 0;
    atom.charge = 0;
    atom.members = g.members.map((m) => mol.atoms[m].source ?? m);
  }
  return out;
}
