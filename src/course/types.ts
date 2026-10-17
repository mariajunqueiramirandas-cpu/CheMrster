import type { FormulaKind } from '../nanquim/index.ts';
import type { Rng } from './random.ts';

/** A molecule as it appears inside an exercise. */
export interface MolSpec {
  smiles: string;
  name?: string;
  formula?: FormulaKind;
  /** Atoms to tint, e.g. the functional group being asked about. */
  highlight?: number[];
  /** Shown in bold under the drawing. Only set when the name does not give the answer away. */
  caption?: string;
  /** Line under the caption, ENEM style: "(no óleo de anis)". */
  source?: string;
  /** A repeat unit: the two `*` atoms are the open ends, drawn inside brackets with n. */
  polymer?: boolean;
}

/** One side of a reaction scheme: a drawn structure, a written formula (H₂O, O₂) or the unknown asked about. */
export type Term = { coef?: string } & ({ mol: MolSpec } | { text: string } | { unknown: true });

/** Reactants → products, with reagents and conditions written over and under the arrow. */
export interface Scheme {
  left: Term[];
  right: Term[];
  over?: string;
  under?: string;
  /** Equilibrium arrows (⇌), as in esterification. */
  reversible?: boolean;
}

interface BaseExercise {
  prompt: string;
  /** Shown after answering, right or wrong. */
  explain: string;
}

export interface ChoiceExercise extends BaseExercise {
  kind: 'choice';
  molecule?: MolSpec;
  scheme?: Scheme;
  options: string[];
  answer: number;
}

export interface PickStructureExercise extends BaseExercise {
  kind: 'pick';
  /** Optional text or molecule the options are compared against. */
  molecule?: MolSpec;
  /** A reaction whose unknown the options fill in. */
  scheme?: Scheme;
  options: MolSpec[];
  answer: number;
}

export interface TapAtomsExercise extends BaseExercise {
  kind: 'tap';
  molecule: MolSpec;
  /** Every atom that must be selected (and nothing else). */
  answer: number[];
  /** Atoms that may be tapped; defaults to every atom. */
  tappable?: number[];
}

export type Exercise = ChoiceExercise | PickStructureExercise | TapAtomsExercise;

/** A short explanation shown before a lesson's exercises: teach first, then practise. */
export interface TheoryCard {
  title: string;
  /** Short paragraphs. **Double asterisks** mark the key terms. */
  body: string[];
  /**
   * Structures under the text; `label` is a short line under each (not the caption) and
   * `marks` dots separate atoms (ring positions) where an outline would swallow the ring.
   */
  molecules?: Array<MolSpec & { label?: string; marks?: number[] }>;
  scheme?: Scheme;
  /** One line on how the ENEM asks about it. */
  tip?: string;
}

export interface Lesson {
  id: string;
  /** The element tile this lesson occupies on the path; its atomic number is the lesson's order. */
  element: { symbol: string; number: number };
  title: string;
  summary: string;
  /** Undefined while the lesson is still being written. */
  generate?: (rng: Rng) => Exercise[];
  /** Cards shown before the first exercise. */
  theory?: TheoryCard[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
