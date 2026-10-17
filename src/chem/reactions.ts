/**
 * The organic reactions of the ENEM, as edits on the molecular graph: additions to
 * C=C, substitution in alkanes and benzene rings, oxidation of alcohols, combustion,
 * esterification and hydrolysis (saponification, biodiesel), polymers and peptides.
 * Lessons ask these functions for the products, so the answer key is the chemistry.
 */
import { type Molecule, moleculeFromSmiles } from '../nanquim/index.ts';
import { type CarbonClass, benzeneRings, carbonClass, functionalGroups } from './analysis.ts';
import { Draft, canonicalKey, symmetryClasses, writeSmiles } from './graph.ts';

const cache = new Map<string, Molecule>();
function parse(smiles: string): Molecule {
  let m = cache.get(smiles);
  if (!m) {
    m = moleculeFromSmiles(smiles);
    cache.set(smiles, m);
  }
  return m;
}

const isC = (m: Molecule, i: number) => m.atoms[i].element === 'C';

/** A reaction product and how many of it form per formula unit of reactant. */
export interface Product {
  smiles: string;
  count: number;
}

/** Split a dot-disconnected SMILES into its pieces and count identical ones. */
function tally(mol: Molecule): Product[] {
  const out: Array<Product & { key: string }> = [];
  for (const comp of mol.components()) {
    const d = new Draft(mol);
    for (const a of mol.atoms) if (!comp.includes(a.index)) d.remove(a.index);
    const smiles = d.smiles();
    const key = canonicalKey(smiles);
    const seen = out.find((p) => p.key === key);
    if (seen) seen.count++;
    else out.push({ smiles, count: 1, key });
  }
  return out.map(({ smiles, count }) => ({ smiles, count }));
}

// ---------------------------------------------------------------------------
// Addition

export type AdditionReagent = 'H2' | 'Cl2' | 'Br2' | 'HCl' | 'HBr' | 'H2O';

export const REAGENT_TEXT: Record<AdditionReagent, string> = {
  H2: 'H₂',
  Cl2: 'Cl₂',
  Br2: 'Br₂',
  HCl: 'HCl',
  HBr: 'HBr',
  H2O: 'H₂O',
};

function benzenoidAtoms(m: Molecule): Set<number> {
  return new Set(benzeneRings(m).flat());
}

/** C=C (order 2) or C≡C (order 3) bonds outside benzene rings. */
export function carbonMultipleBonds(input: string | Molecule, order?: 2 | 3) {
  const m = typeof input === 'string' ? parse(input) : input;
  const ring = benzenoidAtoms(m);
  return m.bonds.filter(
    (b) =>
      b.order > 1 &&
      (order === undefined || b.order === order) &&
      !b.aromatic &&
      isC(m, b.a) &&
      isC(m, b.b) &&
      !(ring.has(b.a) && ring.has(b.b)),
  );
}

/** Moles of H₂ that saturate one mole: 1 per C=C, 2 per C≡C (benzene rings excluded). */
export function h2ToSaturate(smiles: string): number {
  return carbonMultipleBonds(smiles).reduce((s, b) => s + (b.order - 1), 0);
}

export function hydrogenate(smiles: string): string {
  const d = new Draft(smiles);
  for (const b of carbonMultipleBonds(smiles)) d.setOrder(b.a, b.b, 1);
  return d.smiles();
}

/**
 * The C=C carbon that takes the H of HX or H₂O (Markovnikov: the one that already has
 * more hydrogens). Undefined when both have the same number.
 */
export function markovnikovCarbon(smiles: string): number | undefined {
  const m = parse(smiles);
  const [bond] = carbonMultipleBonds(m, 2);
  if (!bond) return undefined;
  const ha = m.atoms[bond.a].hydrogens;
  const hb = m.atoms[bond.b].hydrogens;
  if (ha === hb) return undefined;
  return ha > hb ? bond.a : bond.b;
}

const ADDED: Record<Exclude<AdditionReagent, 'H2'>, { h?: true; x: string }> = {
  Cl2: { x: 'Cl' },
  Br2: { x: 'Br' },
  HCl: { h: true, x: 'Cl' },
  HBr: { h: true, x: 'Br' },
  H2O: { h: true, x: 'O' },
};

