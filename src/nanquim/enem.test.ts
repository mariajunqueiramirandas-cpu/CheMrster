/**
 * ENEM parity: each expectation mirrors something measured or observed in the INEP
 * booklets (2021–2025).
 */
import { describe, expect, it } from 'vitest';
import { depict } from './depict.ts';
import type { Drawing } from './depict.ts';
import { renderSVG } from './index.ts';
import { STYLES } from './style.ts';

const enem = { style: 'enem' as const, conventions: 'enem' as const };
const text = (d: Drawing, drawnAtom: number) =>
  d.labels
    .find((l) => l.atom === drawnAtom)
    ?.runs.slice()
    .sort((a, b) => a.x - b.x)
    .map((r) => r.text)
    .join('');
const labelTexts = (d: Drawing) => d.labels.map((l) => text(d, l.atom)!).sort();
const site = (d: Drawing, sourceIndex: number) => d.atoms.find((a) => a.index === sourceIndex)!;
const angle = (d: Drawing, from: number, to: number) => {
  const a = site(d, from);
  const b = site(d, to);
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
};

describe('ENEM style metrics (2023, Q134 at 600 dpi)', () => {
  it('matches the measured stroke, double-bond offset and label size', () => {
    const s = STYLES.enem;
    expect(s.lineWidth * 15.6).toBeCloseTo(0.72, 2);
    expect(s.bondSpacing * 15.6).toBeCloseTo(2.76, 2);
    expect(s.fontSize * 15.6).toBeCloseTo(9.75, 2);
    expect(s.fontFamily.startsWith('Arial')).toBe(true);
  });
});

describe('ENEM conventions', () => {
  it('draws the aldehyde H and puts the group on top of an upright ring (2022, Q102)', () => {
    const d = depict('O=Cc1ccccc1', enem);
    expect(d.molecule.atoms.filter((a) => a.element === 'H')).toHaveLength(1);
    expect(angle(d, 2, 1)).toBeCloseTo(90, 0); // ring carbon -> CHO carbon points up
    expect(site(d, 0).x).toBeLessThan(site(d, 1).x); // O=C up-left
  });

  it('puts the carboxyl on top for salicylic acid (2024, Q96)', () => {
    const d = depict('OC(=O)c1ccccc1O', enem);
    expect(angle(d, 3, 1)).toBeCloseTo(90, 0);
  });

  it('lays para rings rising to the right, larger group on the right (2023, Q134)', () => {
    const d = depict('CC(=O)Nc1ccc(O)cc1', enem); // paracetamol
    expect(angle(d, 4, 3)).toBeCloseTo(30, 0); // ring -> N
  });

  it('draws the amide N–H as a bond', () => {
    const d = depict('CCOc1ccc(NC(C)=O)cc1', enem);
    const n = d.molecule.atoms.find((a) => a.element === 'N')!;
    expect(d.molecule.neighbors(n.index).some((x) => d.molecule.atoms[x].element === 'H')).toBe(true);
  });

  it('labels O-methyls and alkene-end carbons, not other chain ends (2022, Q102)', () => {
    expect(labelTexts(depict('COc1ccc(/C=C/C)cc1', enem))).toEqual(['CH3', 'H3C', 'O'].sort()); // anetol
    expect(labelTexts(depict('C=CCc1ccc(O)c(OC)c1', enem)).some((t) => t === 'CH2' || t === 'H2C')).toBe(true); // eugenol =CH2
    expect(labelTexts(depict('CCOc1ccc(NC(C)=O)cc1', enem)).filter((t) => t.includes('CH'))).toEqual([]); // fenacetina
  });

  it('sets a counter-ion right beside the opposite charge: "O⁻ Na⁺" (2023, Q134)', () => {
    const d = depict('CC(=O)[O-].[Na+]', enem);
    const o = site(d, 3);
    const na = site(d, 4);
    const L = d.style.bondLength;
    expect(Math.abs(na.y - o.y)).toBeLessThan(0.05 * L);
    expect(na.x - o.x).toBeGreaterThan(0.5 * L);
    expect(na.x - o.x).toBeLessThan(1.6 * L);
  });
});

