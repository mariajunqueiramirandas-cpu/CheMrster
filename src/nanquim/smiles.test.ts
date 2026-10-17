import { describe, expect, it } from 'vitest';
import { moleculeFromSmiles } from './depict.ts';
import { findRings } from './rings.ts';
import { SmilesError, parseSmiles } from './smiles.ts';

const hydrogens = (smiles: string) => moleculeFromSmiles(smiles).atoms.map((a) => a.hydrogens);
const ringSizes = (smiles: string) =>
  findRings(parseSmiles(smiles))
    .map((r) => r.length)
    .sort((a, b) => a - b);

describe('parseSmiles', () => {
  it('reads the organic subset with implicit hydrogens', () => {
    const mol = moleculeFromSmiles('CCO');
    expect(mol.atoms.map((a) => a.element)).toEqual(['C', 'C', 'O']);
    expect(mol.bonds).toHaveLength(2);
    expect(hydrogens('CCO')).toEqual([3, 2, 1]);
    expect(hydrogens('C=CC#N')).toEqual([2, 1, 0, 0]);
    expect(hydrogens('ClC(Cl)Cl')).toEqual([0, 1, 0, 0]);
  });

  it('honours bracket atoms: isotopes, charges, explicit H and classes', () => {
    const mol = moleculeFromSmiles('[13CH3][NH3+].[O-]C(=O)C.[Na+].[*:1]C');
    expect(mol.atoms[0]).toMatchObject({ element: 'C', isotope: 13, hydrogens: 3 });
    expect(mol.atoms[1]).toMatchObject({ element: 'N', charge: 1, hydrogens: 3 });
    expect(mol.atoms[2]).toMatchObject({ element: 'O', charge: -1, hydrogens: 0 });
    expect(mol.atoms.find((a) => a.element === 'Na')?.charge).toBe(1);
    expect(mol.atoms.find((a) => a.element === '*')?.label).toBe('R1');
    expect(moleculeFromSmiles('[Fe+++]').atoms[0].charge).toBe(3);
    expect(moleculeFromSmiles('[O-2]').atoms[0].charge).toBe(-2);
  });

  it('handles branches, ring closures and %nn labels', () => {
    expect(parseSmiles('CC(C)(C)C').bonds).toHaveLength(4);
    expect(ringSizes('C1CCCCC1')).toEqual([6]);
    expect(ringSizes('C%10CCCC%10')).toEqual([5]);
    expect(ringSizes('C1CC2CCC1C2')).toEqual([5, 5]);
  });

  it('reports malformed input with a position', () => {
    for (const bad of ['C1CC', 'C(C', 'C)C', 'CX', 'C==C', '[C', '=C', 'C.']) {
      expect(() => parseSmiles(bad), bad).toThrow(SmilesError);
    }
  });

  it('keeps an optional title after whitespace', () => {
    expect(parseSmiles('CCO etanol').title).toBe('etanol');
  });
});

describe('perception', () => {
  it('kekulises aromatic rings', () => {
    const benzene = moleculeFromSmiles('c1ccccc1');
    expect(benzene.bonds.filter((b) => b.order === 2)).toHaveLength(3);
    expect(benzene.atoms.every((a) => a.hydrogens === 1)).toBe(true);
    // every atom gets exactly one double bond
    for (const a of benzene.atoms) {
      expect(benzene.adjacency[a.index].filter((bi) => benzene.bonds[bi].order === 2)).toHaveLength(1);
    }
  });

  it('treats pyrrole-type and pyridine-type nitrogens correctly', () => {
    expect(hydrogens('c1cc[nH]c1')).toEqual([1, 1, 1, 1, 1]);
    expect(moleculeFromSmiles('c1cc[nH]c1').bonds.filter((b) => b.order === 2)).toHaveLength(2);
    expect(hydrogens('c1ccncc1')).toEqual([1, 1, 1, 0, 1, 1]);
    expect(moleculeFromSmiles('c1ccoc1').bonds.filter((b) => b.order === 2)).toHaveLength(2);
    expect(moleculeFromSmiles('O=c1cc[nH]cc1').bonds.filter((b) => b.order === 2)).toHaveLength(3);
  });

  it('kekulises fused and heteroaromatic systems', () => {
    for (const smiles of [
      'c1ccc2ccccc2c1',
      'c1ccc2c(c1)cc1ccc3cccc4ccc2c1c34',
      'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
      'NCCc1c[nH]c2ccc(O)cc12',
      'c1ccc2[nH]ccc2c1',
    ]) {
      expect(() => moleculeFromSmiles(smiles), smiles).not.toThrow();
    }
  });

  it('builds correct molecular formulas', () => {
    const cases: Record<string, string> = {
      CCO: 'C2H6O',
      'Cn1cnc2c1c(=O)n(C)c(=O)n2C': 'C8H10N4O2',
      'CC(=O)Oc1ccccc1C(=O)O': 'C9H8O4',
      'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O': 'C6H12O6',
      'C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O': 'C19H28O2',
      'CC(=O)[O-].[Na+]': 'C2H3NaO2',
      '[NH4+]': 'H4N+',
    };
    for (const [smiles, formula] of Object.entries(cases)) {
      expect(moleculeFromSmiles(smiles).formula(), smiles).toBe(formula);
    }
  });

  it('turns / and \\ into cis/trans requirements', () => {
    const cis = (s: string) => moleculeFromSmiles(s).doubleBondStereo.map((d) => d.cis);
    expect(cis('F/C=C/F')).toEqual([false]);
    expect(cis('F/C=C\\F')).toEqual([true]);
    expect(cis('C(/F)=C/F')).toEqual([true]);
    expect(cis('F\\C=C/F')).toEqual([true]);
    expect(cis('CC=CC')).toEqual([]);
  });

  it('records neighbour order for tetrahedral centres', () => {
    const mol = parseSmiles('N[C@@H](C)C(=O)O');
    expect(mol.atoms[1].chirality).toBe('@@');
    expect(mol.atoms[1].stereoOrder).toEqual([0, -1, 2, 3]);
    const ring = parseSmiles('[C@H]1(F)CCC1');
    expect(ring.atoms[0].stereoOrder).toEqual([-1, 4, 1, 2]);
  });
});

describe('ring perception', () => {
  it('finds the smallest set of smallest rings', () => {
    expect(ringSizes('c1ccc2ccccc2c1')).toEqual([6, 6]);
    expect(ringSizes('C12C3C4C1C5C2C3C45')).toEqual([4, 4, 4, 4, 4]);
    expect(ringSizes('C1C2CC3CC1CC(C2)C3')).toEqual([6, 6, 6]);
    expect(ringSizes('C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O')).toEqual([5, 6, 6, 6]);
    expect(ringSizes('CCCC')).toEqual([]);
  });
});
