/**
 * Turns SMILES tetrahedral parity (@ / @@) into wedge and hash bonds on the final 2D layout.
 */
import { type Vec, norm, sub } from './geometry.ts';
import type { Molecule } from './molecule.ts';

type P3 = [number, number, number];

function signedVolume(p0: P3, p1: P3, p2: P3, p3: P3): number {
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const w = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
  return u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0]);
}

/**
 * With n0 nearest the viewer, '@' lists n1..n3 anticlockwise. In a right-handed
 * frame that means the signed volume (n0, n1, n2, n3) is negative.
 */
function parityVolume(mol: Molecule, center: number, coords: Vec[], wedgeTo: number, z: number): number {
  const order = mol.atoms[center].stereoOrder!;
  const c = coords[center];
  const heavy = order.filter((n) => n >= 0);
  let hx = 0;
  let hy = 0;
  for (const n of heavy) {
    const u = norm(sub(coords[n], c));
    hx -= u.x;
    hy -= u.y;
  }
  const pts = order.map<P3>((n) => {
    if (n < 0) return [hx * 0.5, hy * 0.5, -z];
    const u = norm(sub(coords[n], c));
    return [u.x, u.y, n === wedgeTo ? z : 0];
  });
  if (pts.length === 3) pts.push([-(pts[0][0] + pts[1][0] + pts[2][0]), -(pts[0][1] + pts[1][1] + pts[2][1]), -z]);
  return signedVolume(pts[0], pts[1], pts[2], pts[3]);
}

export function assignWedges(mol: Molecule, coords: Vec[], ringBonds: boolean[]): void {
  for (const b of mol.bonds) if (b.display === 'wedge' || b.display === 'hash') b.display = 'plain';
  const stereoAtoms = mol.atoms.filter((a) => a.chirality && a.stereoOrder && a.stereoOrder.length >= 3);
  const isStereo = new Set(stereoAtoms.map((a) => a.index));
  for (const atom of stereoAtoms) {
    const center = atom.index;
    const order = atom.stereoOrder!;
    const options = order
      .filter((n) => n >= 0)
      .map((n) => {
        const bond = mol.bondBetween(center, n)!;
        let score = 0;
        if (!ringBonds[bond.index]) score += 10;
        if (!isStereo.has(n)) score += 6;
        if (mol.degree(n) === 1) score += 3;
        if (bond.order !== 1) score -= 50;
        if (bond.display !== 'plain') score -= 100;
        if (mol.atoms[n].element !== 'C') score += 1;
        return { n, bond, score };
      })
      .sort((p, q) => q.score - p.score);
    for (const { n, bond } of options) {
      const vol = parityVolume(mol, center, coords, n, 1);
      if (Math.abs(vol) < 0.05) continue;
      const anticlockwise = vol < 0;
      const wantWedge = (atom.chirality === '@') === anticlockwise;
      bond.display = wantWedge ? 'wedge' : 'hash';
      if (bond.a !== center) {
        bond.b = bond.a;
        bond.a = center;
      }
      break;
    }
  }
}
