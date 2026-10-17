import { describe, expect, it } from 'vitest';
import { sameMolecule } from '../chem/graph.ts';
import { MOLECULES } from '../content/molecules.ts';
import { depict } from '../nanquim/index.ts';
import { labReactions } from './lab.ts';

const ids = (smiles: string) => labReactions(smiles).map((r) => r.id);

describe('reaction lab', () => {
  it('offers the reactions each function undergoes', () => {
    expect(ids('C=CC')).toEqual(['h2', 'Br2', 'HBr', 'H2O', 'polymer', 'combustion']);
    expect(ids('CCO')).toEqual(['ox', 'dehydration', 'combustion']);
    expect(ids('CC(=O)O')).toEqual(['ester', 'salt', 'combustion']);
    expect(ids('CCOC(C)=O')).toEqual(['hyd-ácido', 'hyd-básico', 'combustion']);
    expect(ids('CC(C)C')).toEqual(['br-light', 'combustion']);
    expect(ids('Cc1ccccc1')).toEqual(['nitration', 'combustion']);
    expect(ids('CC(=O)[O-].[Na+]')).toEqual([]);
  });

  it('computes the products', () => {
    const product = (smiles: string, id: string) => labReactions(smiles).find((r) => r.id === id)!.product!.smiles;
    expect(sameMolecule(product('C=CC', 'HBr'), 'CC(C)Br')).toBe(true);
    expect(sameMolecule(product('Cc1ccccc1', 'nitration'), 'Cc1ccc(cc1)[N+](=O)[O-]')).toBe(true);
    expect(sameMolecule(product('OC(=O)c1ccccc1', 'nitration'), 'OC(=O)c1cccc(c1)[N+](=O)[O-]')).toBe(true);
    const ox = labReactions('CC(C)(C)O').find((r) => r.id === 'ox')!;
    expect(ox.product).toBeUndefined();
  });

  it('never breaks on the gallery', () => {
    for (const entry of MOLECULES) {
      for (const r of labReactions(entry.smiles)) {
        for (const term of [...r.scheme.left, ...r.scheme.right]) {
          if ('mol' in term) {
            expect(() => depict(term.mol.smiles, { formula: term.mol.formula, polymer: term.mol.polymer, conventions: 'enem' }), `${entry.id} ${r.id}`).not.toThrow();
          }
        }
      }
    }
  });
});
