import { describe, expect, it } from 'vitest';
import { MOLECULES } from '../content/molecules.ts';
import { depict } from './depict.ts';
import { renderSVG } from './index.ts';
import { chooseHydrogenSide, insideLabel } from './labels.ts';

const labelText = (smiles: string, atom: number, opts = {}) =>
  depict(smiles, opts)
    .labels.find((l) => l.atom === atom)
    ?.runs.slice()
    .sort((a, b) => a.x - b.x)
    .map((r) => r.text)
    .join('');

describe('labels', () => {
  it('shows heteroatoms and hides skeletal carbons', () => {
    const d = depict('CCO');
    expect(d.labels.map((l) => l.atom)).toEqual([2]);
  });

  it('writes hydrogens on the free side of the atom', () => {
    expect(labelText('CCO', 2)).toBe('OH');
    const deg = Math.PI / 180;
    // Bond leaving to the right -> HO; to the left -> OH; ring N at the top -> H above.
    expect(chooseHydrogenSide([30 * deg], 'O')).toBe('left');
    expect(chooseHydrogenSide([210 * deg], 'O')).toBe('right');
    expect(chooseHydrogenSide([210 * deg, 330 * deg], 'N')).toBe('up');
    expect(chooseHydrogenSide([30 * deg, 150 * deg], 'N')).toBe('down');
    // Condensed formulas keep hydrogens inline: CH2 between two horizontal bonds.
    expect(chooseHydrogenSide([0, Math.PI], 'C', true)).toBe('right');
    expect(labelText('CN', 1)).toBe('NH2');
    expect(labelText('O', 0)).toBe('H2O');
    expect(labelText('C', 0)).toBe('CH4');
  });

  it('adds charges and isotopes as superscripts', () => {
    expect(labelText('C[NH3+]', 1)).toBe('NH3+');
    expect(labelText('CC(=O)[O-]', 3)).toMatch(/O−/);
    expect(labelText('[13CH4]', 0)).toBe('13CH4');
  });

  it('labels every carbon in condensed formulas', () => {
    const d = depict('CCCC', { formula: 'condensed' });
    expect(d.labels).toHaveLength(4);
    expect(labelText('CCCC', 1, { formula: 'condensed' })).toBe('CH2');
  });

  it('draws every hydrogen in structural formulas', () => {
    const d = depict('CC', { formula: 'structural' });
    expect(d.molecule.atoms.filter((a) => a.element === 'H')).toHaveLength(6);
    expect(d.labels).toHaveLength(8);
  });
});

describe('bonds', () => {
  it('draws benzene with three inner strokes', () => {
    const d = depict('c1ccccc1');
    const lines = d.primitives.filter((p) => p.type === 'line');
    expect(lines).toHaveLength(9);
  });

  it('can draw aromatic rings as circles', () => {
    const d = depict('c1ccccc1', { aromaticCircles: true });
    expect(d.primitives.filter((p) => p.type === 'circle')).toHaveLength(1);
    expect(d.primitives.filter((p) => p.type === 'line')).toHaveLength(6);
  });

  it('never lets a stroke run into a label', () => {
    for (const m of MOLECULES) {
      for (const formula of ['skeletal', 'condensed'] as const) {
        const d = depict(m.smiles, { formula });
        const margin = d.style.labelMargin * d.style.bondLength * 0.5;
        for (const p of d.primitives) {
          if (p.type !== 'line' || p.bond === undefined) continue;
          const bond = d.molecule.bonds[p.bond];
          for (const label of d.labels) {
            if (label.atom !== bond.a && label.atom !== bond.b) continue;
            for (const end of [p.a, p.b]) {
              expect(insideLabel(end, label, margin), `${m.name} (${formula}) bond ${p.bond}`).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe('renderSVG', () => {
  it('produces clean SVG for the whole gallery in every formula style', () => {
    for (const m of MOLECULES) {
      for (const formula of ['skeletal', 'condensed', 'structural'] as const) {
        const svg = renderSVG(m.smiles, { formula, title: m.name });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg, `${m.name} ${formula}`).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it('escapes the accessible title', () => {
    expect(renderSVG('C', { title: 'a<b & "c"' })).toContain('aria-label="a&lt;b &amp; &quot;c&quot;"');
  });
});
