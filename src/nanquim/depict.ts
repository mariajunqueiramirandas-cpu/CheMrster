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

export interface Highlight {
  atoms?: number[];
  bonds?: number[];
  color: string;
}

export type FormulaKind = 'skeletal' | 'condensed' | 'structural';

export interface DepictOptions {
  style?: StyleName | Partial<DrawStyle>;
  /**
   * 'skeletal' (fórmula de linhas / bastão, default), 'condensed' (H3C–CH2–OH with
   * straight chains) or 'structural' (every atom and bond written out).
   */
  formula?: FormulaKind;
  /** Which carbons get a written "C" label in skeletal formulas. */
  carbonLabels?: 'none' | 'terminal' | 'all';
  /** Same as formula: 'structural'. */
  explicitHydrogens?: boolean;
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

export interface AtomSite {
  index: number;
  x: number;
  y: number;
  element: string;
  labelled: boolean;
}

export interface Drawing {
  molecule: Molecule;
  style: DrawStyle;
  viewBox: { x: number; y: number; width: number; height: number };
  underlay: Primitive[];
  primitives: Primitive[];
  labels: AtomLabel[];
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

export function depict(input: string | Molecule, options: DepictOptions = {}): Drawing {
  let mol = typeof input === 'string' ? moleculeFromSmiles(input) : input;
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
  } else {
    coords = computeLayout(mol);
  }
  const info = ringInfo(mol, mol.rings);
  if (options.stereo !== false) assignWedges(mol, coords, info.bondInRing);
  return draw(mol, coords, { ...options, formula });
}

function labelColor(element: string, style: DrawStyle): string {
  if (style.palette === 'mono' || element === 'C' || element === 'H') return style.ink;
  const c = elementInfo(element)?.color;
  return c && c !== '#1b1b1f' ? c : style.ink;
}

function draw(mol: Molecule, coords: Vec[], options: DepictOptions): Drawing {
  const style = resolveStyle(options.style);
  const L = style.bondLength;
  const lw = style.lineWidth * L;
  const spacing = style.bondSpacing * L;
  const margin = style.labelMargin * L;
  const P = coords.map((c) => vec(c.x * L, -c.y * L));
  const formula = options.formula ?? 'skeletal';
  const carbonLabels = formula === 'skeletal' ? (options.carbonLabels ?? 'none') : 'all';

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
      carbonLabels === 'all' ||
      (carbonLabels === 'terminal' && deg <= 1);
    if (!show) continue;
    const bondAngles = mol.neighbors(atom.index).map((n) => angleOf(sub(coords[n], coords[atom.index])));
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

  // ---- highlights (drawn underneath)
  const underlay: Primitive[] = [];
  for (const hl of options.highlights ?? []) {
    for (const bi of hl.bonds ?? []) {
      const bond = mol.bonds[bi];
      if (!bond) continue;
      underlay.push({ type: 'line', a: P[bond.a], b: P[bond.b], width: 0.34 * L, color: hl.color, bond: bi });
    }
    for (const ai of hl.atoms ?? []) {
      if (!P[ai]) continue;
      underlay.push({ type: 'circle', center: P[ai], r: 0.3 * L, width: 0, color: 'none', fill: hl.color, atom: ai });
    }
  }

  const finalLabels = labels.filter((l): l is AtomLabel => !!l);
  const atoms: AtomSite[] = mol.atoms.map((a) => ({
    index: a.index,
    x: P[a.index].x,
    y: P[a.index].y,
    element: a.element,
    labelled: !!labels[a.index],
  }));
  const viewBox = bounds(P, prims, underlay, finalLabels, style);
  return { molecule: mol, style, viewBox, underlay, primitives: prims, labels: finalLabels, atoms };
}

function distToLine(p: Vec, a: Vec, b: Vec): number {
  const u = norm(sub(b, a));
  return Math.abs(cross(u, sub(p, a)));
}

function bounds(P: Vec[], prims: Primitive[], underlay: Primitive[], labels: AtomLabel[], style: DrawStyle) {
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
  if (!Number.isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  const pad = style.padding * style.bondLength;
  return { x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad };
}
