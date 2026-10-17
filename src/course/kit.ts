/**
 * Building blocks shared by every lesson generator: cached parsing, Portuguese text
 * helpers and the exercise constructors (multiple choice, pick the structure, tap atoms).
 */
import { canonicalKey } from '../chem/graph.ts';
import { type FormulaKind, type Molecule, moleculeFromSmiles } from '../nanquim/index.ts';
import type { Named } from './pools.ts';
import type { Rng } from './random.ts';
import type { ChoiceExercise, Exercise, MolSpec, PickStructureExercise, Scheme, TapAtomsExercise, Term } from './types.ts';

const cache = new Map<string, Molecule>();
export function mol(smiles: string): Molecule {
  let m = cache.get(smiles);
  if (!m) {
    m = moleculeFromSmiles(smiles);
    cache.set(smiles, m);
  }
  return m;
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
export const joinPt = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
export const subscript = (formula: string) => formula.replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]);
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/**
 * Ethane is a bare line in skeletal form and chloromethane a line with a Cl; write
 * two-atom molecules out (H₃C–CH₃, H₃C–Cl) so a scheme or prompt still says something.
 */
export function readableFormula(smiles: string): FormulaKind | undefined {
  const m = mol(smiles);
  return m.atoms.length === 2 && m.atoms.every((a) => a.element !== '*') ? 'condensed' : undefined;
}

export const carbons = (m: Molecule) => m.atoms.filter((a) => a.element === 'C').map((a) => a.index);

export function choice(
  rng: Rng,
  prompt: string,
  correct: string,
  distractors: string[],
  explain: string,
  molecule?: MolSpec,
): ChoiceExercise {
  const unique = [...new Set(distractors.filter((d) => d !== correct))];
  const options = rng.shuffle([correct, ...unique]);
  return { kind: 'choice', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

/** Options kept in their natural order (numbers, yes/no). */
export function orderedChoice(prompt: string, options: string[], correct: string, explain: string, molecule?: MolSpec): ChoiceExercise {
  return { kind: 'choice', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

export function numberOptions(rng: Rng, answer: number, min = 0): string[] {
  const start = Math.max(min, answer - rng.int(3));
  return [0, 1, 2, 3].map((k) => String(start + k));
}

export function pick(
  rng: Rng,
  prompt: string,
  correct: MolSpec,
  distractors: MolSpec[],
  explain: string,
  molecule?: MolSpec,
): PickStructureExercise {
  const options = rng.shuffle([correct, ...distractors]);
  return { kind: 'pick', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

export function tap(prompt: string, molecule: MolSpec, answer: number[], explain: string, tappable?: number[]): TapAtomsExercise {
  return { kind: 'tap', prompt, molecule, answer: [...answer].sort((a, b) => a - b), explain, tappable };
}

/** Distractors that look alike: isomers first, then molecules of similar size. */
export function lookalikes(rng: Rng, target: Named, pool: Named[], count: number): Named[] {
  const formula = mol(target.smiles).formula();
  const size = carbons(mol(target.smiles)).length;
  const others = pool.filter((p) => p.smiles !== target.smiles && p.name !== target.name);
  const isomers = rng.shuffle(others.filter((p) => mol(p.smiles).formula() === formula));
  const near = rng
    .shuffle(others.filter((p) => !isomers.includes(p)))
    .sort((a, b) => Math.abs(carbons(mol(a.smiles)).length - size) - Math.abs(carbons(mol(b.smiles)).length - size));
  return [...isomers, ...near].slice(0, count);
}

/** What makes two exercises the same question, so a lesson does not ask it twice. */
function signature(ex: Exercise): string {
  const answers = ex.kind === 'choice' ? [...ex.options].sort() : ex.kind === 'pick' ? ex.options.map((o) => o.smiles).sort() : ex.answer;
  return JSON.stringify([ex.prompt, ex.molecule?.smiles, ex.kind === 'tap' ? null : ex.scheme, answers]);
}

export function lessonSet(rng: Rng, makers: Array<() => Exercise | undefined>, count = 8): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 12) {
    const ex = makers[out.length % makers.length]();
    if (!ex) continue;
    const key = signature(ex);
    // A repeat is accepted only if the pools have run dry.
    if (seen.has(key) && guard < count * 10) continue;
    seen.add(key);
    out.push(ex);
  }
  return rng.shuffle(out);
}

/** The article for a substance name: "o butanal", "a butanona", "a glicina". */
export function article(name: string): 'o' | 'a' {
  const head = name.split(/[\s(]/)[0];
  return /(ona|ina|ida|ila|ose|eia|ase)$/.test(head) ? 'a' : 'o';
}
/** "o butanal" / "a butanona". */
export const the = (name: string) => `${article(name)} ${name}`;
/** "do fenol" / "da benzonitrila". */
export const of = (name: string) => `${article(name) === 'a' ? 'da' : 'do'} ${name}`;
/** "ao propeno" / "à glicina". */
export const to = (name: string) => `${article(name) === 'a' ? 'à' : 'ao'} ${name}`;

// ---------------------------------------------------------------------------
// Reaction schemes

/** A structure in a scheme, optionally with its coefficient ("3"). */
export const drawn = (smiles: string, extra: Partial<MolSpec> = {}, coef?: string): Term => ({ mol: { smiles, ...extra }, coef });
/** A formula written as text: H₂O, O₂, NaOH. */
export const written = (text: string, coef?: string): Term => ({ text, coef });
/** The "?" the question asks about. */
export const unknown = (coef?: string): Term => ({ unknown: true, coef });

export function scheme(left: Term[], right: Term[], extra: Omit<Scheme, 'left' | 'right'> = {}): Scheme {
  return { left, right, ...extra };
}

/** 3.5 → "3,5", the way numbers are written in Brazil. */
export const decimal = (n: number) => String(n).replace('.', ',');

/**
 * Up to `count` distractors that are different substances from the answer and from
 * each other (two SMILES of the same molecule would make two right answers).
 */
export function distinctFrom(correct: string, candidates: Array<string | undefined | null>, count: number): string[] {
  const seen = new Set([canonicalKey(correct)]);
  const out: string[] = [];
  for (const c of candidates) {
    if (!c || out.length >= count) continue;
    const key = canonicalKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
