/**
 * The organic-chemistry vocabulary of the ENEM, computed from the molecular graph:
 * carbon classes, chain classification, functional groups, chirality and cis/trans.
 * Exercises are generated from these, so any molecule can become a question.
 */
import type { Molecule } from '../nanquim/molecule.ts';

export type CarbonClass = 'primário' | 'secundário' | 'terciário' | 'quaternário';

const isC = (mol: Molecule, i: number) => mol.atoms[i]?.element === 'C';

export function carbonNeighbors(mol: Molecule, atom: number): number {
  return mol.neighbors(atom).filter((n) => isC(mol, n)).length;
}

/** Primary…quaternary by the number of carbons attached (methane has no class). */
export function carbonClass(mol: Molecule, atom: number): CarbonClass | undefined {
  if (!isC(mol, atom)) return undefined;
  const classes = [undefined, 'primário', 'secundário', 'terciário', 'quaternário'] as const;
  return classes[carbonNeighbors(mol, atom)];
}

export function carbonsByClass(mol: Molecule): Record<CarbonClass, number[]> {
  const out: Record<CarbonClass, number[]> = { primário: [], secundário: [], terciário: [], quaternário: [] };
  for (const a of mol.atoms) {
    const cls = carbonClass(mol, a.index);
    if (cls) out[cls].push(a.index);
  }
  return out;
}

export interface ChainClassification {
  /** Cíclica (true) ou aberta/acíclica (false). */
  fechada: boolean;
  ramificada: boolean;
  insaturada: boolean;
  heterogenea: boolean;
  aromatica: boolean;
}

function inRing(mol: Molecule, atom: number): boolean {
  return mol.rings.some((r) => r.includes(atom));
}

/** A ring drawn as benzene: six carbons with alternating (or aromatic) bonds. */
export function benzeneRings(mol: Molecule): number[][] {
  return mol.rings.filter((ring) => {
    if (ring.length !== 6) return false;
    const bonds = ring.map((a, k) => mol.bondBetween(a, ring[(k + 1) % 6])!);
    if (bonds.every((b) => b.aromatic)) return true;
    return bonds.filter((b) => b.order === 2).length === 3 && bonds.every((b, k) => b.order !== bonds[(k + 1) % 6].order);
  });
}

export function classifyChain(mol: Molecule): ChainClassification {
  const carbons = mol.atoms.filter((a) => a.element === 'C').map((a) => a.index);
  const fechada = carbons.some((c) => inRing(mol, c));
  // Open chains branch at a tertiary/quaternary carbon; rings branch when a carbon
  // substituent hangs off them.
  const ramificada = fechada
    ? carbons.some((c) => !inRing(mol, c) && mol.neighbors(c).some((n) => isC(mol, n) && inRing(mol, n))) &&
      carbons.length > Math.max(...mol.rings.map((r) => r.length))
    : carbons.some((c) => carbonNeighbors(mol, c) >= 3);
  const insaturada = mol.bonds.some((b) => b.order > 1 && isC(mol, b.a) && isC(mol, b.b));
  const heterogenea = mol.atoms.some(
    (a) => a.element !== 'C' && a.element !== 'H' && mol.neighbors(a.index).filter((n) => isC(mol, n)).length >= 2,
  );
  return { fechada, ramificada, insaturada, heterogenea, aromatica: benzeneRings(mol).length > 0 };
}

export type HydrocarbonClass = 'alcano' | 'alceno' | 'alcino' | 'alcadieno' | 'cicloalcano' | 'cicloalceno' | 'aromático';

export function hydrocarbonClass(mol: Molecule): HydrocarbonClass | undefined {
  if (mol.atoms.some((a) => a.element !== 'C')) return undefined;
  if (benzeneRings(mol).length) return 'aromático';
  const doubles = mol.bonds.filter((b) => b.order === 2).length;
  const triples = mol.bonds.filter((b) => b.order === 3).length;
  if (mol.rings.length) return doubles ? 'cicloalceno' : triples ? undefined : 'cicloalcano';
  if (triples === 1 && doubles === 0) return 'alcino';
  if (doubles === 1 && triples === 0) return 'alceno';
  if (doubles === 2 && triples === 0) return 'alcadieno';
  if (!doubles && !triples) return 'alcano';
  return undefined;
}

// ---------------------------------------------------------------------------
// Functional groups

export type FunctionId =
  | 'ácido carboxílico'
  | 'sal orgânico'
  | 'éster'
  | 'amida'
  | 'aldeído'
  | 'cetona'
  | 'nitrila'
  | 'nitrocomposto'
  | 'álcool'
  | 'fenol'
  | 'enol'
  | 'éter'
  | 'amina'
  | 'haleto orgânico';

export interface FunctionalGroup {
  id: FunctionId;
  /** Atoms that make up the group, for highlighting. */
  atoms: number[];
}

