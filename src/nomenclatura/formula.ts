/** Formulas as plain strings ("Fe2(SO4)3"): built from ions, counted, and typeset. */

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** One run of a typeset formula: subscripts are the counts. */
export interface FormulaRun {
  text: string;
  sub: boolean;
}

/** "Fe2(SO4)3" → Fe, 2, (SO, 4, ), 3, with the counts marked as subscripts. */
export function runs(formula: string): FormulaRun[] {
  const out: FormulaRun[] = [];
  for (const [, digits, other] of formula.matchAll(/(\d+)|([^\d]+)/g)) {
    out.push(digits ? { text: digits, sub: true } : { text: other, sub: false });
  }
  return out;
}

/** The formula with Unicode subscripts, for plain text: Fe₂(SO₄)₃. */
export const pretty = (formula: string) => formula.replace(/\d/g, (d) => SUB[Number(d)]);

/** An ion with its charge: SO₄²⁻, Fe³⁺, Cl⁻. */
export function ionText(formula: string, charge: number): string {
  const size = Math.abs(charge);
  const digits = size === 1 ? '' : String(size).replace(/\d/g, (d) => SUP[Number(d)]);
  return `${pretty(formula)}${digits}${charge < 0 ? '⁻' : '⁺'}`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** How many of each ion make a neutral compound: Fe³⁺ and SO₄²⁻ → 2 and 3. */
export function balance(cationCharge: number, anionCharge: number): { cations: number; anions: number } {
  const lcm = (cationCharge * anionCharge) / gcd(cationCharge, anionCharge);
  return { cations: lcm / cationCharge, anions: lcm / anionCharge };
}

/** An ion written `count` times: Na2, (NH4)2, (SO4)3, Cl3. */
function times(formula: string, count: number, polyatomic: boolean): string {
  if (count === 1) return formula;
  return polyatomic ? `(${formula})${count}` : `${formula}${count}`;
}

export interface IonSpec {
  formula: string;
  /** Size of the charge (no sign). */
  charge: number;
  polyatomic: boolean;
}

/** The neutral compound of two ions, cation first: Al³⁺ + SO₄²⁻ → Al2(SO4)3. */
export function compound(cation: IonSpec, anion: IonSpec): string {
  const n = balance(cation.charge, anion.charge);
  return times(cation.formula, n.cations, cation.polyatomic) + times(anion.formula, n.anions, anion.polyatomic);
}

/** Atoms of each element: "Ca(H2PO4)2" → { Ca: 1, H: 4, P: 2, O: 8 }. */
export function counts(formula: string): Record<string, number> {
  const stack: Record<string, number>[] = [{}];
  const add = (into: Record<string, number>, el: string, n: number) => (into[el] = (into[el] ?? 0) + n);
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)|(\()|\)(\d*)/g)) {
    if (m[1]) add(stack[stack.length - 1], m[1], Number(m[2] || 1));
    else if (m[3]) stack.push({});
    else {
      const group = stack.pop();
      if (!group || !stack.length) throw new Error(`Parênteses desbalanceados em ${formula}`);
      const k = Number(m[4] || 1);
      for (const [el, n] of Object.entries(group)) add(stack[stack.length - 1], el, n * k);
    }
  }
  if (stack.length !== 1) throw new Error(`Parênteses desbalanceados em ${formula}`);
  return stack[0];
}