/**
 * Product of adding the reagent across the (single) C=C. HX and H₂O follow
 * Markovnikov unless `antiMarkovnikov`; undefined when the orientation is ambiguous
 * (both carbons equally substituted but giving different products).
 */
export function addition(smiles: string, reagent: AdditionReagent, opts: { antiMarkovnikov?: boolean } = {}): string | undefined {
  if (reagent === 'H2') return hydrogenate(smiles);
  const m = parse(smiles);
  const doubles = carbonMultipleBonds(m, 2);
  if (doubles.length !== 1 || carbonMultipleBonds(m, 3).length) return undefined;
  const { a, b } = doubles[0];
  const { h, x } = ADDED[reagent];
  const build = (hTo: number, xTo: number) => {
    const d = new Draft(m);
    d.setOrder(a, b, 1);
    d.attach(xTo, x);
    // X₂ adds X to both carbons; HX adds H (implicit, recomputed) to the other.
    if (!h) d.attach(hTo, x);
    return d.smiles();
  };
  if (!h) return build(a, b);
  const rich = markovnikovCarbon(smiles);
  if (rich === undefined) {
    const p = build(a, b);
    const q = build(b, a);
    return canonicalKey(p) === canonicalKey(q) ? p : undefined;
  }
  const poor = rich === a ? b : a;
  return opts.antiMarkovnikov ? build(poor, rich) : build(rich, poor);
}

// ---------------------------------------------------------------------------
// Substitution

/**
 * Possible monohalogenation products of an alkane (or cycloalkane): one per class of
 * equivalent C–H carbons, with the class of carbon that was substituted.
 */
export function monohalogenation(smiles: string, x: 'Cl' | 'Br'): Array<{ smiles: string; carbons: number[]; carbonClass?: CarbonClass }> {
  const m = parse(smiles);
  const cls = symmetryClasses(m);
  const groups = new Map<number, number[]>();
  for (const a of m.atoms) {
    if (a.element !== 'C' || a.hydrogens === 0) continue;
    groups.set(cls[a.index], [...(groups.get(cls[a.index]) ?? []), a.index]);
  }
  return [...groups.values()]
    .sort((p, q) => p[0] - q[0])
    .map((carbons) => {
      const d = new Draft(m);
      d.attach(carbons[0], x);
      return { smiles: d.smiles(), carbons, carbonClass: carbonClass(m, carbons[0]) };
    });
}

const CLASS_ORDER: Record<CarbonClass, number> = { primário: 1, secundário: 2, terciário: 3, quaternário: 4 };

/**
 * Main product of a radical bromination: the H on the most substituted carbon goes
 * (terciário > secundário > primário). Undefined when two inequivalent positions tie.
 */
export function mainBromination(smiles: string): { smiles: string; carbons: number[]; carbonClass?: CarbonClass } | undefined {
  const all = monohalogenation(smiles, 'Br');
  const level = (p: (typeof all)[number]) => (p.carbonClass ? CLASS_ORDER[p.carbonClass] : 0);
  const top = Math.max(...all.map(level));
  const best = all.filter((p) => level(p) === top);
  return best.length === 1 ? best[0] : undefined;
}

export type ArylGroup = 'NO2' | 'Cl' | 'Br' | 'CH3' | 'SO3H';

const ARYL_SMILES: Record<ArylGroup, string> = {
  NO2: '[N+](=O)[O-]',
  Cl: 'Cl',
  Br: 'Br',
  CH3: 'C',
  SO3H: 'S(=O)(=O)O',
};

/** Reagents and catalysts over the arrow, and the reaction's name, per group put on the ring. */
export const ARYL_REACTION: Record<ArylGroup, { over: string; under: string; name: string; byproduct: string }> = {
  NO2: { over: 'HNO₃', under: 'H₂SO₄', name: 'Nitração', byproduct: 'H₂O' },
  Cl: { over: 'Cl₂', under: 'FeCl₃', name: 'Halogenação', byproduct: 'HCl' },
  Br: { over: 'Br₂', under: 'FeBr₃', name: 'Halogenação', byproduct: 'HBr' },
  CH3: { over: 'CH₃Cl', under: 'AlCl₃', name: 'Alquilação de Friedel-Crafts', byproduct: 'HCl' },
  SO3H: { over: 'H₂SO₄', under: 'SO₃', name: 'Sulfonação', byproduct: 'H₂O' },
};