export const FUNCTION_INFO: Record<FunctionId, { group: string; hint: string }> = {
  'ácido carboxílico': { group: '–COOH', hint: 'Carbonila e hidroxila no mesmo carbono: a carboxila.' },
  'sal orgânico': { group: '–COO⁻ M⁺', hint: 'Um ácido carboxílico que perdeu o H⁺ para um metal.' },
  éster: { group: '–COO–', hint: 'Carbonila ligada a um oxigênio que segue para outro carbono.' },
  amida: { group: '–CON<', hint: 'Carbonila ligada diretamente a um nitrogênio.' },
  aldeído: { group: '–CHO', hint: 'Carbonila na ponta da cadeia, com um hidrogênio no carbono.' },
  cetona: { group: '>C=O', hint: 'Carbonila entre dois carbonos.' },
  nitrila: { group: '–C≡N', hint: 'Carbono ligado ao nitrogênio por uma ligação tripla.' },
  nitrocomposto: { group: '–NO₂', hint: 'Nitrogênio ligado a dois oxigênios, preso à cadeia.' },
  álcool: { group: '–OH', hint: 'Hidroxila em carbono saturado.' },
  fenol: { group: 'Ar–OH', hint: 'Hidroxila presa diretamente ao anel aromático.' },
  enol: { group: '=C–OH', hint: 'Hidroxila em carbono de ligação dupla.' },
  éter: { group: '–O–', hint: 'Oxigênio entre dois carbonos, sem carbonila.' },
  amina: { group: '–N<', hint: 'Nitrogênio ligado só a carbonos e hidrogênios.' },
  'haleto orgânico': { group: '–X', hint: 'Halogênio (F, Cl, Br, I) ligado ao carbono.' },
};

const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);

export function functionalGroups(mol: Molecule): FunctionalGroup[] {
  const groups: FunctionalGroup[] = [];
  const used = new Set<number>();
  const atom = (i: number) => mol.atoms[i];
  const order = (i: number, j: number) => mol.bondBetween(i, j)?.order ?? 0;
  const take = (id: FunctionId, atoms: number[]) => {
    groups.push({ id, atoms });
    for (const a of atoms) used.add(a);
  };
  const carbonylOxygen = (c: number) =>
    mol.neighbors(c).find((n) => atom(n).element === 'O' && order(c, n) === 2 && mol.degree(n) === 1);

  // Carbonyl families, most specific first.
  for (const c of mol.atoms) {
    if (c.element !== 'C') continue;
    const o = carbonylOxygen(c.index);
    if (o === undefined) continue;
    const others = mol.neighbors(c.index).filter((n) => n !== o);
    const singleO = others.filter((n) => atom(n).element === 'O' && order(c.index, n) === 1);
    const n = others.find((x) => atom(x).element === 'N' && order(c.index, x) === 1);
    const hydroxyl = singleO.find((x) => atom(x).hydrogens > 0 && mol.degree(x) === 1);
    const anion = singleO.find((x) => atom(x).charge < 0 && mol.degree(x) === 1);
    const bridge = singleO.find((x) => mol.neighbors(x).filter((y) => atom(y).element === 'C').length === 2);
    if (hydroxyl !== undefined) take('ácido carboxílico', [c.index, o, hydroxyl]);
    else if (anion !== undefined) take('sal orgânico', [c.index, o, anion]);
    else if (bridge !== undefined) take('éster', [c.index, o, bridge]);
    else if (n !== undefined) take('amida', [c.index, o, n]);
    else if (others.filter((x) => atom(x).element === 'C').length === 2) take('cetona', [c.index, o]);
    else if (c.hydrogens > 0 && others.every((x) => atom(x).element === 'C')) take('aldeído', [c.index, o]);
  }
  for (const b of mol.bonds) {
    if (b.order !== 3) continue;
    const [c, n] = atom(b.a).element === 'C' ? [b.a, b.b] : [b.b, b.a];
    if (atom(c).element === 'C' && atom(n).element === 'N') take('nitrila', [c, n]);
  }
  for (const n of mol.atoms) {
    if (n.element !== 'N' || used.has(n.index)) continue;
    const oxygens = mol.neighbors(n.index).filter((x) => atom(x).element === 'O' && mol.degree(x) === 1);
    if (oxygens.length === 2) take('nitrocomposto', [n.index, ...oxygens]);
  }
  for (const o of mol.atoms) {
    if (o.element !== 'O' || used.has(o.index)) continue;
    const carbons = mol.neighbors(o.index).filter((x) => atom(x).element === 'C');
    if (o.hydrogens > 0 && carbons.length === 1 && mol.degree(o.index) === 1) {
      const c = carbons[0];
      const aromatic = atom(c).aromatic || benzeneRings(mol).some((r) => r.includes(c));
      const vinylic = mol.adjacency[c].some((bi) => mol.bonds[bi].order === 2);
      take(aromatic ? 'fenol' : vinylic ? 'enol' : 'álcool', [o.index]);
    } else if (carbons.length === 2 && mol.degree(o.index) === 2) {
      take('éter', [o.index]);
    }
  }
  for (const n of mol.atoms) {
    if (n.element !== 'N' || used.has(n.index) || n.aromatic) continue;
    const nbrs = mol.neighbors(n.index);
    if (nbrs.some((x) => atom(x).element !== 'C')) continue;
    if (mol.adjacency[n.index].some((bi) => mol.bonds[bi].order > 1)) continue;
    if (nbrs.some((x) => carbonylOxygen(x) !== undefined)) continue;
    take('amina', [n.index]);
  }
  for (const x of mol.atoms) {
    if (HALOGENS.has(x.element) && mol.neighbors(x.index).some((n) => atom(n).element === 'C')) {
      take('haleto orgânico', [x.index]);
    }
  }
  return groups;
}