describe('condensed groups', () => {
  it('writes COOH or HOOC depending on the side the bond comes from', () => {
    for (const smiles of ['CCC(=O)O', 'OC(=O)CC']) {
      const d = depict(smiles, { ...enem, abbreviations: ['COOH'] });
      const t = labelTexts(d);
      expect(t.some((x) => x === 'COOH' || x === 'HOOC'), smiles).toBe(true);
      expect(d.molecule.atoms).toHaveLength(3);
    }
  });

  it('keeps the attachment letter on the atom', () => {
    const d = depict('c1ccccc1[N+](=O)[O-]', { ...enem, abbreviations: ['NO2'] });
    const label = d.labels.find((l) => /N/.test(l.runs.map((r) => r.text).join('')))!;
    const atom = d.molecule.atoms[label.atom];
    const site = d.atoms[atom.index];
    const runN = label.runs.find((r) => r.text.includes('N'))!;
    const nIndex = runN.text.indexOf('N');
    const before = runN.text.slice(0, nIndex);
    const widths: Record<string, number> = { O: 0.778, N: 0.722 };
    const left = runN.x + [...before].reduce((s, c) => s + widths[c] * runN.size, 0);
    expect(left + (0.722 * runN.size) / 2).toBeCloseTo(site.x, 1);
  });

  it('maps highlights on folded atoms to the group label', () => {
    const d = depict('CCC(=O)O', { abbreviations: ['COOH'], highlights: [{ atoms: [3, 4], color: 'red' }] });
    expect(d.underlay.filter((p) => p.type === 'circle')).toHaveLength(1);
  });
});

describe('fórmula estrutural plana (penicilamina, 2022 Q93)', () => {
  const d = depict('CC(C)(S)C(N)C(=O)O', { ...enem, formula: 'plana' });

  it('condenses the ends and writes the backbone carbons out', () => {
    const t = labelTexts(d);
    expect(t.filter((x) => x === 'C')).toHaveLength(2);
    expect(t.filter((x) => x === 'CH3')).toHaveLength(2);
    expect(t).toEqual(expect.arrayContaining(['HS', 'COOH', 'NH2', 'H']));
  });

  it('runs HS–C–C–COOH on one straight line', () => {
    const ys = [3, 1, 4, 6].map((i) => site(d, i).y);
    for (const y of ys) expect(y).toBeCloseTo(ys[0], 3);
    expect(site(d, 3).x).toBeLessThan(site(d, 6).x);
  });
});

describe('annotations and captions', () => {
  const inside = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };

  it('outlines each group without swallowing the others (nimesulida, 2024 Q112)', () => {
    const groups = [[0], [1, 2, 3, 4], [11], [12, 13, 14, 15, 16, 17], [18, 19, 20]];
    const names = ['metila', 'sulfonamida', 'éter', 'fenila', 'nitro'];
    const d = depict('CS(=O)(=O)Nc1ccc(cc1Oc1ccccc1)[N+](=O)[O-]', {
      ...enem,
      annotations: groups.map((atoms, i) => ({ atoms, label: names[i] })),
    });
    expect(d.outlines).toHaveLength(5);
    expect(d.texts.map((t) => t.text)).toEqual(names);
    groups.forEach((atoms, gi) => {
      for (const a of atoms) expect(inside(site(d, a), d.outlines[gi].points), `${names[gi]} atom ${a}`).toBe(true);
      for (const other of groups.flat().filter((x) => !atoms.includes(x))) {
        expect(inside(site(d, other), d.outlines[gi].points), `${names[gi]} swallows ${other}`).toBe(false);
      }
    });
  });

  it('sets a bold caption and a source line under the structure', () => {
    const plain = depict('O=Cc1ccccc1', enem);
    const d = depict('O=Cc1ccccc1', { ...enem, caption: 'Benzaldeído', source: '(no óleo de amêndoas)' });
    expect(d.texts.map((t) => [t.text, t.weight])).toEqual([
      ['Benzaldeído', 700],
      ['(no óleo de amêndoas)', 400],
    ]);
    expect(d.viewBox.height).toBeGreaterThan(plain.viewBox.height);
    expect(renderSVG('O=Cc1ccccc1', { ...enem, caption: 'Benzaldeído' })).toMatch(/<text [^>]*font-weight="700"[^>]*>Benzaldeído<\/text>/);
  });
});