export type RingPosition = 'orto' | 'meta' | 'para';

/** For a benzene ring with one substituent: the substituted carbon and the orto, meta and para C–H carbons. */
export function ringPositions(smiles: string): { ring: number[]; ipso: number; substituent: number; orto: number[]; meta: number[]; para: number[] } | undefined {
  const m = parse(smiles);
  const rings = benzeneRings(m);
  if (rings.length !== 1) return undefined;
  const ring = rings[0];
  const subs = ring.flatMap((r) => m.neighbors(r).filter((n) => !ring.includes(n)).map((n) => [r, n] as const));
  if (subs.length !== 1) return undefined;
  const [ipso, substituent] = subs[0];
  const k = ring.indexOf(ipso);
  const at = (d: number) => ring[(k + d + 6) % 6];
  return { ring, ipso, substituent, orto: [at(1), at(-1)], meta: [at(2), at(-2)], para: [at(3)] };
}

/**
 * Orientation of a second substitution. Meta directors have a double/triple bond or a
 * positive charge on the atom bonded to the ring (–NO₂, –CHO, –COOH, –CN, –SO₃H);
 * everything else (–OH, –NH₂, –CH₃, halogens) directs to orto and para.
 */
export function director(smiles: string): 'orto-para' | 'meta' | undefined {
  const pos = ringPositions(smiles);
  if (!pos) return undefined;
  const m = parse(smiles);
  const s = pos.substituent;
  const a = m.atoms[s];
  if (a.charge > 0) return 'meta';
  const multiple = m.adjacency[s].some((bi) => {
    const b = m.bonds[bi];
    return b.order > 1 && !b.aromatic && !(isC(m, m.other(b, s)) && a.element === 'C');
  });
  return multiple ? 'meta' : 'orto-para';
}

/** Put a group on the ring: on benzene anywhere, on a monosubstituted ring at the given position. */
export function aromaticSubstitution(smiles: string, group: ArylGroup, position?: RingPosition): string {
  const m = parse(smiles);
  const pos = ringPositions(smiles);
  let target: number;
  if (!pos) {
    const rings = benzeneRings(m);
    if (rings.length !== 1 || rings[0].some((r) => m.atoms[r].hydrogens === 0)) throw new Error(`Anel não suportado: ${smiles}`);
    target = rings[0][0];
  } else {
    if (!position) throw new Error('Posição necessária para um anel já substituído');
    target = pos[position][0];
  }
  const d = new Draft(m);
  d.attach(target, ARYL_SMILES[group]);
  return d.smiles();
}

/** The substituent replacing the group already on the ring (ipso): a classic wrong answer. */
export function ipsoSubstitution(smiles: string, group: ArylGroup): string {
  const pos = ringPositions(smiles);
  if (!pos) throw new Error(`Anel não suportado: ${smiles}`);
  const m = parse(smiles);
  const d = new Draft(m);
  const keep = new Set<number>(pos.ring);
  // Drop the whole old substituent branch.
  const stack = [pos.substituent];
  const drop = new Set<number>();
  while (stack.length) {
    const v = stack.pop()!;
    if (drop.has(v) || keep.has(v)) continue;
    drop.add(v);
    stack.push(...m.neighbors(v));
  }
  for (const v of drop) d.remove(v);
  d.attach(pos.ipso, ARYL_SMILES[group]);
  return d.smiles();
}

// ---------------------------------------------------------------------------
// Oxidation and combustion

export type AlcoholKind = 'primário' | 'secundário' | 'terciário';

/** Hydroxyls on saturated, non-aromatic carbons, with the class of the carbinol carbon. */
export function alcohols(input: string | Molecule): Array<{ oxygen: number; carbon: number; kind: AlcoholKind }> {
  const m = typeof input === 'string' ? parse(input) : input;
  return functionalGroups(m)
    .filter((g) => g.id === 'álcool')
    .map((g) => {
      const oxygen = g.atoms[0];
      const carbon = m.neighbors(oxygen)[0];
      const n = m.neighbors(carbon).filter((x) => isC(m, x)).length;
      const kind: AlcoholKind = n <= 1 ? 'primário' : n === 2 ? 'secundário' : 'terciário';
      return { oxygen, carbon, kind };
    });
}

