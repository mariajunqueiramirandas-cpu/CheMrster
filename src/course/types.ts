import type { FormulaKind } from '../nanquim/index.ts';
import type { Rng } from './random.ts';

/** A molecule as it appears inside an exercise. */
export interface MolSpec {
  smiles: string;
  name?: string;
  formula?: FormulaKind;
  /** Atoms to tint, e.g. the functional group being asked about. */
  highlight?: number[];
  /** Shown under the drawing. Only set when the name does not give the answer away. */
  caption?: string;
}

interface BaseExercise {
  prompt: string;
  /** Shown after answering, right or wrong. */
  explain: string;
}

export interface ChoiceExercise extends BaseExercise {
  kind: 'choice';
  molecule?: MolSpec;
  options: string[];
  answer: number;
}

export interface PickStructureExercise extends BaseExercise {
  kind: 'pick';
  /** Optional text or molecule the options are compared against. */
  molecule?: MolSpec;
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

export interface Lesson {
  id: string;
  /** The element tile this lesson occupies on the path; its atomic number is the lesson's order. */
  element: { symbol: string; number: number };
  title: string;
  summary: string;
  /** Undefined while the lesson is still being written. */
  generate?: (rng: Rng) => Exercise[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}
