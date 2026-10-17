/**
 * Turns a perceived molecule plus 2D coordinates into drawing primitives: hairline
 * bonds clipped against glyph-accurate label outlines, double bonds offset into
 * rings or centred on carbonyls, wedges, hashes and highlights. Output units are px
 * (y-down) and every primitive keeps a reference to the bond or atom it came from,
 * so UIs can make structures interactive.
 */
import { elementInfo } from './elements.ts';
import {
  type Vec,
  add,
  angleOf,
  centroid,
  cross,
  dot,
  fromAngle,
  len,
  lerp,
  lineIntersectionT,
  norm,
  perp,
  scale,
  sub,
  vec,
} from './geometry.ts';
import { FONT_METRICS, advance } from './font.ts';
import { type AtomLabel, type LabelSpec, chooseHydrogenSide, clipParam, layoutLabel } from './labels.ts';
import { computeLayout } from './layout.ts';
import { Molecule } from './molecule.ts';
import { perceive } from './perception.ts';
import { ringInfo } from './rings.ts';
import { parseSmiles } from './smiles.ts';
import { assignWedges } from './stereo.ts';
import { type DrawStyle, type StyleName, resolveStyle } from './style.ts';
import { roundedEllipse, roundedHull } from './outline.ts';
import { type AbbreviationName, ALL_ABBREVIATIONS, abbreviate, addHydrogens, markSources, subset } from './transform.ts';

export interface Highlight {
  /** Atoms of the parsed molecule; bonds between two highlighted atoms light up too. */
  atoms?: number[];
  bonds?: number[];
  color: string;
}

/** A dashed outline around a group of atoms, optionally named in bold (ENEM 2024, Q112). */
export interface Annotation {
  atoms: number[];
  label?: string;
}

export type FormulaKind = 'skeletal' | 'condensed' | 'plana' | 'structural';

/** House rules for how a structure is written, independent of stroke and type sizes. */
export interface Conventions {
  /** Draw the hydrogen of an aldehyde as its own atom (O=C–H). */
  aldehydeHydrogen: boolean;
  /** Draw the N–H of open-chain amines and amides as a bond to an H. */
  amineHydrogen: boolean;
  /**
   * Which carbons get a written label in skeletal formulas. 'enem' labels methyls on O
   * or S (H3C–O), terminal =CH2 and methyls on C=C carbons, as the booklets do.
   */
  carbonLabels: 'none' | 'terminal' | 'enem' | 'all';
  /** Put single-atom counter-ions right next to the opposite charge ("O⁻ Na⁺"). */
  ionPairs: boolean;
  /** Stand a ring with one main group (or two, ortho/meta) on end, group up. */
  pose: 'landscape' | 'upright';
  /** Groups written as condensed text in skeletal formulas. */
  abbreviations: AbbreviationName[];
}

export const CONVENTIONS = {
  textbook: {
    aldehydeHydrogen: false,
    amineHydrogen: false,
    carbonLabels: 'none',
    ionPairs: false,
    pose: 'landscape',
    abbreviations: [],
  },
  /** Conventions observed in the INEP booklets, 2021–2025. */
  enem: {
    aldehydeHydrogen: true,
    amineHydrogen: true,
    carbonLabels: 'enem',
    ionPairs: true,
    pose: 'upright',
    abbreviations: [],
  },
} satisfies Record<string, Conventions>;

export function resolveConventions(c?: keyof typeof CONVENTIONS | Partial<Conventions>): Conventions {
  if (!c) return CONVENTIONS.textbook as Conventions;
  if (typeof c === 'string') return CONVENTIONS[c] as Conventions;
  return { ...(CONVENTIONS.textbook as Conventions), ...c };
}

export interface DepictOptions {
  style?: StyleName | Partial<DrawStyle>;
  /**
   * 'skeletal' (fórmula de linhas / bastão, default), 'condensed' (H3C–CH2–OH with
   * straight chains), 'plana' (ENEM's fórmula estrutural plana: every bond of the
   * carbon backbone drawn, end groups condensed as CH3, NH2, COOH) or 'structural'
   * (every atom and bond written out).
   */
  formula?: FormulaKind;
  /** Which carbons get a written "C" label in skeletal formulas. */
  carbonLabels?: 'none' | 'terminal' | 'all';
  /** Same as formula: 'structural'. */
  explicitHydrogens?: boolean;
  /** House rules (explicit hydrogens, carbon labels, pose...). Default 'textbook'. */
  conventions?: keyof typeof CONVENTIONS | Partial<Conventions>;
  /** Groups to write as condensed text (COOH, NO2...); defaults to the conventions'. */
  abbreviations?: AbbreviationName[];
  /** Dashed, optionally labelled outlines around groups of atoms. */
  annotations?: Annotation[];
  /** Bold name under the structure, and an optional source line under it. */
  caption?: string;
  source?: string;
  /** Draw aromatic rings with an inscribed circle instead of Kekulé double bonds. */
  aromaticCircles?: boolean;
  /** Wedge/hash bonds from @/@@ (default true). */
  stereo?: boolean;
  highlights?: Highlight[];
}

