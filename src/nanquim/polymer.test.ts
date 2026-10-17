import { describe, expect, it } from 'vitest';
import type { DepictOptions, FormulaKind, LinePrim } from './depict.ts';
import { depict, renderSVG } from './index.ts';
import { polymerEnds } from './layout.ts';

const POLYMERS: Record<string, string> = {
  PE: '*CC*',
  PP: '*CC(*)C',
  PVC: '*CC(*)Cl',
  PS: '*CC(*)c1ccccc1',
  PTFE: '*C(F)(F)C(*)(F)F',
  PAN: '*CC(*)C#N',
  PVA: '*CC(*)OC(C)=O',
  PMMA: '*CC(*)(C)C(=O)OC',
  PET: '*OCCOC(=O)c1ccc(cc1)C(*)=O',
  'náilon 6,6': '*NCCCCCCNC(=O)CCCCC(*)=O',
  Kevlar: '*Nc1ccc(cc1)NC(=O)c1ccc(cc1)C(*)=O',
  PLA: '*OC(C)C(*)=O',
  'poli-isopreno': '*C/C(C)=C\\C*',
};

const FORMULAS: FormulaKind[] = ['skeletal', 'condensed', 'plana', 'structural'];

function draw(smiles: string, options: DepictOptions) {
  const d = depict(smiles, { polymer: true, ...options });
  const marks = d.primitives.filter((p): p is LinePrim => p.type === 'line' && p.bond === undefined);
  const vertical = marks.filter((l) => Math.abs(l.a.x - l.b.x) < 1e-6).sort((p, q) => p.a.x - q.a.x);
  const serifs = marks.filter((l) => Math.abs(l.a.y - l.b.y) < 1e-6);
  return { d, marks, vertical, serifs };
}

describe('polymer repeat units', () => {
  for (const [name, smiles] of Object.entries(POLYMERS)) {
    for (const formula of FORMULAS) {
      it(`brackets ${name} (${formula})`, () => {
        const { d, marks, vertical, serifs } = draw(smiles, { formula, style: 'enem', conventions: 'enem' });
        const L = d.style.bondLength;
        // Two brackets, each a vertical stroke with two inward serifs.
        expect(marks).toHaveLength(6);
        expect(vertical).toHaveLength(2);
        expect(serifs).toHaveLength(4);
        const [left, right] = vertical.map((l) => l.a.x);
        const top = Math.min(...vertical.map((l) => Math.min(l.a.y, l.b.y)));
        const bottom = Math.max(...vertical.map((l) => Math.max(l.a.y, l.b.y)));
        for (const s of serifs) {
          const x = s.a.x === left || s.a.x === right ? s.b.x : s.a.x;
          expect(x > left && x < right, 'serifs point inwards').toBe(true);
        }

        // "n" after the foot of the closing bracket; no R anywhere.
        const n = d.texts.find((t) => t.text === 'n');
        expect(n).toBeDefined();
        expect(n!.x).toBeGreaterThan(right);
        expect(n!.y).toBeGreaterThan(bottom);
        for (const label of d.labels) expect(label.runs.map((r) => r.text).join('')).not.toContain('R');

        // Each end bond crosses its bracket and sticks out beyond it.
        const ends = polymerEnds(d.molecule)!;
        expect(ends).toBeDefined();
        for (const end of ends) {
          const bond = d.molecule.adjacency[end][0];
          const stroke = d.primitives.find((p): p is LinePrim => p.type === 'line' && p.bond === bond)!;
          const xs = [stroke.a.x, stroke.b.x].sort((p, q) => p - q);
          const bracket = d.atoms[end].x < (left + right) / 2 ? left : right;
          expect(xs[0] < bracket - 0.2 * L && xs[1] > bracket + 0.2 * L, `${name}: end bond crosses the bracket`).toBe(true);
          const y = stroke.a.y + ((bracket - stroke.a.x) / (stroke.b.x - stroke.a.x)) * (stroke.b.y - stroke.a.y);
          expect(y > top && y < bottom).toBe(true);
        }

        // The whole repeat unit sits between the brackets.
        d.atoms.forEach((a, i) => {
          if (ends.includes(i)) return;
          expect(a.x > left && a.x < right, `${name}: atom ${a.element} inside`).toBe(true);
          expect(a.y > top && a.y < bottom).toBe(true);
        });
        for (const label of d.labels) {
          for (const box of label.boxes) {
            expect(box.x1 > left && box.x2 < right, `${name}: label inside`).toBe(true);
            expect(box.y1 > top && box.y2 < bottom).toBe(true);
          }
        }
      });
    }
  }

  it('lays the chain flat and the open ends level in skeletal formulas', () => {
    for (const smiles of [POLYMERS.PE, POLYMERS.PVC, POLYMERS.PS, POLYMERS.PMMA, POLYMERS['náilon 6,6'], POLYMERS.Kevlar]) {
      const { d } = draw(smiles, { style: 'enem', conventions: 'enem' });
      for (const end of polymerEnds(d.molecule)!) {
        const nb = d.molecule.neighbors(end)[0];
        expect(Math.abs(d.atoms[end].y - d.atoms[nb].y), smiles).toBeLessThan(1e-6);
      }
    }
  });

  it('writes the chain straight in condensed formulas, side groups hanging below', () => {
    const { d } = draw(POLYMERS.PVC, { formula: 'condensed' });
    const [c1, c2, cl] = [1, 2, 4].map((i) => d.atoms.find((a) => a.index === i)!);
    expect(Math.abs(c1.y - c2.y)).toBeLessThan(1e-6);
    expect(cl.y).toBeGreaterThan(c2.y);
    expect(Math.abs(cl.x - c2.x)).toBeLessThan(1e-6);
  });

  it('keeps cis/trans along the chain (natural rubber is cis)', () => {
    for (const formula of ['skeletal', 'condensed'] as const) {
      const { d } = draw(POLYMERS['poli-isopreno'], { formula });
      const at = (i: number) => d.atoms.find((a) => a.index === i)!;
      // C1 and C4 on the same side of the C2=C3 axis.
      const [c1, c2, c3, c4] = [1, 2, 4, 5].map(at);
      const side = (p: { x: number; y: number }) => Math.sign((c3.x - c2.x) * (p.y - c2.y) - (c3.y - c2.y) * (p.x - c2.x));
      expect(side(c1), formula).toBe(side(c4));
    }
  });

  it('changes nothing without the option, or without exactly two open ends', () => {
    const plain = depict('*CC(*)Cl', { style: 'enem', conventions: 'enem' });
    expect(plain.labels.filter((l) => l.runs.some((r) => r.text === 'R'))).toHaveLength(2);
    expect(plain.texts).toHaveLength(0);
    expect(renderSVG('*CC(*)Cl', { polymer: false })).toBe(renderSVG('*CC(*)Cl'));
    for (const smiles of ['[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O', '*C(=O)O', 'CC(=O)Oc1ccccc1C(=O)O']) {
      for (const formula of FORMULAS) {
        expect(renderSVG(smiles, { formula, polymer: true })).toBe(renderSVG(smiles, { formula }));
      }
    }
  });
});
