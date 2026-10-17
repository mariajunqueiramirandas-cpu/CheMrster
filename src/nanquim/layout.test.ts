import { describe, expect, it } from 'vitest';
import { MOLECULES } from '../content/molecules.ts';
import { depict, moleculeFromSmiles } from './depict.ts';
import { type Vec, cross, dist, norm, sub } from './geometry.ts';
import { computeLayout } from './layout.ts';
import type { Molecule } from './molecule.ts';

// Bridged bicyclics cannot be drawn flat without distortion.
const BRIDGED = new Set(['cocaina', 'canfora']);

function minNonBondedDistance(mol: Molecule, coords: Vec[]): number {
  let min = Infinity;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      if (mol.bondBetween(i, j)) continue;
      min = Math.min(min, dist(coords[i], coords[j]));
    }
  }
  return min;
}

describe('computeLayout', () => {
  for (const entry of MOLECULES.filter((m) => !BRIDGED.has(m.id))) {
    it(`draws ${entry.name} with uniform bonds and no collisions`, () => {
      const mol = moleculeFromSmiles(entry.smiles);
      const coords = computeLayout(mol);
      for (const b of mol.bonds) {
        expect(dist(coords[b.a], coords[b.b]), `bond ${b.a}-${b.b}`).toBeCloseTo(1, 2);
      }
      if (mol.atoms.length > 1) expect(minNonBondedDistance(mol, coords)).toBeGreaterThan(0.55);
    });
  }

  it('places bridged systems without stacking atoms', () => {
    for (const id of BRIDGED) {
      const mol = moleculeFromSmiles(MOLECULES.find((m) => m.id === id)!.smiles);
      const coords = computeLayout(mol);
      expect(minNonBondedDistance(mol, coords)).toBeGreaterThan(0.2);
      for (const b of mol.bonds) expect(dist(coords[b.a], coords[b.b])).toBeGreaterThan(0.5);
    }
  });

  it('keeps triple bonds and cumulenes straight', () => {
    for (const smiles of ['CC#CC', 'CC#N', 'C=C=C', 'O=C=O']) {
      const mol = moleculeFromSmiles(smiles);
      const c = computeLayout(mol);
      for (const atom of mol.atoms) {
        const nb = mol.neighbors(atom.index);
        if (nb.length !== 2) continue;
        const bend = cross(norm(sub(c[nb[0]], c[atom.index])), norm(sub(c[nb[1]], c[atom.index])));
        expect(Math.abs(bend), smiles).toBeLessThan(1e-6);
      }
    }
  });

  it('lays simple chains out horizontally', () => {
    const c = computeLayout(moleculeFromSmiles('CCCCCC'));
    const ys = c.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.5, 5);
  });

  it('honours every cis/trans requirement', () => {
    const smilesList = [
      'C/C=C/C',
      'C/C=C\\C',
      'F/C=C/F',
      'CCCCCCCC/C=C\\CCCCCCCC(=O)O',
      'CCCCCCCC/C=C/CCCCCCCC(=O)O',
      ...MOLECULES.map((m) => m.smiles),
    ];
    for (const smiles of smilesList) {
      const mol = moleculeFromSmiles(smiles);
      const c = computeLayout(mol);
      for (const st of mol.doubleBondStereo) {
        const axis = sub(c[st.b], c[st.a]);
        const sx = Math.sign(cross(axis, sub(c[st.x], c[st.a])));
        const sy = Math.sign(cross(axis, sub(c[st.y], c[st.a])));
        expect(sx === sy, `${smiles}: bond ${st.a}=${st.b}`).toBe(st.cis);
      }
    }
  });
});

/**
 * Reads R/S straight off the finished drawing (wedge = towards the viewer), using
 * hand-supplied CIP priorities, so it checks the wedge logic independently.
 */
function descriptorFromDrawing(smiles: string, center: number, priorities: number[]): 'R' | 'S' {
  const drawing = depict(smiles);
  const mol = drawing.molecule;
  const pos = (i: number) => ({ x: drawing.atoms[i].x, y: -drawing.atoms[i].y });
  const c = pos(center);
  const z = new Map<number, number>();
  for (const bi of mol.adjacency[center]) {
    const b = mol.bonds[bi];
    if (b.a !== center) continue;
    if (b.display === 'wedge') z.set(b.b, 1);
    if (b.display === 'hash') z.set(b.b, -1);
  }
  const vec3 = (i: number): [number, number, number] => {
    const u = norm(sub(pos(i), c));
    return [u.x, u.y, z.get(i) ?? 0];
  };
  const [p1, p2, p3] = priorities.map(vec3);
  // Lowest priority: the implicit H, opposite the drawn substituents.
  const zs = [...z.values()].reduce((s, v) => s + v, 0);
  const h: [number, number, number] = [-(p1[0] + p2[0] + p3[0]), -(p1[1] + p2[1] + p3[1]), -zs || -1];
  const a = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
  const b = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // Viewer sits opposite the hydrogen; anticlockwise for them means S.
  const towardsViewer = -(n[0] * h[0] + n[1] * h[1] + n[2] * h[2]);
  return towardsViewer > 0 ? 'S' : 'R';
}

describe('wedges', () => {
  it('draws L-alanine as S however the SMILES is written', () => {
    // atom indices: center, then [NH2, COOH carbon, CH3] by CIP priority
    expect(descriptorFromDrawing('N[C@@H](C)C(=O)O', 1, [0, 3, 2])).toBe('S');
    expect(descriptorFromDrawing('C[C@H](N)C(=O)O', 1, [2, 3, 0])).toBe('S');
    expect(descriptorFromDrawing('OC(=O)[C@@H](N)C', 3, [4, 1, 5])).toBe('S');
  });

  it('draws D-alanine as R', () => {
    expect(descriptorFromDrawing('N[C@H](C)C(=O)O', 1, [0, 3, 2])).toBe('R');
    expect(descriptorFromDrawing('C[C@@H](N)C(=O)O', 1, [2, 3, 0])).toBe('R');
  });

  it('wedges every stereocentre in the gallery', () => {
    for (const m of MOLECULES) {
      const d = depict(m.smiles);
      const centres = d.molecule.atoms.filter((a) => a.chirality);
      for (const atom of centres) {
        const wedged = d.molecule.adjacency[atom.index].some((bi) => {
          const b = d.molecule.bonds[bi];
          return b.a === atom.index && b.display !== 'plain';
        });
        expect(wedged, `${m.name} atom ${atom.index}`).toBe(true);
      }
    }
  });
});
