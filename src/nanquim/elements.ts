/** Periodic-table data needed for perception and drawing. */

export interface ElementInfo {
  symbol: string;
  number: number;
  /** Normal valences, lowest first (used to infer implicit hydrogens). */
  valences: number[];
  /** Ink colour used by the optional "colour" palette. Tuned for print, not for 3D viewers. */
  color: string;
}

const INK = '#1b1b1f';

// prettier-ignore
const TABLE: Array<[string, number, number[], string?]> = [
  ['H', 1, [1]], ['He', 2, [0]],
  ['Li', 3, [1], '#7a4fb3'], ['Be', 4, [2]], ['B', 5, [3], '#b5651d'], ['C', 6, [4]], ['N', 7, [3, 5], '#2457c5'],
  ['O', 8, [2], '#d02c2c'], ['F', 9, [1], '#3d8c2f'], ['Ne', 10, [0]],
  ['Na', 11, [1], '#7a4fb3'], ['Mg', 12, [2], '#2f7f4f'], ['Al', 13, [3]], ['Si', 14, [4], '#8a6d3b'],
  ['P', 15, [3, 5], '#d4741c'], ['S', 16, [2, 4, 6], '#b08a00'], ['Cl', 17, [1], '#3d8c2f'], ['Ar', 18, [0]],
  ['K', 19, [1], '#7a4fb3'], ['Ca', 20, [2], '#2f7f4f'], ['Ti', 22, [4]], ['Cr', 24, [3]], ['Mn', 25, [2]],
  ['Fe', 26, [2, 3], '#b5651d'], ['Co', 27, [2, 3]], ['Ni', 28, [2]], ['Cu', 29, [1, 2], '#b5651d'],
  ['Zn', 30, [2]], ['Ga', 31, [3]], ['Ge', 32, [4]], ['As', 33, [3, 5]], ['Se', 34, [2, 4, 6], '#b08a00'],
  ['Br', 35, [1], '#9c3b1f'], ['Kr', 36, [0]], ['Rb', 37, [1]], ['Sr', 38, [2]], ['Ag', 47, [1]],
  ['Cd', 48, [2]], ['Sn', 50, [2, 4]], ['Sb', 51, [3, 5]], ['Te', 52, [2, 4, 6]], ['I', 53, [1], '#6b2fa0'],
  ['Xe', 54, [0]], ['Cs', 55, [1]], ['Ba', 56, [2]], ['Pt', 78, [2, 4]], ['Au', 79, [1, 3]],
  ['Hg', 80, [1, 2]], ['Pb', 82, [2, 4]], ['Bi', 83, [3, 5]], ['U', 92, [6]],
];

export const ELEMENTS: Record<string, ElementInfo> = Object.fromEntries(
  TABLE.map(([symbol, number, valences, color]) => [symbol, { symbol, number, valences, color: color ?? INK }]),
);

/** Atoms that may be written without brackets in SMILES. */
export const ORGANIC_SUBSET = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I']);
export const AROMATIC_SUBSET = new Set(['b', 'c', 'n', 'o', 'p', 's']);
export const BRACKET_AROMATIC = new Set(['b', 'c', 'n', 'o', 'p', 's', 'se', 'as', 'te']);

export function elementInfo(symbol: string): ElementInfo | undefined {
  return ELEMENTS[symbol];
}

/**
 * Valences adjusted for formal charge using the isoelectronic rule
 * (N+ behaves like C, O+ like N, C- like N, ...).
 */
export function chargedValences(symbol: string, charge: number): number[] {
  const base = ELEMENTS[symbol]?.valences ?? [0];
  if (charge === 0) return base;
  const group: Record<string, number> = { B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, I: 7, Se: 6 };
  const g = group[symbol];
  if (g === undefined) return base.map((v) => Math.max(0, v - Math.abs(charge)));
  // Valence electrons after charge; octet rule gives the bonding capacity.
  const electrons = g - charge;
  const v = electrons <= 4 ? electrons : 8 - electrons;
  return [Math.max(0, v)];
}
