/**
 * Molecular graph toolkit for the reaction engine: a SMILES writer (keeps @/@@ and
 * cis/trans), a canonical key to tell whether two structures are the same substance,
 * symmetry classes of atoms, and `Draft`, an editable copy of a molecule whose
 * hydrogens are recomputed when it is written out.
 */
import { ORGANIC_SUBSET, elementInfo } from '../nanquim/elements.ts';
import { type Atom, Molecule, moleculeFromSmiles } from '../nanquim/index.ts';
import { assignHydrogens } from '../nanquim/perception.ts';

// ---------------------------------------------------------------------------
// Writing SMILES

interface WriteOptions {
  /** Atom ranks: start at the lowest and visit neighbours lowest first (canonical output). */
  ranks?: number[];
  /** Write @/@@ and / \ marks (default true). */
  stereo?: boolean;
  /** Treat these bonds as aromatic and their atoms as lowercase, whatever the Kekulé orders say. */
  aromaticBonds?: Set<number>;
}

/** Hydrogen count the parser infers for an organic-subset atom written without brackets. */
function defaultHydrogens(mol: Molecule, atom: number): number {
  const a = mol.atoms[atom];
  const valences = elementInfo(a.element)?.valences ?? [0];
  const used = mol.bondOrderSum(atom);
  const target = valences.find((v) => v >= used) ?? used;
  return Math.max(0, target - used);
}

const isAromaticAtom = (mol: Molecule, i: number, aroBonds?: Set<number>) =>
  aroBonds ? mol.adjacency[i].some((bi) => aroBonds.has(bi)) : mol.atoms[i].aromatic;

function atomText(mol: Molecule, i: number, chirality: string, opts: WriteOptions): string {
  const a = mol.atoms[i];
  const aromatic = isAromaticAtom(mol, i, opts.aromaticBonds);
  const symbol = aromatic ? a.element.toLowerCase() : a.element;
  if (a.element === '*') return a.mapNumber !== undefined ? `[*:${a.mapNumber}]` : '*';
  const plain =
    ORGANIC_SUBSET.has(a.element) &&
    !a.charge &&
    a.isotope === undefined &&
    a.mapNumber === undefined &&
    !chirality &&
    // Aromatic N/P/... with H must say so ([nH]); the parser would not infer it.
    !(aromatic && a.element !== 'C' && a.hydrogens > 0) &&
    a.hydrogens === defaultHydrogens(mol, i);
  if (plain) return symbol;
  const h = a.hydrogens ? (a.hydrogens === 1 ? 'H' : `H${a.hydrogens}`) : '';
  const q = a.charge ? `${a.charge > 0 ? '+' : '-'}${Math.abs(a.charge) > 1 ? Math.abs(a.charge) : ''}` : '';
  const map = a.mapNumber !== undefined ? `:${a.mapNumber}` : '';
  return `[${a.isotope ?? ''}${symbol}${chirality}${h}${q}${map}]`;
}

/** Parity of the permutation taking `from` to `to` (same elements): true when even. */
function evenPermutation(from: number[], to: number[]): boolean {
  const pos = to.map((x) => from.indexOf(x));
  let even = true;
  const seen = pos.map(() => false);
  for (let i = 0; i < pos.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = pos[j]) {
      seen[j] = true;
      len++;
    }
    if (len % 2 === 0) even = !even;
  }
  return even;
}