export interface LinePrim {
  type: 'line';
  a: Vec;
  b: Vec;
  width: number;
  color: string;
  bond?: number;
}

export interface PolygonPrim {
  type: 'polygon';
  points: Vec[];
  color: string;
  bond?: number;
}

export interface CirclePrim {
  type: 'circle';
  center: Vec;
  r: number;
  width: number;
  color: string;
  fill?: string;
  atom?: number;
}

export type Primitive = LinePrim | PolygonPrim | CirclePrim;

export interface OutlinePrim {
  points: Vec[];
  width: number;
  dash: [number, number];
  color: string;
}

/** Free text such as captions and annotation names; `y` is the baseline. */
export interface FreeText {
  text: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  anchor: 'start' | 'middle';
}

export interface AtomSite {
  /** Index in the molecule that was passed in (or parsed), -1 for atoms added for drawing. */
  index: number;
  x: number;
  y: number;
  element: string;
  labelled: boolean;
}

export interface Drawing {
  /** The molecule as drawn (after abbreviations and explicit hydrogens). */
  molecule: Molecule;
  style: DrawStyle;
  viewBox: { x: number; y: number; width: number; height: number };
  underlay: Primitive[];
  primitives: Primitive[];
  labels: AtomLabel[];
  outlines: OutlinePrim[];
  texts: FreeText[];
  /** One entry per drawn atom, in drawing order. */
  atoms: AtomSite[];
}

/** Parse + perceive a SMILES string. */
export function moleculeFromSmiles(smiles: string): Molecule {
  return perceive(parseSmiles(smiles));
}

/** Copy of `mol` with every implicit hydrogen turned into a real atom. */
export function expandHydrogens(mol: Molecule): Molecule {
  const out = new Molecule();
  out.title = mol.title;
  for (const a of mol.atoms) out.addAtom({ ...a, hydrogens: 0, stereoOrder: a.stereoOrder && [...a.stereoOrder] });
  for (const b of mol.bonds) {
    const bi = out.addBond(b.a, b.b, b.order, b.aromatic);
    out.bonds[bi].direction = b.direction;
  }
  for (const a of mol.atoms) {
    for (let k = 0; k < a.hydrogens; k++) {
      const h = out.addAtom({ element: 'H' });
      out.addBond(a.index, h);
      const order = out.atoms[a.index].stereoOrder;
      const slot = order?.indexOf(-1) ?? -1;
      if (order && slot >= 0) order[slot] = h;
    }
  }
  out.rings = mol.rings.map((r) => [...r]);
  out.doubleBondStereo = mol.doubleBondStereo.map((s) => ({ ...s }));
  return out;
}

/** Condensed formulas need room for "CH2" between bonds. */
const CONDENSED_STRETCH = 1.75;
/** Plana formulas write CH3/COOH at the ends and need a little less. */
const PLANA_STRETCH = 1.6;

/** Atoms whose hydrogen the conventions want drawn as a bond. */
function wantsExplicitH(mol: Molecule, i: number, conv: Conventions): boolean {
  const a = mol.atoms[i];
  if (a.hydrogens !== 1 || mol.degree(i) !== 2 || a.charge !== 0) return false;
  const inRing = mol.rings.some((r) => r.includes(i));
  if (conv.aldehydeHydrogen && a.element === 'C' && !a.aromatic && !inRing) {
    return mol.neighbors(i).some((n) => mol.atoms[n].element === 'O' && mol.degree(n) === 1 && mol.bondBetween(i, n)!.order === 2);
  }
  return conv.amineHydrogen && a.element === 'N' && !inRing && !a.aromatic;
}

