import { describe, expect, it } from 'vitest';
import { moleculeFromSmiles } from '../nanquim/depict.ts';
import {
  carbonsByClass,
  chiralCarbons,
  classifyChain,
  functionSet,
  geometricDoubleBonds,
  hydrocarbonClass,
} from './analysis.ts';

const mol = moleculeFromSmiles;

describe('carbon classes', () => {
  it('counts carbon neighbours', () => {
    const c = carbonsByClass(mol('CC(C)(C)CC(C)C')); // 2,2,4-trimethylpentane
    expect(c.primário).toHaveLength(5);
    expect(c.secundário).toHaveLength(1);
    expect(c.terciário).toHaveLength(1);
    expect(c.quaternário).toHaveLength(1);
    expect(carbonsByClass(mol('C')).primário).toHaveLength(0);
  });
});

describe('chain classification', () => {
  it('reads open, branched, unsaturated and heterogeneous chains', () => {
    expect(classifyChain(mol('CCCC'))).toMatchObject({ fechada: false, ramificada: false, insaturada: false, heterogenea: false });
    expect(classifyChain(mol('CC(C)C')).ramificada).toBe(true);
    expect(classifyChain(mol('C=CC')).insaturada).toBe(true);
    expect(classifyChain(mol('CCOCC')).heterogenea).toBe(true);
    expect(classifyChain(mol('CCO')).heterogenea).toBe(false);
    expect(classifyChain(mol('C1CCCCC1'))).toMatchObject({ fechada: true, ramificada: false, aromatica: false });
    expect(classifyChain(mol('CCc1ccccc1'))).toMatchObject({ fechada: true, ramificada: true, aromatica: true });
  });

  it('names hydrocarbon classes', () => {
    expect(hydrocarbonClass(mol('CCC'))).toBe('alcano');
    expect(hydrocarbonClass(mol('C=CC'))).toBe('alceno');
    expect(hydrocarbonClass(mol('C#CC'))).toBe('alcino');
    expect(hydrocarbonClass(mol('C=CC=C'))).toBe('alcadieno');
    expect(hydrocarbonClass(mol('C1CCCC1'))).toBe('cicloalcano');
    expect(hydrocarbonClass(mol('C1=CCCC1'))).toBe('cicloalceno');
    expect(hydrocarbonClass(mol('Cc1ccccc1'))).toBe('aromático');
    expect(hydrocarbonClass(mol('CCO'))).toBeUndefined();
  });
});

describe('functional groups', () => {
  const cases: Record<string, string[]> = {
    CCO: ['álcool'],
    Oc1ccccc1: ['fenol'],
    'CC=O': ['aldeído'],
    'CC(C)=O': ['cetona'],
    'CC(=O)O': ['ácido carboxílico'],
    'CC(=O)[O-].[Na+]': ['sal orgânico'],
    'CCOC(C)=O': ['éster'],
    CCOCC: ['éter'],
    CN: ['amina'],
    'CC(N)=O': ['amida'],
    'CC#N': ['nitrila'],
    '[O-][N+](=O)c1ccccc1': ['nitrocomposto'],
    ClC: ['haleto orgânico'],
    'CC(=O)Oc1ccccc1C(=O)O': ['éster', 'ácido carboxílico'],
    'CC(=O)Nc1ccc(O)cc1': ['amida', 'fenol'],
    'COc1cc(C=O)ccc1O': ['aldeído', 'fenol', 'éter'],
    'CN1CCC[C@H]1c1cccnc1': ['amina'],
  };
  for (const [smiles, expected] of Object.entries(cases)) {
    it(`finds ${expected.join(' + ')} in ${smiles}`, () => {
      expect(functionSet(mol(smiles)).sort()).toEqual([...expected].sort());
    });
  }
});

describe('stereochemistry', () => {
  it('finds chiral carbons', () => {
    expect(chiralCarbons(mol('CC(O)C(=O)O'))).toEqual([1]); // ácido lático
    expect(chiralCarbons(mol('CC(O)C'))).toEqual([]);
    expect(chiralCarbons(mol('CC(C)[C@@H]1CC[C@@H](C)C[C@H]1O'))).toHaveLength(3); // mentol
    expect(chiralCarbons(mol('OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O'))).toHaveLength(5); // glicose
    expect(chiralCarbons(mol('C1CCCCC1'))).toEqual([]);
  });

  it('detects double bonds with cis/trans isomers', () => {
    expect(geometricDoubleBonds(mol('CC=CC'))).toHaveLength(1);
    expect(geometricDoubleBonds(mol('C=CC'))).toHaveLength(0);
    expect(geometricDoubleBonds(mol('CC(C)=CC'))).toHaveLength(0);
    expect(geometricDoubleBonds(mol('ClC=CCl'))).toHaveLength(1);
    expect(geometricDoubleBonds(mol('C1=CCCCC1'))).toHaveLength(0);
  });
});
