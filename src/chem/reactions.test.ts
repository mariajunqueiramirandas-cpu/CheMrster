import { describe, expect, it } from 'vitest';
import { sameMolecule } from './graph.ts';
import {
  addition,
  additionPolymer,
  alcohols,
  aminoAcidSites,
  aromaticSubstitution,
  combustion,
  condense,
  condensationPolymer,
  director,
  esterify,
  glycosidicOxygens,
  h2ToSaturate,
  hydrolyzeEsters,
  ipsoSubstitution,
  mainBromination,
  markovnikovCarbon,
  monohalogenation,
  monomerOf,
  oxidizeAlcohol,
  peptide,
  peptideBonds,
  sugarKind,
  transesterify,
  triglyceride,
} from './reactions.ts';

const same = (actual: string | null | undefined, expected: string) => {
  expect(actual, `${actual} ≠ ${expected}`).toBeTruthy();
  expect(sameMolecule(actual!, expected), `${actual} ≠ ${expected}`).toBe(true);
};

describe('addition', () => {
  it('hydrogenates and halogenates', () => {
    same(addition('C=C', 'H2'), 'CC');
    same(addition('C=CC', 'Br2'), 'BrCC(C)Br');
    same(addition('C1=CCCCC1', 'Cl2'), 'ClC1CCCCC1Cl');
    same(addition('CCCCCCCC/C=C\\CCCCCCCC(=O)O', 'H2'), 'CCCCCCCCCCCCCCCCCC(=O)O');
  });

  it('follows Markovnikov', () => {
    expect(markovnikovCarbon('C=CC')).toBe(0);
    same(addition('C=CC', 'HBr'), 'CC(C)Br');
    same(addition('C=CC', 'HBr', { antiMarkovnikov: true }), 'BrCCC');
    same(addition('C=C(C)C', 'H2O'), 'CC(C)(C)O');
    same(addition('CC(C)=CC', 'HCl'), 'CCC(C)(C)Cl');
    same(addition('CC=CC', 'HBr'), 'CCC(C)Br');
    expect(addition('CC=CCC', 'HBr')).toBeUndefined(); // two different products
  });

  it('counts H₂ to saturate', () => {
    expect(h2ToSaturate('C=CC=C')).toBe(2);
    expect(h2ToSaturate('C#CC')).toBe(2);
    expect(h2ToSaturate('c1ccccc1C=C')).toBe(1);
    expect(h2ToSaturate('CCCCC/C=C\\C/C=C\\CCCCCCCC(=O)O')).toBe(2);
  });
});

describe('substitution', () => {
  it('lists monohalogenation products', () => {
    expect(monohalogenation('CCC', 'Cl')).toHaveLength(2);
    expect(monohalogenation('CC(C)CC', 'Cl')).toHaveLength(4);
    expect(monohalogenation('CC(C)(C)C', 'Cl')).toHaveLength(1);
    same(mainBromination('CC(C)C')?.smiles, 'CC(C)(C)Br');
    same(mainBromination('CCC')?.smiles, 'CC(C)Br');
    expect(mainBromination('CCCCC')).toBeUndefined(); // C2 and C3 are both secondary
  });

  it('knows ring directors', () => {
    for (const s of ['Oc1ccccc1', 'Nc1ccccc1', 'Cc1ccccc1', 'Clc1ccccc1', 'COc1ccccc1', 'CC(=O)Nc1ccccc1']) {
      expect(director(s), s).toBe('orto-para');
    }
    for (const s of ['[O-][N+](=O)c1ccccc1', 'OC(=O)c1ccccc1', 'O=Cc1ccccc1', 'N#Cc1ccccc1', 'OS(=O)(=O)c1ccccc1', 'CC(=O)c1ccccc1']) {
      expect(director(s), s).toBe('meta');
    }
    expect(director('C=Cc1ccccc1')).toBe('orto-para');
  });

  it('substitutes on the ring', () => {
    same(aromaticSubstitution('c1ccccc1', 'NO2'), '[O-][N+](=O)c1ccccc1');
    same(aromaticSubstitution('Cc1ccccc1', 'NO2', 'para'), 'Cc1ccc(cc1)[N+](=O)[O-]');
    same(aromaticSubstitution('Cc1ccccc1', 'Cl', 'orto'), 'Cc1ccccc1Cl');
    same(aromaticSubstitution('[O-][N+](=O)c1ccccc1', 'Br', 'meta'), '[O-][N+](=O)c1cccc(Br)c1');
    same(ipsoSubstitution('Cc1ccccc1', 'NO2'), '[O-][N+](=O)c1ccccc1');
  });
});

