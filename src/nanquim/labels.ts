/**
 * Atom label typesetting: element symbol, attached hydrogens (with subscripts) on the
 * free side of the atom, charges and isotopes as superscripts. Produces positioned
 * glyph runs plus tight boxes that bonds are clipped against.
 */
import { type Vec, add, scale } from './geometry.ts';
import { FONT_METRICS, advance } from './font.ts';
import type { DrawStyle } from './style.ts';

export interface TextRun {
  text: string;
  /** Left edge of the run and its baseline, in output px (y-down). */
  x: number;
  y: number;
  size: number;
}

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AtomLabel {
  atom: number;
  runs: TextRun[];
  boxes: Box[];
  color: string;
}

export type HSide = 'right' | 'left' | 'up' | 'down';

export interface LabelSpec {
  atom: number;
  symbol: string;
  hydrogens: number;
  charge: number;
  isotope?: number;
  /** Subscript appended to the symbol itself (R1, R2 ...). */
  symbolSubscript?: string;
  color: string;
}

/**
 * Pick the side for attached hydrogens: right unless a bond points that way,
 * then left, then above, then below. `bondAngles` are y-up radians.
 * With `inline` (condensed formulas) hydrogens stay in the text line, "CH2",
 * and the bond simply starts after them.
 */
export function chooseHydrogenSide(bondAngles: number[], symbol: string, inline = false): HSide {
  if (!bondAngles.length) return ['O', 'S', 'Se', 'F', 'Cl', 'Br', 'I'].includes(symbol) ? 'left' : 'right';
  const blocked = (dir: Vec) => bondAngles.some((t) => Math.cos(t) * dir.x + Math.sin(t) * dir.y > 0.3);
  if (inline) {
    // A horizontal bond can leave from the end of "CH2"; a slanted one would cut through it.
    const slanted = (sx: number) => bondAngles.some((t) => Math.cos(t) * sx > 0.3 && Math.abs(Math.sin(t)) > 0.2);
    const free = (sx: number) => !bondAngles.some((t) => Math.cos(t) * sx > 0.3);
    if (!slanted(1) && (free(1) || !free(-1) || slanted(-1))) return 'right';
    if (free(-1)) return 'left';
  }
  if (!blocked({ x: 1, y: 0 })) return 'right';
  if (!blocked({ x: -1, y: 0 })) return 'left';
  if (!blocked({ x: 0, y: 1 })) return 'up';
  if (!blocked({ x: 0, y: -1 })) return 'down';
  // Everything is crowded: take the direction with the most clearance.
  const dirs: Array<[HSide, Vec]> = [
    ['right', { x: 1, y: 0 }],
    ['left', { x: -1, y: 0 }],
    ['up', { x: 0, y: 1 }],
    ['down', { x: 0, y: -1 }],
  ];
  let best: HSide = 'right';
  let bestScore = Infinity;
  for (const [side, d] of dirs) {
    const worst = Math.max(...bondAngles.map((t) => Math.cos(t) * d.x + Math.sin(t) * d.y));
    if (worst < bestScore) {
      bestScore = worst;
      best = side;
    }
  }
  return best;
}

function runBox(run: TextRun, kind: 'cap' | 'super' | 'sub'): Box {
  const w = advance(run.text) * run.size;
  const sb = FONT_METRICS.sideBearing * run.size;
  const top = kind === 'super' ? 0.72 : FONT_METRICS.capHeight;
  return { x1: run.x + sb, x2: run.x + w - sb, y1: run.y - top * run.size, y2: run.y };
}

export function chargeText(charge: number): string {
  if (!charge) return '';
  const sign = charge > 0 ? '+' : '−';
  return Math.abs(charge) === 1 ? sign : `${Math.abs(charge)}${sign}`;
}