export function depict(input: string | Molecule, options: DepictOptions = {}): Drawing {
  const conv = resolveConventions(options.conventions);
  const style = resolveStyle(options.style);
  let mol = markSources(typeof input === 'string' ? moleculeFromSmiles(input) : input);
  const formula: FormulaKind = options.formula ?? (options.explicitHydrogens ? 'structural' : 'skeletal');
  let coords: Vec[];
  if (formula === 'structural') {
    mol = expandHydrogens(mol);
    coords = computeLayout(mol, { rotationStep: 90 });
  } else if (formula === 'condensed') {
    // Lay out as a full structural formula (straight chains, 90° branches), then fold
    // the hydrogens back into the carbon labels.
    const full = expandHydrogens(mol);
    coords = computeLayout(full, { rotationStep: 90, ignoreHydrogenClashes: true })
      .slice(0, mol.atoms.length)
      .map((p) => scale(p, CONDENSED_STRETCH));
  } else if (formula === 'plana') {
    // ENEM's "fórmula estrutural plana": end groups condensed (CH3, NH2, COOH), the
    // backbone carbons written as C with every bond, hydrogens included, drawn.
    const reduced = abbreviate(mol, options.abbreviations ?? ALL_ABBREVIATIONS);
    const full = expandHydrogens(reduced);
    const all = computeLayout(full, { rotationStep: 90, chain: 'functional', ignoreHydrogenClashes: true });
    const n = reduced.atoms.length;
    const backbone = (i: number) => {
      const a = reduced.atoms[i];
      return a.element === 'C' && !a.abbreviation && reduced.degree(i) >= 2;
    };
    const keep = full.atoms.map((a) => a.index).filter((i) => i < n || backbone(full.neighbors(i)[0]));
    const { mol: drawn, map } = subset(full, keep);
    for (let i = 0; i < n; i++) drawn.atoms[map.get(i)!].hydrogens = backbone(i) ? 0 : reduced.atoms[i].hydrogens;
    coords = keep.map((i) => scale(all[i], PLANA_STRETCH));
    mol = drawn;
  } else {
    mol = abbreviate(mol, options.abbreviations ?? conv.abbreviations);
    if (conv.aldehydeHydrogen || conv.amineHydrogen) {
      const before = mol;
      mol = addHydrogens(before, (i) => wantsExplicitH(before, i, conv));
    }
    coords = computeLayout(mol, { pose: conv.pose, writtenOut: false });
  }
  if (conv.ionPairs) pairIons(mol, coords, style);
  const info = ringInfo(mol, mol.rings);
  if (options.stereo !== false) assignWedges(mol, coords, info.bondInRing);
  const carbonLabels = formula === 'skeletal' ? (options.carbonLabels ?? conv.carbonLabels) : 'all';
  return draw(mol, coords, { ...options, formula, style }, carbonLabels);
}

/**
 * Move each single-atom ion (Na+, K+, Cl-...) right beside an atom of opposite
 * charge, on that atom's free side, the way "O⁻ Na⁺" is set in print.
 */
function pairIons(mol: Molecule, coords: Vec[], style: DrawStyle) {
  const comps = mol.components();
  if (comps.length < 2) return;
  const fs = style.fontSize;
  const used = new Set<number>();
  for (const comp of comps) {
    if (comp.length !== 1 || !mol.atoms[comp[0]].charge) continue;
    const ion = comp[0];
    const q = mol.atoms[ion].charge;
    const partner = mol.atoms.find((a) => a.charge * q < 0 && mol.degree(a.index) > 0 && !used.has(a.index));
    if (!partner) continue;
    used.add(partner.index);
    const p = coords[partner.index];
    const angles = mol.neighbors(partner.index).map((n) => angleOf(sub(coords[n], p)));
    // Reading order first: to the right unless a bond is in the way, then left, below, above.
    const dirs = [vec(1, 0), vec(-1, 0), vec(0, -1), vec(0, 1)];
    const clearance = (d: Vec) => Math.min(2, ...angles.map((t) => 1 - (Math.cos(t) * d.x + Math.sin(t) * d.y)));
    const dir = dirs.find((d) => clearance(d) >= 0.9) ?? [...dirs].sort((a, b) => clearance(b) - clearance(a))[0];
    const chargeW = advance('+') * style.subscriptScale * fs * String(Math.abs(partner.charge)).length;
    const along =
      dir.x !== 0
        ? (advance(partner.element) * fs) / 2 + chargeW + 0.35 * fs + (advance(mol.atoms[ion].element) * fs) / 2
        : FONT_METRICS.capHeight * fs + 0.6 * fs;
    coords[ion] = add(p, scale(dir, along));
  }
}

function labelColor(element: string, style: DrawStyle): string {
  if (style.palette === 'mono' || element === 'C' || element === 'H') return style.ink;
  const c = elementInfo(element)?.color;
  return c && c !== '#1b1b1f' ? c : style.ink;
}