export function functionSet(mol: Molecule): FunctionId[] {
  return [...new Set(functionalGroups(mol).map((g) => g.id))];
}

// ---------------------------------------------------------------------------
// Stereochemistry

/** Canonical description of the branch reached from `from` through `atom` (hierarchical digraph). */
function branchCode(mol: Molecule, atom: number, path: number[], depth: number, budget: { n: number }): string {
  const a = mol.atoms[atom];
  const head = `${a.element}${a.charge || ''}${a.isotope ?? ''}`;
  if (depth === 0 || --budget.n < 0) return head;
  const parts: string[] = [];
  for (const bi of mol.adjacency[atom]) {
    const next = mol.other(bi, atom);
    if (next === path[path.length - 1]) continue;
    const bond = mol.bonds[bi].order;
    if (path.includes(next)) {
      parts.push(`${bond}#${mol.atoms[next].element}`); // ring closure duplicate
      continue;
    }
    parts.push(`${bond}${branchCode(mol, next, [...path, atom], depth - 1, budget)}`);
  }
  for (let h = 0; h < a.hydrogens; h++) parts.push('1H');
  parts.sort();
  return `${head}(${parts.join(',')})`;
}

function substituentCodes(mol: Molecule, center: number): string[] {
  const codes = mol.neighbors(center).map((n) => branchCode(mol, n, [center], 14, { n: 20000 }));
  for (let h = 0; h < mol.atoms[center].hydrogens; h++) codes.push('H');
  return codes;
}

/** Carbons bearing four different groups (carbono quiral / assimétrico). */
export function chiralCarbons(mol: Molecule): number[] {
  return mol.atoms
    .filter((a) => {
      if (a.element !== 'C' || a.hydrogens > 1) return false;
      if (mol.adjacency[a.index].some((bi) => mol.bonds[bi].order !== 1)) return false;
      const codes = substituentCodes(mol, a.index);
      return codes.length === 4 && new Set(codes).size === 4;
    })
    .map((a) => a.index);
}

/** Double bonds C=C whose ends each carry two different groups, so cis/trans isomers exist. */
export function geometricDoubleBonds(mol: Molecule): number[] {
  return mol.bonds
    .filter((b) => {
      if (b.order !== 2 || b.aromatic) return false;
      if (mol.atoms[b.a].element !== 'C' || mol.atoms[b.b].element !== 'C') return false;
      if (mol.rings.some((r) => r.length < 8 && r.includes(b.a) && r.includes(b.b))) return false;
      const differs = (end: number, other: number) => {
        const codes = mol.neighbors(end)
          .filter((n) => n !== other)
          .map((n) => branchCode(mol, n, [end], 14, { n: 20000 }));
        for (let h = 0; h < mol.atoms[end].hydrogens; h++) codes.push('H');
        return codes.length === 2 && codes[0] !== codes[1];
      };
      return differs(b.a, b.b) && differs(b.b, b.a);
    })
    .map((b) => b.index);
}

export function countAtoms(mol: Molecule, element: string): number {
  if (element === 'H') return mol.atoms.reduce((s, a) => s + a.hydrogens + (a.element === 'H' ? 1 : 0), 0);
  return mol.atoms.filter((a) => a.element === element).length;
}

export function piBondCount(mol: Molecule): number {
  return mol.bonds.reduce((s, b) => s + (b.order - 1), 0);
}

// prettier-ignore
const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.99, Mg: 24.305, Al: 26.982,
  Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38,
  Br: 79.904, Ag: 107.87, I: 126.9, Hg: 200.59, Pb: 207.2, Li: 6.94, Se: 78.971,
};

/** Molar mass in g/mol, or undefined when an element is unknown or generic (R). */
export function molarMass(mol: Molecule): number | undefined {
  let total = 0;
  for (const a of mol.atoms) {
    const m = ATOMIC_MASS[a.element];
    if (m === undefined) return undefined;
    total += m + a.hydrogens * ATOMIC_MASS.H;
  }
  return total;
}