describe('oxidation and combustion', () => {
  it('classifies alcohols', () => {
    expect(alcohols('CCO')[0].kind).toBe('primário');
    expect(alcohols('CO')[0].kind).toBe('primário');
    expect(alcohols('CC(C)O')[0].kind).toBe('secundário');
    expect(alcohols('CC(C)(C)O')[0].kind).toBe('terciário');
  });

  it('oxidizes alcohols', () => {
    same(oxidizeAlcohol('CCO', 'branda'), 'CC=O');
    same(oxidizeAlcohol('CCO', 'energica'), 'CC(=O)O');
    same(oxidizeAlcohol('CC(O)C', 'energica'), 'CC(C)=O');
    same(oxidizeAlcohol('CCC(C)O', 'branda'), 'CCC(C)=O');
    expect(oxidizeAlcohol('CC(C)(C)O', 'energica')).toBeNull();
  });

  it('balances complete combustion', () => {
    expect(combustion('C')).toEqual({ o2: 2, co2: 1, h2o: 2 });
    expect(combustion('CCO')).toEqual({ o2: 3, co2: 2, h2o: 3 });
    expect(combustion('CC')).toEqual({ o2: 3.5, co2: 2, h2o: 3 });
    expect(combustion('CC(C)CC(C)(C)C').o2).toBe(12.5);
    expect(combustion('OCC(O)C(O)C(O)C(O)C=O')).toEqual({ o2: 6, co2: 6, h2o: 6 });
  });
});

describe('esters', () => {
  it('esterifies with the alcohol oxygen as the bridge', () => {
    same(esterify('CC(=O)O', 'CCO'), 'CCOC(C)=O');
    same(esterify('OC=O', 'CCO'), 'CCOC=O');
    same(esterify('CC(=O)O', 'CC(C)CCO'), 'CC(C)CCOC(C)=O');
    same(esterify('OC(=O)c1ccccc1O', 'CO'), 'COC(=O)c1ccccc1O'); // salicilato de metila
  });

  it('hydrolyzes and saponifies', () => {
    const acid = hydrolyzeEsters('CCOC(C)=O', 'ácido');
    same(acid.acids[0].smiles, 'CC(=O)O');
    same(acid.alcohols[0].smiles, 'CCO');
    const tri = 'CCCCCCCCCCCCCCCCCC(=O)OCC(OC(=O)CCCCCCCCCCCCCCCCC)COC(=O)CCCCCCCCCCCCCCCCC';
    const soap = hydrolyzeEsters(tri, 'básico');
    expect(soap.acids).toHaveLength(1);
    expect(soap.acids[0].count).toBe(3);
    same(soap.acids[0].smiles, 'CCCCCCCCCCCCCCCCCC(=O)[O-].[Na+]');
    same(soap.alcohols[0].smiles, 'OCC(O)CO');
  });

  it('builds triglycerides', () => {
    const esteric = 'CCCCCCCCCCCCCCCCCC(=O)O';
    same(triglyceride([esteric, esteric, esteric]), 'CCCCCCCCCCCCCCCCCC(=O)OCC(OC(=O)CCCCCCCCCCCCCCCCC)COC(=O)CCCCCCCCCCCCCCCCC');
  });

  it('makes biodiesel', () => {
    const tri = 'CCCCCCCCCCCCCCCC(=O)OCC(OC(=O)CCCCCCCCCCCCCCC)COC(=O)CCCCCCCCCCCCCCC';
    const out = transesterify(tri, 'CO');
    expect(out.esters[0].count).toBe(3);
    same(out.esters[0].smiles, 'CCCCCCCCCCCCCCCC(=O)OC');
    same(out.alcohols[0].smiles, 'OCC(O)CO');
  });
});

