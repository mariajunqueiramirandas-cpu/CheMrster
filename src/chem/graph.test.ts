import { describe, expect, it } from 'vitest';
import { MOLECULES } from '../content/molecules.ts';
import { CHIRAL, FUNCTION_EXAMPLES, GEOMETRIC, HYDROCARBONS } from '../course/pools.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';
import { Draft, canonicalKey, sameMolecule, symmetryClasses, writeSmiles } from './graph.ts';

const ALL = [
  ...MOLECULES.map((m) => m.smiles),
  ...[...HYDROCARBONS, ...FUNCTION_EXAMPLES, ...GEOMETRIC, ...CHIRAL].map((m) => m.smiles),
  'C[N+](=O)[O-]',
  'c1ccc2[nH]ccc2c1',
  '[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O',
  '*CC(*)Cl',
  '[13CH4]',
  'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O',
];

/** Parity check: does B (written from A) keep every @/@@ and cis/trans of A? */
function stereoKept(smiles: string, reversed = false) {
  const a = moleculeFromSmiles(smiles);
  const ranks = reversed ? a.atoms.map((x) => a.atoms.length - x.index) : undefined;
  const { smiles: out, order } = writeSmiles(a, { ranks });
  const b = moleculeFromSmiles(out);
  const back = (i: number) => (i < 0 ? -1 : order[i]);
  for (const atom of a.atoms) {
    if (!atom.chirality) continue;
    const j = order.indexOf(atom.index);
    const other = b.atoms[j];
    expect(other.chirality, `${smiles} atom ${atom.index}`).toBeDefined();
    const mapped = other.stereoOrder!.map(back);
    const pos = mapped.map((x) => atom.stereoOrder!.indexOf(x));
    let even = true;
    const seen = pos.map(() => false);
    for (let i = 0; i < pos.length; i++) {
      if (seen[i]) continue;
      let len = 0;
      for (let k = i; !seen[k]; k = pos[k]) {
        seen[k] = true;
        len++;
      }
      if (len % 2 === 0) even = !even;
    }
    expect(even ? other.chirality : other.chirality === '@' ? '@@' : '@', `${smiles} -> ${out}`).toBe(atom.chirality);
  }
  for (const st of a.doubleBondStereo) {
    const match = b.doubleBondStereo.find((s) => {
      const ends = [back(s.a), back(s.b)];
      return ends.includes(st.a) && ends.includes(st.b);
    });
    expect(match, `${smiles} -> ${out}`).toBeDefined();
    const sameEnd = back(match!.a) === st.a;
    const x = back(sameEnd ? match!.x : match!.y);
    const y = back(sameEnd ? match!.y : match!.x);
    let cis = match!.cis;
    if (x !== st.x) cis = !cis;
    if (y !== st.y) cis = !cis;
    expect(cis, `${smiles} -> ${out}`).toBe(st.cis);
  }
}

describe('SMILES writer', () => {
  for (const smiles of ALL) {
    it(`round-trips ${smiles}`, () => {
      const a = moleculeFromSmiles(smiles);
      const out = writeSmiles(a).smiles;
      const b = moleculeFromSmiles(out);
      expect(b.formula(), out).toBe(a.formula());
      expect(canonicalKey(b), out).toBe(canonicalKey(a));
      stereoKept(smiles);
      // Written backwards every neighbour list is permuted, so @/@@ must be recomputed.
      stereoKept(smiles, true);
    });
  }
});

describe('canonical key', () => {
  it('ignores how the SMILES was written', () => {
    expect(sameMolecule('CCO', 'OCC')).toBe(true);
    expect(sameMolecule('CC(=O)O', 'OC(C)=O')).toBe(true);
    expect(sameMolecule('c1ccccc1', 'C1=CC=CC=C1')).toBe(true);
    expect(sameMolecule('Cc1ccccc1O', 'Oc1ccccc1C')).toBe(true);
    expect(sameMolecule('CC(=O)[O-].[Na+]', '[Na+].[O-]C(C)=O')).toBe(true);
    expect(sameMolecule('CC(C)Br', 'BrC(C)C')).toBe(true);
  });

  it('tells isomers apart', () => {
    expect(sameMolecule('CCCBr', 'CC(C)Br')).toBe(false);
    expect(sameMolecule('CCOC=O', 'COC(C)=O')).toBe(false);
    expect(sameMolecule('Cc1ccccc1O', 'Cc1cccc(O)c1')).toBe(false);
    expect(sameMolecule('Cc1cccc(O)c1', 'Cc1ccc(O)cc1')).toBe(false);
    expect(sameMolecule('CCCC', 'CC(C)C')).toBe(false);
  });
});

describe('symmetry classes', () => {
  const chClasses = (smiles: string) => {
    const mol = moleculeFromSmiles(smiles);
    const cls = symmetryClasses(mol);
    return new Set(mol.atoms.filter((a) => a.element === 'C' && a.hydrogens > 0).map((a) => cls[a.index])).size;
  };
  it('counts equivalent hydrogens like the textbooks', () => {
    expect(chClasses('CCC')).toBe(2);
    expect(chClasses('CCCC')).toBe(2);
    expect(chClasses('CC(C)C')).toBe(2);
    expect(chClasses('CCCCC')).toBe(3);
    expect(chClasses('CC(C)CC')).toBe(4);
    expect(chClasses('CC(C)(C)C')).toBe(1);
    expect(chClasses('CC(C)C(C)C')).toBe(2);
    expect(chClasses('C1CCCCC1')).toBe(1);
    expect(chClasses('CC1CCCCC1')).toBe(5);
    expect(chClasses('Cc1ccccc1')).toBe(4);
  });
});

describe('Draft', () => {
  it('recomputes hydrogens after edits', () => {
    const d = new Draft('C=CC');
    d.setOrder(0, 1, 1);
    expect(canonicalKey(d.molecule())).toBe(canonicalKey('CCC'));
  });

  it('attaches groups and ions', () => {
    const nitro = new Draft('c1ccccc1');
    nitro.attach(0, '[N+](=O)[O-]');
    expect(sameMolecule(nitro.smiles(), '[O-][N+](=O)c1ccccc1')).toBe(true);
    const salt = new Draft('CC(=O)O');
    salt.charge(3, -1);
    salt.addAtom('Na', { charge: 1 });
    expect(sameMolecule(salt.smiles(), 'CC(=O)[O-].[Na+]')).toBe(true);
  });

  it('removes atoms and keeps stereo elsewhere', () => {
    const d = new Draft('C[C@H](N)C(=O)O');
    d.remove(5);
    d.attach(3, 'N');
    const out = d.smiles();
    expect(sameMolecule(out, 'CC(N)C(N)=O')).toBe(true);
    expect(moleculeFromSmiles(out).atoms.some((a) => a.chirality)).toBe(true);
  });
});