/**
 * Oxidation of an alcohol with one –OH ([O]: KMnO₄ or K₂Cr₂O₇ in acid). Primary gives the
 * aldehyde ('branda', distilled off as it forms) or the carboxylic acid ('energica');
 * secondary gives the ketone; tertiary does not react (null).
 */
export function oxidizeAlcohol(smiles: string, strength: 'branda' | 'energica'): string | null {
  const m = parse(smiles);
  const found = alcohols(m);
  if (found.length !== 1) throw new Error(`Esperado um único álcool: ${smiles}`);
  const { oxygen, carbon, kind } = found[0];
  if (kind === 'terciário') return null;
  const d = new Draft(m);
  d.setOrder(carbon, oxygen, 2);
  if (kind === 'primário' && strength === 'energica') d.attach(carbon, 'O');
  return d.smiles();
}

/** Complete combustion of CxHyOz per mole of fuel: O₂ used, CO₂ and H₂O formed. */
export function combustion(smiles: string): { o2: number; co2: number; h2o: number } {
  const m = parse(smiles);
  let c = 0;
  let h = 0;
  let o = 0;
  for (const a of m.atoms) {
    h += a.hydrogens;
    if (a.element === 'C') c++;
    else if (a.element === 'O') o++;
    else if (a.element === 'H') h++;
    else throw new Error(`Combustão só para CxHyOz: ${smiles}`);
  }
  return { o2: c + h / 4 - o / 2, co2: c, h2o: h / 2 };
}

// ---------------------------------------------------------------------------
// Esters

/** Carboxyl groups C(=O)–OH: carbon, carbonyl O and hydroxyl O. */
export function carboxyls(input: string | Molecule): Array<{ c: number; o: number; oh: number }> {
  const m = typeof input === 'string' ? parse(input) : input;
  return functionalGroups(m)
    .filter((g) => g.id === 'ácido carboxílico')
    .map((g) => ({ c: g.atoms[0], o: g.atoms[1], oh: g.atoms[2] }));
}

/** Ester groups C(=O)–O–C: carbonyl carbon, carbonyl O, bridging O and the alkoxy carbon. */
export function esters(input: string | Molecule): Array<{ c: number; o: number; bridge: number; alkyl: number }> {
  const m = typeof input === 'string' ? parse(input) : input;
  return functionalGroups(m)
    .filter((g) => g.id === 'éster')
    .map((g) => {
      const [c, o, bridge] = g.atoms;
      const alkyl = m.neighbors(bridge).find((x) => x !== c)!;
      return { c, o, bridge, alkyl };
    });
}

/** Offsets of each piece when SMILES strings are joined with '.'. */
function joined(parts: string[]): { smiles: string; offsets: number[] } {
  let n = 0;
  const offsets = parts.map((p) => {
    const at = n;
    n += parse(p).atoms.length;
    return at;
  });
  return { smiles: parts.join('.'), offsets };
}

/**
 * Fischer esterification RCOOH + R'OH ⇌ RCOOR' + H₂O. The acid loses its OH and the
 * alcohol its H, so the bridging oxygen of the ester comes from the alcohol.
 */
export function esterify(acid: string, alcohol: string): string {
  const acidSites = carboxyls(acid);
  const alcoholSites = alcohols(alcohol).length ? alcohols(alcohol) : phenolOxygens(alcohol);
  if (acidSites.length !== 1 || alcoholSites.length !== 1) throw new Error(`Esperado um ácido e um álcool: ${acid} + ${alcohol}`);
  const { smiles, offsets } = joined([acid, alcohol]);
  const d = new Draft(smiles);
  d.remove(offsets[0] + acidSites[0].oh);
  d.bond(offsets[0] + acidSites[0].c, offsets[1] + alcoholSites[0].oxygen);
  return d.smiles();
}

