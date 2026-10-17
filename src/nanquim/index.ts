/**
 * Nanquim — print-quality 2D chemical structure drawing.
 *
 *   import { renderSVG } from './nanquim';
 *   renderSVG('CC(=O)Oc1ccccc1C(=O)O'); // aspirin, as an SVG string
 */
import { type DepictOptions, depict } from './depict.ts';
import { type SvgOptions, toSVG } from './svg.ts';

export { depict, expandHydrogens, moleculeFromSmiles } from './depict.ts';
export type { AtomSite, DepictOptions, Drawing, FormulaKind, Highlight, Primitive } from './depict.ts';
export { toSVG } from './svg.ts';
export type { SvgOptions } from './svg.ts';
export { parseSmiles, SmilesError } from './smiles.ts';
export { perceive, PerceptionError } from './perception.ts';
export { computeLayout } from './layout.ts';
export { Molecule } from './molecule.ts';
export type { Atom, Bond } from './molecule.ts';
export { STYLES, resolveStyle } from './style.ts';
export type { DrawStyle, StyleName } from './style.ts';
export type { AtomLabel, TextRun } from './labels.ts';

export function renderSVG(smiles: string, options: DepictOptions & SvgOptions = {}): string {
  return toSVG(depict(smiles, options), options);
}