function draw(
  mol: Molecule,
  coords: Vec[],
  options: DepictOptions & { style: DrawStyle },
  carbonLabels: Conventions['carbonLabels'],
): Drawing {
  const style = options.style;
  const L = style.bondLength;
  const lw = style.lineWidth * L;
  const spacing = style.bondSpacing * L;
  const margin = style.labelMargin * L;
  const P = coords.map((c) => vec(c.x * L, -c.y * L));
  const formula = options.formula ?? 'skeletal';
  const heavyNeighbors = (i: number) => mol.neighbors(i).filter((n) => mol.atoms[n].element !== 'H');
  /** The booklets write CH3 on O/S, terminal =CH2, and methyls on C=C carbons. */
  const enemCarbonLabel = (i: number) => {
    const nb = heavyNeighbors(i);
    if (nb.length !== 1) return false;
    const n = nb[0];
    const el = mol.atoms[n].element;
    if (el === 'O' || el === 'S') return true;
    if (mol.bondBetween(i, n)!.order === 2) return true;
    return (
      el === 'C' &&
      mol.adjacency[n].some((bi) => {
        const b = mol.bonds[bi];
        const o = mol.other(b, n);
        return b.order === 2 && !b.aromatic && o !== i && mol.atoms[o].element === 'C';
      })
    );
  };

  // ---- labels
  const labels: (AtomLabel | undefined)[] = mol.atoms.map(() => undefined);
  for (const atom of mol.atoms) {
    const deg = mol.degree(atom.index);
    const isCarbon = atom.element === 'C';
    const show =
      !isCarbon ||
      deg === 0 ||
      atom.charge !== 0 ||
      atom.isotope !== undefined ||
      atom.label !== undefined ||
      atom.abbreviation !== undefined ||
      carbonLabels === 'all' ||
      (carbonLabels === 'terminal' && deg <= 1) ||
      (carbonLabels === 'enem' && enemCarbonLabel(atom.index));
    if (!show) continue;
    const bondAngles = mol.neighbors(atom.index).map((n) => angleOf(sub(coords[n], coords[atom.index])));
    if (atom.abbreviation) {
      // Read away from the bond: "COOH" when the bond comes from the left, "HOOC" otherwise.
      const towardsRight = bondAngles.some((t) => Math.cos(t) > 0.3);
      labels[atom.index] = layoutLabel(
        {
          atom: atom.index,
          symbol: atom.element,
          hydrogens: 0,
          charge: 0,
          color: labelColor(atom.element, style),
          text: towardsRight ? { value: atom.abbreviation.left, anchor: 'last' } : { value: atom.abbreviation.right, anchor: 'first' },
        },
        P[atom.index],
        'right',
        style,
      );
      continue;
    }
    let symbol = atom.label ?? (atom.element === '*' ? 'R' : atom.element);
    let symbolSubscript: string | undefined;
    const rMatch = /^R(\d+)$/.exec(symbol);
    if (rMatch) {
      symbol = 'R';
      symbolSubscript = rMatch[1];
    }
    const spec: LabelSpec = {
      atom: atom.index,
      symbol,
      symbolSubscript,
      hydrogens: atom.hydrogens,
      charge: atom.charge,
      isotope: atom.isotope,
      color: labelColor(atom.element, style),
    };
    const side = atom.isotope !== undefined ? 'right' : chooseHydrogenSide(bondAngles, symbol, formula === 'condensed');
    labels[atom.index] = layoutLabel(spec, P[atom.index], side, style);
  }

  const prims: Primitive[] = [];
  const line = (a: Vec, b: Vec, bond: number) => prims.push({ type: 'line', a, b, width: lw, color: style.ink, bond });

  /** Clip a stroke at labelled ends; returns undefined when nothing visible remains. */
  const clip = (a: Vec, b: Vec, atomA: number, atomB: number): [Vec, Vec] | undefined => {
    let t0 = 0;
    let t1 = 1;
    const la = labels[atomA];
    const lb = labels[atomB];
    if (la) t0 = clipParam(a, b, la, margin);
    if (lb) t1 = 1 - clipParam(b, a, lb, margin);
    if (t1 - t0 < 0.02) return undefined;
    return [lerp(a, b, t0), lerp(a, b, t1)];
  };

  // ---- aromatic circles
  const circleBond = new Set<number>();
  if (options.aromaticCircles) {
    for (const ring of mol.rings) {
      const bonds = ring.map((a, k) => mol.bondBetween(a, ring[(k + 1) % ring.length])!);
      if (!bonds.every((b) => b?.aromatic)) continue;
      bonds.forEach((b) => circleBond.add(b.index));
      const pts = ring.map((a) => P[a]);
      const c = centroid(pts);
      const apothem = Math.min(...bonds.map((b) => distToLine(c, P[b.a], P[b.b])));
      prims.push({ type: 'circle', center: c, r: Math.max(apothem - 2.6 * spacing, apothem * 0.45), width: lw, color: style.ink });
    }
  }

  const ringsOfBond = (bond: { a: number; b: number }) =>
    mol.rings.filter((ring) => {
      const i = ring.indexOf(bond.a);
      const j = ring.indexOf(bond.b);
      if (i < 0 || j < 0) return false;
      const n = ring.length;
      return (i + 1) % n === j || (j + 1) % n === i;
    });

  // ---- bonds
  for (const bond of mol.bonds) {
    const { a, b } = bond;
    const pa = P[a];
    const pb = P[b];
    const u = norm(sub(pb, pa));
    const n = perp(u);
    const order = circleBond.has(bond.index) ? 1 : bond.order;

    if (bond.display === 'wedge' || bond.display === 'hash') {
      drawWedge(bond.index, a, b);
      continue;
    }

    if (order === 1 || order > 3) {
      const seg = clip(pa, pb, a, b);
      if (seg) line(seg[0], seg[1], bond.index);
      continue;
    }

    if (order === 3) {
      for (const off of [-spacing, 0, spacing]) {
        const seg = clip(add(pa, scale(n, off)), add(pb, scale(n, off)), a, b);
        if (seg) line(seg[0], seg[1], bond.index);
      }
      continue;
    }

    // ---- double bonds
    const placement = doublePlacement(bond.index);
    if (placement === 0) {
      for (const sgn of [-1, 1]) {
        const off = scale(n, (sgn * spacing) / 2);
        let s = add(pa, off);
        let e = add(pb, off);
        if (!labels[a]) s = add(s, scale(u, joinExtension(a, b, u, n, sgn, spacing / 2)));
        if (!labels[b]) e = add(e, scale(u, -joinExtension(b, a, scale(u, -1), n, sgn, spacing / 2)));
        const seg = clip(s, e, a, b);
        if (seg) line(seg[0], seg[1], bond.index);
      }
    } else {
      const main = clip(pa, pb, a, b);
      if (main) line(main[0], main[1], bond.index);
      const off = scale(n, placement * spacing);
      const trimA = labels[a] ? 0 : innerTrim(a, b, placement, n);
      const trimB = labels[b] ? 0 : innerTrim(b, a, placement, n);
      const s = add(add(pa, off), scale(u, trimA));
      const e = add(add(pb, off), scale(u, -trimB));
      if (dot(sub(e, s), u) > 0.05 * L) {
        const seg = clip(s, e, a, b);
        if (seg) line(seg[0], seg[1], bond.index);
      }
    }
  }

  function sideOf(origin: Vec, dir: Vec, p: Vec): number {
    const c = cross(dir, sub(p, origin));
    return Math.abs(c) < 1e-6 ? 0 : Math.sign(c);
  }

  /** 0 = centred, +1/-1 = second stroke on the left/right of a -> b (y-down px space). */
  function doublePlacement(bi: number): number {
    const bond = mol.bonds[bi];
    const { a, b } = bond;
    const pa = P[a];
    const pb = P[b];
    const u = norm(sub(pb, pa));
    const rings = ringsOfBond(bond);
    if (rings.length) {
      const score = (ring: number[]) => {
        let doubles = 0;
        for (let k = 0; k < ring.length; k++) {
          if (mol.bondBetween(ring[k], ring[(k + 1) % ring.length])?.order === 2) doubles++;
        }
        return doubles * 3 - Math.abs(ring.length - 6);
      };
      const ring = [...rings].sort((p, q) => score(q) - score(p))[0];
      return sideOf(pa, u, centroid(ring.map((x) => P[x]))) || 1;
    }
    const sidesA = mol.neighbors(a).filter((x) => x !== b).map((x) => sideOf(pa, u, P[x]));
    const sidesB = mol.neighbors(b).filter((x) => x !== a).map((x) => sideOf(pa, u, P[x]));
    const terminal = sidesA.length === 0 || sidesB.length === 0;
    const all = [...sidesA, ...sidesB];
    const sum = all.reduce((s, v) => s + v, 0);
    if (terminal) {
      const others = sidesA.length ? sidesA : sidesB;
      const terminalAtom = sidesA.length ? b : a;
      const bothSides = others.includes(1) && others.includes(-1);
      if (labels[terminalAtom] || bothSides || others.every((v) => v === 0)) return 0;
      return Math.sign(sum) || 1;
    }
    if (sum !== 0) return Math.sign(sum);
    // Balanced (e.g. trans alkene): offset towards the bulk of the molecule.
    const mid = lerp(pa, pb, 0.5);
    return sideOf(pa, u, add(mid, sub(centroid(P), mid))) || 1;
  }

  /** How far the inner stroke of an offset double bond is pulled back at `end`. */
  function innerTrim(end: number, other: number, side: number, n: Vec): number {
    const pe = P[end];
    const toOther = norm(sub(P[other], pe));
    let best = Infinity;
    for (const x of mol.neighbors(end)) {
      if (x === other) continue;
      const v = norm(sub(P[x], pe));
      if (Math.sign(dot(v, n)) !== side) continue;
      const alpha = Math.acos(Math.max(-1, Math.min(1, dot(v, toOther))));
      if (alpha > 1e-3) best = Math.min(best, spacing / Math.tan(alpha / 2));
    }
    if (!Number.isFinite(best)) best = spacing * Math.tan(Math.PI / 6);
    return Math.min(best, 0.35 * L);
  }

  /**
   * For a centred double bond, extend (or shorten) the stroke on side `sgn` so it
   * meets the neighbouring bond on that side exactly, closing the joint.
   */
  function joinExtension(end: number, other: number, u: Vec, n: Vec, sgn: number, off: number): number {
    const pe = P[end];
    let bestT = 0;
    let bestAlpha = Infinity;
    for (const x of mol.neighbors(end)) {
      if (x === other) continue;
      const v = norm(sub(P[x], pe));
      if (Math.sign(dot(v, n)) !== sgn) continue;
      const alpha = Math.acos(Math.max(-1, Math.min(1, dot(v, u))));
      if (alpha > (150 * Math.PI) / 180 || alpha >= bestAlpha) continue;
      const t = lineIntersectionT(add(pe, scale(n, sgn * off)), u, pe, v);
      if (t === null || Math.abs(t) > 0.3 * L) continue;
      bestAlpha = alpha;
      bestT = t;
    }
    return bestT;
  }

  function drawWedge(bi: number, a: number, b: number) {
    const bond = mol.bonds[bi];
    const pa = P[a];
    const pb = P[b];
    let t0 = 0;
    let t1 = 1;
    if (labels[a]) t0 = clipParam(pa, pb, labels[a]!, margin);
    if (labels[b]) t1 = 1 - clipParam(pb, pa, labels[b]!, margin);
    if (t1 - t0 < 0.05) return;
    const u = norm(sub(pb, pa));
    const n = perp(u);
    const tip = lw * 0.9;
    const wide = style.wedgeWidth * L;
    const widthAt = (t: number) => tip + (wide - tip) * t;
    const at = (t: number) => lerp(pa, pb, t);
    if (bond.display === 'wedge') {
      const s = at(t0);
      const e = at(t1);
      const w0 = widthAt(t0) / 2;
      const w1 = widthAt(t1) / 2;
      prims.push({
        type: 'polygon',
        points: [add(s, scale(n, w0)), add(e, scale(n, w1)), add(e, scale(n, -w1)), add(s, scale(n, -w0))],
        color: style.ink,
        bond: bi,
      });
    } else {
      const length = len(sub(pb, pa)) * (t1 - t0);
      const count = Math.max(3, Math.round(length / (style.hashSpacing * L)));
      for (let k = 0; k <= count; k++) {
        const t = t0 + ((t1 - t0) * (k + 0.35)) / (count + 0.35);
        if (t > t1 + 1e-9) break;
        const c = at(t);
        const w = Math.max(widthAt(t), lw * 2.2) / 2;
        prims.push({ type: 'line', a: add(c, scale(n, w)), b: add(c, scale(n, -w)), width: lw, color: style.ink, bond: bi });
      }
    }
  }

  // ---- callers address atoms of the molecule they passed in; map to drawn atoms
  const drawnOf = new Map<number, number>();
  for (const a of mol.atoms) {
    if (a.source !== undefined && !drawnOf.has(a.source)) drawnOf.set(a.source, a.index);
    for (const m of a.members ?? []) drawnOf.set(m, a.index);
  }
  // Hydrogens written out for drawing (O=C–H, N–H) belong to the group of their atom.
  const toDrawn = (list: number[] = []) => {
    const set = new Set(list.map((i) => drawnOf.get(i)).filter((i): i is number => i !== undefined));
    for (const i of [...set]) {
      for (const n of mol.neighbors(i)) if (mol.atoms[n].element === 'H' && mol.atoms[n].source === undefined) set.add(n);
    }
    return [...set];
  };

  // ---- highlights (drawn underneath)
  const underlay: Primitive[] = [];
  for (const hl of options.highlights ?? []) {
    const atomsHl = toDrawn(hl.atoms);
    const set = new Set(atomsHl);
    const bondsHl = hl.bonds ?? mol.bonds.filter((b) => set.has(b.a) && set.has(b.b)).map((b) => b.index);
    for (const bi of bondsHl) {
      const bond = mol.bonds[bi];
      if (!bond) continue;
      underlay.push({ type: 'line', a: P[bond.a], b: P[bond.b], width: 0.34 * L, color: hl.color, bond: bi });
    }
    for (const ai of atomsHl) {
      underlay.push({ type: 'circle', center: P[ai], r: 0.3 * L, width: 0, color: 'none', fill: hl.color, atom: ai });
    }
  }

  const finalLabels = labels.filter((l): l is AtomLabel => !!l);
  const atoms: AtomSite[] = mol.atoms.map((a) => ({
    index: a.source ?? -1,
    x: P[a.index].x,
    y: P[a.index].y,
    element: a.element,
    labelled: !!labels[a.index],
  }));

  // ---- annotations: dashed outline around each group, its name set in bold beside it
  const outlines: OutlinePrim[] = [];
  const texts: FreeText[] = [];
  const fs = style.fontSize * L;
  type Rect = { x1: number; y1: number; x2: number; y2: number };
  const overlaps = (a: Rect, b: Rect) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const segHitsRect = (p: Vec, q: Vec, r: Rect) => {
    for (let k = 0; k <= 8; k++) {
      const x = p.x + ((q.x - p.x) * k) / 8;
      const y = p.y + ((q.y - p.y) * k) / 8;
      if (x > r.x1 && x < r.x2 && y > r.y1 && y < r.y2) return true;
    }
    return false;
  };
  const inside = (pt: Vec, poly: Vec[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const anns = (options.annotations ?? []).map((ann) => ({ ann, group: toDrawn(ann.atoms) })).filter((g) => g.group.length);
  const groupOfAtom = new Map<number, number>();
  anns.forEach((g, gi) => g.group.forEach((a) => groupOfAtom.set(a, gi)));
  const taken: Rect[] = [];
  const mc = centroid(P);
  anns.forEach(({ ann, group }, gi) => {
    const pts: Vec[] = [];
    for (const i of group) {
      pts.push(P[i]);
      for (const box of labels[i]?.boxes ?? []) pts.push(vec(box.x1, box.y1), vec(box.x2, box.y2), vec(box.x1, box.y2), vec(box.x2, box.y1));
    }
    const pad = 0.3 * L;
    let withLabel: Vec[] | undefined;
    const ownNames = taken.length;
    if (ann.label) {
      const w = advance(ann.label) * fs * BOLD_WIDTH;
      const h = FONT_METRICS.capHeight * fs;
      const gc = centroid(group.map((i) => P[i]));
      const away = sub(gc, mc);
      const base = Math.hypot(away.x, away.y) < 1e-6 ? -Math.PI / 2 : Math.atan2(away.y, away.x);
      const reach = Math.max(...pts.map((p) => Math.hypot(p.x - gc.x, p.y - gc.y)));
      let best: { rect: Rect; score: number } | undefined;
      for (let k = 0; k < 16; k++) {
        const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const t = base + off;
        for (const extra of [0.2, 0.55]) {
          const d = reach + extra * L + Math.abs(Math.cos(t)) * (w / 2) + Math.abs(Math.sin(t)) * (h / 2);
          const cx = gc.x + Math.cos(t) * d;
          const cy = gc.y + Math.sin(t) * d;
          const rect = { x1: cx - w / 2 - 0.08 * L, x2: cx + w / 2 + 0.08 * L, y1: cy - h / 2 - 0.08 * L, y2: cy + h / 2 + 0.08 * L };
          let score = Math.abs(off) * 0.15 + extra * 0.5;
          P.forEach((p, i) => {
            if (p.x > rect.x1 - 0.25 * L && p.x < rect.x2 + 0.25 * L && p.y > rect.y1 - 0.25 * L && p.y < rect.y2 + 0.25 * L) {
              score += groupOfAtom.get(i) === gi ? 0.5 : 4;
            }
          });
          for (const b of mol.bonds) if (segHitsRect(P[b.a], P[b.b], rect)) score += 3;
          for (const l of finalLabels) for (const bx of l.boxes) if (overlaps(bx, rect)) score += 4;
          for (const r of taken) if (overlaps(r, rect)) score += 6;
          if (!best || score < best.score) best = { rect, score };
        }
      }
      const r = best!.rect;
      const cx = (r.x1 + r.x2) / 2;
      const cy = (r.y1 + r.y2) / 2;
      texts.push({ text: ann.label, x: cx, y: cy + h / 2, size: fs, weight: 700, anchor: 'middle' });
      taken.push(r);
      withLabel = [...pts, vec(r.x1, r.y1), vec(r.x2, r.y1), vec(r.x1, r.y2), vec(r.x2, r.y2)];
    }
    // An ellipse around the group and its name, as drawn in the booklets; tighter shapes
    // only when the ellipse would swallow atoms or names of other groups.
    const others = [
      ...P.filter((_, i) => !group.includes(i)).flatMap((p) => [p, ...[0, 1, 2, 3, 4, 5].map((k) => add(p, fromAngle((k * Math.PI) / 3, 0.18 * L)))]),
      ...taken.slice(0, ownNames).map((t) => vec((t.x1 + t.x2) / 2, (t.y1 + t.y2) / 2)),
    ];
    const candidates = [
      ...(withLabel ? [roundedEllipse(withLabel, pad), roundedHull(withLabel, pad)] : []),
      roundedEllipse(pts, pad),
      roundedHull(pts, pad),
    ];
    const points = candidates.find((c) => !others.some((p) => inside(p, c))) ?? candidates[candidates.length - 1];
    outlines.push({
      points,
      width: lw * 0.85,
      dash: [style.annotationDash[0] * L, style.annotationDash[1] * L],
      color: style.annotationColor,
    });
  });

  let viewBox = bounds(P, prims, underlay, finalLabels, style, outlines, texts);
  // ---- caption: bold name centred under the structure, source line under it
  if (options.caption || options.source) {
    const pad = style.padding * L;
    const cx = viewBox.x + viewBox.width / 2;
    let y = viewBox.y + viewBox.height - pad + 0.75 * fs;
    if (options.caption) {
      y += FONT_METRICS.capHeight * fs;
      texts.push({ text: options.caption, x: cx, y, size: fs, weight: 700, anchor: 'middle' });
    }
    if (options.source) {
      y += 1.25 * fs;
      texts.push({ text: options.source, x: cx, y, size: fs, weight: 400, anchor: 'middle' });
    }
    viewBox = bounds(P, prims, underlay, finalLabels, style, outlines, texts);
  }
  return { molecule: mol, style, viewBox, underlay, primitives: prims, labels: finalLabels, outlines, texts, atoms };
}

/** Arial Bold runs about 8% wider than the regular metrics used for labels. */
const BOLD_WIDTH = 1.08;

function distToLine(p: Vec, a: Vec, b: Vec): number {
  const u = norm(sub(b, a));
  return Math.abs(cross(u, sub(p, a)));
}

function bounds(
  P: Vec[],
  prims: Primitive[],
  underlay: Primitive[],
  labels: AtomLabel[],
  style: DrawStyle,
  outlines: OutlinePrim[] = [],
  texts: FreeText[] = [],
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  };
  for (const p of P) grow(p.x, p.y);
  for (const prim of [...prims, ...underlay]) {
    if (prim.type === 'line') {
      grow(prim.a.x, prim.a.y, prim.width / 2);
      grow(prim.b.x, prim.b.y, prim.width / 2);
    } else if (prim.type === 'polygon') {
      for (const p of prim.points) grow(p.x, p.y);
    } else {
      grow(prim.center.x, prim.center.y, prim.r + prim.width / 2);
    }
  }
  for (const label of labels) {
    for (const run of label.runs) {
      grow(run.x, run.y - FONT_METRICS.ascender * run.size);
      grow(run.x + advance(run.text) * run.size, run.y - FONT_METRICS.descender * run.size * 0.4);
    }
  }
  for (const o of outlines) for (const p of o.points) grow(p.x, p.y, o.width);
  for (const t of texts) {
    const w = advance(t.text) * t.size * (t.weight >= 600 ? BOLD_WIDTH : 1);
    const x0 = t.anchor === 'middle' ? t.x - w / 2 : t.x;
    grow(x0, t.y - FONT_METRICS.ascender * t.size);
    grow(x0 + w, t.y - FONT_METRICS.descender * t.size);
  }
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  const pad = style.padding * style.bondLength;
  return { x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad };
}