function phenolOxygens(smiles: string): Array<{ oxygen: number }> {
  return functionalGroups(parse(smiles))
    .filter((g) => g.id === 'fenol')
    .map((g) => ({ oxygen: g.atoms[0] }));
}

/**
 * Hydrolysis of every ester group. In acid: carboxylic acids + alcohols. In base
 * (saponification): carboxylate salts of the metal + alcohols.
 */
export function hydrolyzeEsters(smiles: string, medium: 'ácido' | 'básico', metal = 'Na'): { acids: Product[]; alcohols: Product[] } {
  const m = parse(smiles);
  const sites = esters(m);
  if (!sites.length) throw new Error(`Sem éster: ${smiles}`);
  const d = new Draft(m);
  for (const s of sites) {
    d.unbond(s.c, s.bridge);
    if (medium === 'ácido') d.attach(s.c, 'O');
    else {
      const [o] = d.attach(s.c, 'O');
      d.charge(o, -1);
    }
  }
  const parts = tally(d.molecule());
  const isAcid = (p: Product) => {
    const pm = parse(p.smiles);
    return functionalGroups(pm).some((g) => g.id === 'ácido carboxílico') || pm.atoms.some((a) => a.charge < 0);
  };
  const acids = parts.filter(isAcid).map((p) => {
    if (medium === 'ácido') return p;
    const charge = parse(p.smiles).atoms.reduce((s, a) => s + a.charge, 0);
    return { smiles: `${p.smiles}${`.[${metal}+]`.repeat(-charge)}`, count: p.count };
  });
  return { acids, alcohols: parts.filter((p) => !isAcid(p)) };
}

/**
 * Transesterification (biodiesel): each ester's alkoxy part is swapped for the given
 * alcohol. Triglyceride + 3 CH₃OH → 3 RCOOCH₃ + glicerol.
 */
export function transesterify(smiles: string, alcohol: string): { esters: Product[]; alcohols: Product[] } {
  const { acids, alcohols: freed } = hydrolyzeEsters(smiles, 'ácido');
  return {
    esters: acids.map((a) => ({ smiles: esterify(a.smiles, alcohol), count: a.count })),
    alcohols: freed,
  };
}

// ---------------------------------------------------------------------------
// Polymers

/** Repeat unit of the addition polymer of a monomer with one C=C: CH₂=CHCl → *CH₂–CHCl*. */
export function additionPolymer(monomer: string): string {
  const doubles = carbonMultipleBonds(monomer, 2);
  if (doubles.length !== 1) throw new Error(`Monômero de adição com uma dupla C=C: ${monomer}`);
  const { a, b } = doubles[0];
  const d = new Draft(monomer);
  d.setOrder(a, b, 1);
  d.attach(a, '*');
  d.attach(b, '*');
  return startAtEnd(d.smiles());
}

/** Write a repeat unit starting from one of its open ends (reads like –[CH₂–CHCl]–). */
function startAtEnd(smiles: string): string {
  const m = parse(smiles);
  const end = m.atoms.find((a) => a.element === '*');
  if (!end) return smiles;
  return writeSmiles(m, { ranks: m.atoms.map((a) => (a.index === end.index ? -1 : a.index)) }).smiles;
}

/** Monomer of an addition polymer: the bond between the two end carbons becomes C=C again. */
export function monomerOf(repeat: string): string | undefined {
  const m = parse(repeat);
  const ends = m.atoms.filter((a) => a.element === '*').map((a) => a.index);
  if (ends.length !== 2) return undefined;
  const [p, q] = ends.map((e) => m.neighbors(e)[0]);
  const d = new Draft(m);
  for (const e of ends) d.remove(e);
  if (m.bondBetween(p, q)) {
    d.setOrder(p, q, 2);
    return d.smiles();
  }
  // 1,4-polymers of dienes (rubber): –CH₂–C(CH₃)=CH–CH₂– comes from CH₂=C(CH₃)–CH=CH₂.
  const mid = m.neighbors(p).find((x) => x !== ends[0] && m.neighbors(q).some((y) => m.bondBetween(x, y)?.order === 2));
  if (mid === undefined) return undefined;
  const other = m.neighbors(q).find((y) => m.bondBetween(mid, y)?.order === 2)!;
  d.setOrder(mid, other, 1);
  d.setOrder(p, mid, 2);
  d.setOrder(other, q, 2);
  return d.smiles();
}