/** SMILES for `mol`, plus the order in which atoms were written. */
export function writeSmiles(mol: Molecule, opts: WriteOptions = {}): { smiles: string; order: number[] } {
  const stereo = opts.stereo !== false;
  const rank = opts.ranks ?? mol.atoms.map((a) => a.index);
  const byRank = (p: number, q: number) => rank[p] - rank[q] || p - q;
  const visited = new Array<boolean>(mol.atoms.length).fill(false);
  const parent = new Array<number>(mol.atoms.length).fill(-1);
  const children: number[][] = mol.atoms.map(() => []);
  const ringBonds: number[][] = mol.atoms.map(() => []);
  const treeBond = new Set<number>();
  const order: number[] = [];

  // Pass 1: spanning tree and ring-closure bonds.
  const roots: number[] = [];
  const atomsByRank = mol.atoms.map((a) => a.index).sort(byRank);
  for (const start of atomsByRank) {
    if (visited[start]) continue;
    roots.push(start);
    const dfs = (v: number) => {
      visited[v] = true;
      for (const w of mol.neighbors(v).sort(byRank)) {
        const bond = mol.bondBetween(v, w)!;
        if (!visited[w]) {
          parent[w] = v;
          children[v].push(w);
          treeBond.add(bond.index);
          dfs(w);
        } else if (w !== parent[v] && !treeBond.has(bond.index) && !ringBonds[v].includes(bond.index)) {
          ringBonds[v].push(bond.index);
          ringBonds[w].push(bond.index);
        }
      }
    };
    dfs(start);
  }

  const aroBond = (bi: number) => (opts.aromaticBonds ? opts.aromaticBonds.has(bi) : mol.bonds[bi].aromatic);
  const hasDoubleNeighbor = (x: number) =>
    mol.adjacency[x].some((bi) => mol.bonds[bi].order === 2 && !aroBond(bi));
  const bondText = (bi: number, from: number) => {
    const b = mol.bonds[bi];
    const to = mol.other(b, from);
    if (aroBond(bi)) return '';
    if (b.order === 2) return '=';
    if (b.order === 3) return '#';
    if (b.order === 4) return '$';
    if (stereo && b.direction && (hasDoubleNeighbor(from) || hasDoubleNeighbor(to))) {
      return b.a === from ? b.direction : b.direction === '/' ? '\\' : '/';
    }
    return isAromaticAtom(mol, from, opts.aromaticBonds) && isAromaticAtom(mol, to, opts.aromaticBonds) ? '-' : '';
  };

  // Pass 2: write, handing out ring-closure digits as rings open.
  const digitOf = new Map<number, number>();
  const free: number[] = [];
  let nextDigit = 1;
  const takeDigit = () => (free.length ? free.sort((p, q) => p - q).shift()! : nextDigit++);
  const digitText = (d: number) => (d < 10 ? String(d) : `%${d}`);
  const written = new Array<boolean>(mol.atoms.length).fill(false);

  const emit = (v: number): string => {
    written[v] = true;
    order.push(v);
    // Ring digits in a stable order: closings first (partner already written), then openings.
    const rings = [...ringBonds[v]].sort((p, q) => {
      const wp = written[mol.other(p, v)] ? 0 : 1;
      const wq = written[mol.other(q, v)] ? 0 : 1;
      return wp - wq || byRank(mol.other(p, v), mol.other(q, v));
    });
    let ringText = '';
    const ringPartners: number[] = [];
    for (const bi of rings) {
      const partner = mol.other(bi, v);
      ringPartners.push(partner);
      if (digitOf.has(bi)) {
        const d = digitOf.get(bi)!;
        ringText += digitText(d);
        digitOf.delete(bi);
        free.push(d);
      } else {
        const d = takeDigit();
        digitOf.set(bi, d);
        ringText += bondText(bi, v) + digitText(d);
      }
    }
    let chirality = '';
    const a = mol.atoms[v];
    if (stereo && a.chirality && a.stereoOrder) {
      const now = [...(parent[v] >= 0 ? [parent[v]] : []), ...(a.hydrogens ? [-1] : []), ...ringPartners, ...children[v]];
      const before = a.stereoOrder;
      if (now.length === before.length && now.every((x) => before.includes(x))) {
        chirality = evenPermutation(before, now) ? a.chirality : a.chirality === '@' ? '@@' : '@';
      }
    }
    let out = atomText(mol, v, chirality, opts) + ringText;
    children[v].forEach((c, k) => {
      const bi = mol.bondBetween(v, c)!.index;
      const branch = bondText(bi, v) + emit(c);
      out += k < children[v].length - 1 ? `(${branch})` : branch;
    });
    return out;
  };

  const parts = roots.map((r) => emit(r));
  return { smiles: parts.join('.'), order };
}

export function toSmiles(mol: Molecule): string {
  return writeSmiles(mol).smiles;
}

// ---------------------------------------------------------------------------
// Identity

const asMolecule = (m: string | Molecule) => (typeof m === 'string' ? moleculeFromSmiles(m) : m);

/** Six-membered all-carbon rings with aromatic or alternating bonds, as one bond set. */
function benzenoidBonds(mol: Molecule): Set<number> {
  const out = new Set<number>();
  for (const ring of mol.rings) {
    const bonds = ring.map((a, k) => mol.bondBetween(a, ring[(k + 1) % ring.length])!);
    const aromatic = bonds.every((b) => b.aromatic);
    const alternating =
      ring.length === 6 &&
      bonds.filter((b) => b.order === 2).length === 3 &&
      bonds.every((b, k) => b.order !== bonds[(k + 1) % 6].order);
    if (aromatic || alternating) for (const b of bonds) out.add(b.index);
  }
  return out;
}

/**
 * Morgan-style refinement of atom invariants. Returns one class number per atom;
 * atoms in the same class are topologically equivalent (as far as the refinement can tell).
 */