describe('polymers', () => {
  it('builds addition polymers and recovers their monomers', () => {
    const cases: Array<[string, string]> = [
      ['C=C', '*CC*'],
      ['C=CC', '*CC(*)C'],
      ['C=CCl', '*CC(*)Cl'],
      ['C=Cc1ccccc1', '*CC(*)c1ccccc1'],
      ['FC(F)=C(F)F', '*C(F)(F)C(*)(F)F'],
      ['C=CC#N', '*CC(*)C#N'],
      ['C=COC(C)=O', '*CC(*)OC(C)=O'],
      ['C=C(C)C(=O)OC', '*CC(*)(C)C(=O)OC'],
    ];
    for (const [monomer, repeat] of cases) {
      const made = additionPolymer(monomer);
      same(made, repeat);
      expect(made.startsWith('*'), made).toBe(true);
      same(monomerOf(repeat), monomer);
    }
    same(monomerOf('*CC=C(C)C*'), 'C=CC(C)=C'); // borracha natural: isopreno
  });

  it('builds condensation polymers', () => {
    same(condensationPolymer('OC(=O)c1ccc(cc1)C(=O)O', 'OCCO'), '*OCCOC(=O)c1ccc(cc1)C(*)=O');
    same(condensationPolymer('OC(=O)CCCCC(=O)O', 'NCCCCCCN'), '*NCCCCCCNC(=O)CCCCC(*)=O');
    same(condensationPolymer('Nc1ccc(N)cc1', 'OC(=O)c1ccc(cc1)C(=O)O'), '*Nc1ccc(cc1)NC(=O)c1ccc(cc1)C(*)=O');
    same(condensationPolymer('CC(O)C(=O)O'), '*OC(C)C(*)=O');
  });
});

describe('biomolecules', () => {
  it('links amino acids N to C', () => {
    expect(aminoAcidSites('NCC(=O)O')).toBeDefined();
    same(peptide(['NCC(=O)O', 'CC(N)C(=O)O']), 'NCC(=O)NC(C)C(=O)O');
    same(peptide(['CC(N)C(=O)O', 'NCC(=O)O']), 'CC(N)C(=O)NCC(=O)O');
    expect(peptideBonds(peptide(['NCC(=O)O', 'CC(N)C(=O)O', 'OCC(N)C(=O)O']))).toHaveLength(2);
    // Aspartame: one peptide bond; asparagine's side-chain amide is not one.
    expect(peptideBonds('COC(=O)C(Cc1ccccc1)NC(=O)C(N)CC(=O)O')).toHaveLength(1);
    expect(peptideBonds('NC(=O)CC(N)C(=O)O')).toHaveLength(0);
  });

  it('finds glycosidic bonds and sugar kinds', () => {
    const sacarose = 'OC[C@H]1O[C@@](CO)(O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@@H](O)[C@@H]1O';
    expect(glycosidicOxygens(sacarose)).toHaveLength(1);
    expect(glycosidicOxygens('OCC1OC(O)C(O)C(O)C1O')).toHaveLength(0);
    // Maltose: C1 of one glucose (its anomeric OH, atom 5, leaves) onto O4 (atom 11) of another.
    const glucose = 'OCC1OC(O)C(O)C(O)C1O';
    const maltose = condense(glucose, 5, 4, glucose, 11);
    same(maltose, 'OCC1OC(OC2C(CO)OC(O)C(O)C2O)C(O)C(O)C1O');
    expect(glycosidicOxygens(maltose)).toHaveLength(1);
    expect(sugarKind('OCC(O)C(O)C(O)C(O)C=O')).toBe('aldose');
    expect(sugarKind('OCC(O)C(O)C(O)C(=O)CO')).toBe('cetose');
  });
});