type Nucleophile = { atom: number; kind: 'O' | 'N' };

function nucleophiles(m: Molecule): Nucleophile[] {
  const out: Nucleophile[] = [];
  for (const g of functionalGroups(m)) {
    if (g.id === 'álcool' || g.id === 'fenol') out.push({ atom: g.atoms[0], kind: 'O' });
    if (g.id === 'amina' && m.atoms[g.atoms[0]].hydrogens > 0) out.push({ atom: g.atoms[0], kind: 'N' });
  }
  return out;
}

/**
 * Repeat unit of a condensation polymer. Two monomers: a diacid with a diol (polyester)
 * or a diamine (polyamide). One monomer: a hydroxy acid or an amino acid. Each link
 * releases one H₂O.
 */
export function condensationPolymer(a: string, b?: string): string {
  const parts = b ? [a, b] : [a];
  const { smiles, offsets } = joined(parts);
  const d = new Draft(smiles);
  const acidsOf = (i: number) => carboxyls(parts[i]).map((s) => ({ c: s.c + offsets[i], oh: s.oh + offsets[i] }));
  const nucsOf = (i: number) => nucleophiles(parse(parts[i])).map((n) => ({ ...n, atom: n.atom + offsets[i] }));
  let acid: Array<{ c: number; oh: number }>;
  let nuc: Nucleophile[];
  if (b) {
    const [first, second] = carboxyls(a).length >= 2 ? [0, 1] : [1, 0];
    acid = acidsOf(first);
    nuc = nucsOf(second);
  } else {
    acid = acidsOf(0);
    nuc = nucsOf(0);
  }
  if (acid.length < 1 || nuc.length < 1 || (b && (acid.length !== 2 || nuc.length !== 2))) {
    throw new Error(`Monômeros de condensação inválidos: ${parts.join(' + ')}`);
  }
  for (const s of acid) d.remove(s.oh);
  if (b) {
    // Link: acid carbon 0 to nucleophile 0; open ends on acid carbon 1 and nucleophile 1.
    d.bond(acid[0].c, nuc[0].atom);
    d.attach(acid[1].c, '*');
    d.attach(nuc[1].atom, '*');
  } else {
    d.attach(acid[0].c, '*');
    d.attach(nuc[0].atom, '*');
  }
  return startAtEnd(d.smiles());
}

// ---------------------------------------------------------------------------
// Biomolecules

/** The α-carboxyl and α-amino group of an amino acid. */
export function aminoAcidSites(smiles: string): { c: number; oh: number; n: number; alpha: number } | undefined {
  const m = parse(smiles);
  for (const s of carboxyls(m)) {
    const alpha = m.neighbors(s.c).find((x) => isC(m, x));
    if (alpha === undefined) continue;
    const n = m.neighbors(alpha).find((x) => m.atoms[x].element === 'N' && m.atoms[x].hydrogens > 0);
    if (n !== undefined) return { c: s.c, oh: s.oh, n, alpha };
  }
  return undefined;
}

/** Peptide from amino acids in order (N-terminal first): each COOH bonds to the next NH₂, releasing H₂O. */
export function peptide(aminoAcids: string[]): string {
  const sites = aminoAcids.map((aa) => {
    const s = aminoAcidSites(aa);
    if (!s) throw new Error(`Não é um α-aminoácido: ${aa}`);
    return s;
  });
  const { smiles, offsets } = joined(aminoAcids);
  const d = new Draft(smiles);
  for (let i = 0; i + 1 < aminoAcids.length; i++) {
    d.remove(offsets[i] + sites[i].oh);
    d.bond(offsets[i] + sites[i].c, offsets[i + 1] + sites[i + 1].n);
  }
  return d.smiles();
}

/** Amide links C(=O)–N between residues (the N bonds to another carbon besides the carbonyl). */
export function peptideBonds(input: string | Molecule): Array<{ c: number; o: number; n: number }> {
  const m = typeof input === 'string' ? parse(input) : input;
  return functionalGroups(m)
    .filter((g) => g.id === 'amida')
    .map((g) => ({ c: g.atoms[0], o: g.atoms[1], n: g.atoms[2] }))
    .filter((g) => m.neighbors(g.n).filter((x) => isC(m, x)).length >= 2);
}