/** Typeset a label centred on `at` (output px, y-down). */
export function layoutLabel(spec: LabelSpec, at: Vec, side: HSide, style: DrawStyle): AtomLabel {
  const L = style.bondLength;
  const fs = style.fontSize * L;
  const sub = fs * style.subscriptScale;
  const capH = FONT_METRICS.capHeight * fs;
  const baseline = at.y + capH / 2;
  const subDrop = 0.24 * fs;
  const supRise = 0.38 * fs;

  const runs: TextRun[] = [];
  const boxes: Box[] = [];
  const push = (run: TextRun, kind: 'cap' | 'super' | 'sub') => {
    runs.push(run);
    boxes.push(runBox(run, kind));
  };

  // Centre the element symbol itself (not the whole label) on the atom.
  const symW = advance(spec.symbol) * fs;
  const symX = at.x - symW / 2;
  push({ text: spec.symbol, x: symX, y: baseline, size: fs }, 'cap');
  let right = symX + symW;
  if (spec.symbolSubscript) {
    push({ text: spec.symbolSubscript, x: right, y: baseline + subDrop, size: sub }, 'sub');
    right += advance(spec.symbolSubscript) * sub;
  }

  const h = spec.hydrogens;
  const hW = advance('H') * fs;
  const countText = h > 1 ? String(h) : '';
  const countW = advance(countText) * sub;
  if (h > 0) {
    if (side === 'right') {
      push({ text: 'H', x: right, y: baseline, size: fs }, 'cap');
      right += hW;
      if (countText) {
        push({ text: countText, x: right, y: baseline + subDrop, size: sub }, 'sub');
        right += countW;
      }
    } else if (side === 'left') {
      const start = symX - hW - countW;
      push({ text: 'H', x: start, y: baseline, size: fs }, 'cap');
      if (countText) push({ text: countText, x: start + hW, y: baseline + subDrop, size: sub }, 'sub');
    } else {
      const gap = 0.16 * fs;
      const y = side === 'up' ? baseline - capH - gap : baseline + capH + gap;
      const hx = at.x - hW / 2;
      push({ text: 'H', x: hx, y, size: fs }, 'cap');
      if (countText) push({ text: countText, x: hx + hW, y: y + subDrop, size: sub }, 'sub');
    }
  }

  const ch = chargeText(spec.charge);
  if (ch) {
    push({ text: ch, x: right + 0.02 * fs, y: baseline - supRise, size: sub }, 'super');
  }
  if (spec.isotope !== undefined) {
    const iso = String(spec.isotope);
    const w = advance(iso) * sub;
    const leftEdge = Math.min(...runs.map((r) => r.x));
    push({ text: iso, x: Math.min(symX, leftEdge) - w - 0.02 * fs, y: baseline - supRise, size: sub }, 'super');
  }
  return { atom: spec.atom, runs, boxes, color: spec.color };
}

function distToBox(p: Vec, b: Box): number {
  const dx = Math.max(b.x1 - p.x, 0, p.x - b.x2);
  const dy = Math.max(b.y1 - p.y, 0, p.y - b.y2);
  return Math.hypot(dx, dy);
}

export function insideLabel(p: Vec, label: AtomLabel, margin: number): boolean {
  return label.boxes.some((b) => distToBox(p, b) <= margin);
}

/**
 * Parameter t in [0, 1] where the segment from -> to leaves the label's padded
 * outline (a union of rounded rectangles). Returns 0 when `from` is outside it.
 */
export function clipParam(from: Vec, to: Vec, label: AtomLabel, margin: number): number {
  const at = (t: number) => add(from, scale({ x: to.x - from.x, y: to.y - from.y }, t));
  if (!insideLabel(from, label, margin)) return 0;
  // March the whole segment and keep the last covered sample: a stroke may leave the
  // symbol and graze a subscript further out.
  const steps = 96;
  let lo = 0;
  for (let i = 1; i <= steps; i++) {
    if (insideLabel(at(i / steps), label, margin)) lo = i / steps;
  }
  if (lo >= 1) return 1;
  let hi = lo + 1 / steps;
  for (let it = 0; it < 30; it++) {
    const m = (lo + hi) / 2;
    if (insideLabel(at(m), label, margin)) lo = m;
    else hi = m;
  }
  return hi;
}