function refine(mol: Molecule, aro: Set<number>, initial?: number[]): number[] {
  const n = mol.atoms.length;
  const ringCount = mol.atoms.map((a) => mol.rings.filter((r) => r.includes(a.index)).length);
  const bondCode = (bi: number) => (aro.has(bi) ? 'a' : String(mol.bonds[bi].order));
  let labels =
    initial?.map(String) ??
    mol.atoms.map((a) =>
      [a.element, a.charge, a.isotope ?? '', a.hydrogens, mol.degree(a.index), ringCount[a.index], a.mapNumber ?? ''].join('|'),
    );
  let classes = rankStrings(labels);
  for (let iter = 0; iter < n + 1; iter++) {
    labels = mol.atoms.map((a) => {
      const around = mol.adjacency[a.index].map((bi) => `${bondCode(bi)}${classes[mol.other(bi, a.index)]}`).sort();
      return `${classes[a.index]}:${around.join(',')}`;
    });
    const next = rankStrings(labels);
    const before = new Set(classes).size;
    classes = next;
    if (new Set(next).size === before) break;
  }
  return classes;
}

/** Dense ranks (0, 1, 2...) of strings, in sorted order. */
function rankStrings(labels: string[]): number[] {
  const sorted = [...new Set(labels)].sort();
  const index = new Map(sorted.map((s, i) => [s, i]));
  return labels.map((l) => index.get(l)!);
}

/** Symmetry class of every atom: equal numbers mean equivalent positions (same substitution product). */
export function symmetryClasses(input: string | Molecule): number[] {
  const mol = asMolecule(input);
  return refine(mol, benzenoidBonds(mol));
}

/** Canonical ranks: symmetry classes with ties broken one at a time. */
function canonicalRanks(mol: Molecule, aro: Set<number>): number[] {
  let ranks = refine(mol, aro);
  for (let guard = 0; guard < mol.atoms.length; guard++) {
    const counts = new Map<number, number>();
    for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
    const tied = [...counts.entries()].filter(([, c]) => c > 1).map(([r]) => r);
    if (!tied.length) break;
    const lowest = Math.min(...tied);
    const pickAtom = ranks.indexOf(lowest);
    const seeded = ranks.map((r, i) => r * 2 + (r > lowest || (r === lowest && i !== pickAtom) ? 1 : 0));
    ranks = refine(mol, aro, seeded);
  }
  return ranks;
}

/**
 * A string that is the same for two structures exactly when they are the same substance
 * (stereochemistry ignored; Kekulé and aromatic benzene rings compare equal).
 */
export function canonicalKey(input: string | Molecule): string {
  const mol = asMolecule(input);
  const aro = benzenoidBonds(mol);
  const ranks = canonicalRanks(mol, aro);
  // Components in a stable order: write each, then sort the pieces.
  const { smiles } = writeSmiles(mol, { ranks, stereo: false, aromaticBonds: aro });
  return smiles.split('.').sort().join('.');
}

export function sameMolecule(a: string | Molecule, b: string | Molecule): boolean {
  return canonicalKey(a) === canonicalKey(b);
}