/** Oxygens bridging two sugar rings (ligação glicosídica). */
export function glycosidicOxygens(input: string | Molecule): number[] {
  const m = typeof input === 'string' ? parse(input) : input;
  const inRing = (i: number) => m.rings.some((r) => r.includes(i));
  return m.atoms
    .filter((a) => {
      if (a.element !== 'O' || inRing(a.index) || m.degree(a.index) !== 2) return false;
      const [p, q] = m.neighbors(a.index);
      const ringOf = (x: number) => m.rings.findIndex((r) => r.includes(x));
      return isC(m, p) && isC(m, q) && inRing(p) && inRing(q) && ringOf(p) !== ringOf(q);
    })
    .map((a) => a.index);
}

/** Aldose (aldehyde group) or cetose (ketone group), for open-chain monosaccharides. */
export function sugarKind(smiles: string): 'aldose' | 'cetose' | undefined {
  const ids = functionalGroups(parse(smiles)).map((g) => g.id);
  if (ids.includes('aldeído')) return 'aldose';
  if (ids.includes('cetona')) return 'cetose';
  return undefined;
}

/** Triglyceride of three fatty acids, in the order of glycerol's carbons. */
export function triglyceride(acids: [string, string, string]): string {
  const glycerol = 'OCC(O)CO';
  const oxygens = alcohols(glycerol).map((a) => a.oxygen);
  const { smiles, offsets } = joined([glycerol, ...acids]);
  const d = new Draft(smiles);
  acids.forEach((acid, i) => {
    const [site] = carboxyls(acid);
    if (!site) throw new Error(`Não é um ácido: ${acid}`);
    d.remove(offsets[i + 1] + site.oh);
    d.bond(offsets[i + 1] + site.c, oxygens[i]);
  });
  return d.smiles();
}

/**
 * Generic condensation: atom `drop` (an –OH oxygen of A) leaves with an H of B as water,
 * and A's atom `keep` bonds to B's atom `onto`. Glycosidic bonds are made this way.
 */
export function condense(a: string, drop: number, keep: number, b: string, onto: number): string {
  const { smiles, offsets } = joined([a, b]);
  const d = new Draft(smiles);
  d.remove(drop);
  d.bond(keep, offsets[1] + onto);
  return d.smiles();
}

/**
 * Intramolecular dehydration of an alcohol (H₂SO₄, 170 °C): the –OH and an H of the
 * neighbouring carbon leave as water, giving the more substituted alkene (Zaitsev).
 */
export function dehydration(smiles: string): string | undefined {
  const m = parse(smiles);
  const [site] = alcohols(m);
  if (!site) return undefined;
  const neighbours = m.neighbors(site.carbon).filter((x) => isC(m, x) && m.atoms[x].hydrogens > 0 && !m.atoms[x].aromatic);
  if (!neighbours.length) return undefined;
  const target = [...neighbours].sort((p, q) => m.atoms[p].hydrogens - m.atoms[q].hydrogens)[0];
  const d = new Draft(m);
  d.remove(site.oxygen);
  d.setOrder(site.carbon, target, 2);
  return d.smiles();
}

/** Ether from two molecules of the same alcohol (intermolecular dehydration, 140 °C). */
export function symmetricEther(smiles: string): string | undefined {
  const [site] = alcohols(smiles);
  if (!site) return undefined;
  return condense(smiles, site.oxygen, site.carbon, smiles, site.oxygen);
}

/** Sodium (or potassium) salt of a carboxylic acid: RCOOH → RCOO⁻ Na⁺. */
export function carboxylateSalt(acid: string, metal = 'Na'): string {
  const sites = carboxyls(acid);
  if (!sites.length) throw new Error(`Sem carboxila: ${acid}`);
  const d = new Draft(acid);
  for (const s of sites) {
    d.charge(s.oh, -1);
    d.addAtom(metal, { charge: 1 });
  }
  return d.smiles();
}