/** Distinct structures only (first of each kept), compared by canonical key. */
export function uniqueBy<T>(items: T[], smilesOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = canonicalKey(smilesOf(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Editing

interface DraftBond {
  a: number;
  b: number;
  order: number;
  aromatic: boolean;
  direction?: '/' | '\\';
}

/**
 * An editable copy of a molecule. Atoms keep their indices while you edit; removed atoms
 * are dropped when the draft is written. Organic-subset atoms get their hydrogens
 * recomputed, so changing a C=C to C–C turns CH into CH₂ by itself.
 */
export class Draft {
  readonly atoms: Atom[];
  private bonds: (DraftBond | undefined)[];
  private readonly removed = new Set<number>();

  constructor(source: string | Molecule) {
    const mol = asMolecule(source);
    this.atoms = mol.atoms.map((a) => ({ ...a, stereoOrder: a.stereoOrder && [...a.stereoOrder] }));
    this.bonds = mol.bonds.map((b) => ({ a: b.a, b: b.b, order: b.order, aromatic: b.aromatic, direction: b.direction }));
  }

  private findBond(a: number, b: number): DraftBond | undefined {
    return this.bonds.find((x) => x && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  }

  neighbors(atom: number): number[] {
    const out: number[] = [];
    for (const b of this.bonds) {
      if (!b) continue;
      if (b.a === atom && !this.removed.has(b.b)) out.push(b.b);
      else if (b.b === atom && !this.removed.has(b.a)) out.push(b.a);
    }
    return out;
  }

  order(a: number, b: number): number {
    return this.findBond(a, b)?.order ?? 0;
  }

  /** Bonding changed: stereo marks around the atom no longer describe it. */
  private touched(atom: number) {
    const a = this.atoms[atom];
    a.chirality = undefined;
    a.stereoOrder = undefined;
    // A bracket kept only for stereo or an explicit H count can go back to the organic subset.
    if (a.bracket && !a.charge && a.isotope === undefined && a.mapNumber === undefined && ORGANIC_SUBSET.has(a.element)) {
      a.bracket = false;
    }
  }

  addAtom(element: string, opts: { charge?: number; hydrogens?: number } = {}): number {
    const index = this.atoms.length;
    const bracket = !!opts.charge || opts.hydrogens !== undefined || !ORGANIC_SUBSET.has(element);
    this.atoms.push({
      index,
      element,
      aromatic: false,
      charge: opts.charge ?? 0,
      hydrogens: opts.hydrogens ?? 0,
      bracket: bracket && element !== '*',
    });
    return index;
  }

  bond(a: number, b: number, order = 1): void {
    const existing = this.findBond(a, b);
    if (existing) existing.order = order;
    else this.bonds.push({ a, b, order, aromatic: false });
    for (const x of [a, b]) {
      const atom = this.atoms[x];
      if (atom.bracket && atom.hydrogens > 0) atom.hydrogens = Math.max(0, atom.hydrogens - order);
      this.touched(x);
    }
  }

  setOrder(a: number, b: number, order: number): void {
    const bond = this.findBond(a, b);
    if (!bond) throw new Error(`No bond ${a}-${b}`);
    bond.order = order;
    bond.aromatic = false;
    this.touched(a);
    this.touched(b);
  }

  unbond(a: number, b: number): void {
    const i = this.bonds.findIndex((x) => x && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
    if (i < 0) return;
    this.bonds[i] = undefined;
    this.touched(a);
    this.touched(b);
  }

  remove(atom: number): void {
    for (const n of this.neighbors(atom)) this.unbond(atom, n);
    this.removed.add(atom);
  }

  /** Bond the first atom of a SMILES fragment ('Cl', '[N+](=O)[O-]', 'C(=O)O') to `atom`. Returns the fragment's atom indices. */
  attach(atom: number, fragment: string, order = 1): number[] {
    const frag = moleculeFromSmiles(fragment);
    const map = frag.atoms.map((a) => {
      const i = this.atoms.length;
      this.atoms.push({ ...a, index: i, stereoOrder: undefined, chirality: undefined });
      return i;
    });
    for (const b of frag.bonds) this.bonds.push({ a: map[b.a], b: map[b.b], order: b.order, aromatic: b.aromatic });
    this.bond(atom, map[0], order);
    return map;
  }

  /** Make an atom an ion (carboxylate O⁻, Na⁺...) with an exact hydrogen count. */
  charge(atom: number, charge: number, hydrogens = 0): void {
    const a = this.atoms[atom];
    a.charge = charge;
    a.hydrogens = hydrogens;
    a.bracket = true;
  }

  /** A clean molecule (indices renumbered without removed atoms), hydrogens recomputed. */
  build(): Molecule {
    const mol = new Molecule();
    const map = new Map<number, number>();
    for (const a of this.atoms) {
      if (this.removed.has(a.index)) continue;
      map.set(a.index, mol.addAtom({ ...a, stereoOrder: undefined }));
    }
    for (const a of this.atoms) {
      const i = map.get(a.index);
      if (i === undefined || !a.stereoOrder) continue;
      const order = a.stereoOrder.map((n) => (n < 0 ? n : (map.get(n) ?? -2)));
      if (order.includes(-2)) mol.atoms[i].chirality = undefined;
      else mol.atoms[i].stereoOrder = order;
    }
    for (const b of this.bonds) {
      if (!b || !map.has(b.a) || !map.has(b.b)) continue;
      const bi = mol.addBond(map.get(b.a)!, map.get(b.b)!, b.order, b.aromatic);
      if (b.direction) mol.bonds[bi].direction = b.direction;
    }
    for (const a of mol.atoms) {
      if (a.aromatic && !mol.adjacency[a.index].some((bi) => mol.bonds[bi].aromatic)) a.aromatic = false;
    }
    assignHydrogens(mol);
    return mol;
  }

  smiles(): string {
    return toSmiles(this.build());
  }

  /** Parsed and perceived again, ready for analysis and drawing. */
  molecule(): Molecule {
    return moleculeFromSmiles(this.smiles());
  }
}
