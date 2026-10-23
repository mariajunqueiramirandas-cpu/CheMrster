/**
 * Grading a guess, Wordle-style, one slot at a time: right piece, a close one (same family:
 * -ito for -ato, per- for hipo-, II for III), or wrong. An empty optional slot is a choice too:
 * leaving out the prefix of "hipoclorito" is as wrong as picking the wrong one.
 */
import type { Compound } from './catalog.ts';
import { type Category, type Guess, OPTIONAL, SLOTS, SLOT_LABEL, type Slot, piece } from './pieces.ts';

export type Verdict = 'right' | 'close' | 'wrong';

/** Tries per compound, as in Wordle. */
export const MAX_TRIES = 6;

export type Verdicts = Partial<Record<Slot, Verdict>>;

export interface Graded {
  verdicts: Verdicts;
  solved: boolean;
}

export function verdict(slot: Slot, guessed: string | undefined, answer: string | undefined): Verdict {
  if (guessed === answer) return 'right';
  if (guessed === undefined || answer === undefined) return 'wrong';
  const family = piece(slot, guessed)?.family;
  return family !== undefined && family === piece(slot, answer)?.family ? 'close' : 'wrong';
}

const SCORE: Record<Verdict, number> = { right: 2, close: 1, wrong: 0 };

/** Grades against the accepted answer it is closest to (fosfato and ortofosfato both count). */
export function grade(compound: Compound, guess: Guess): Graded {
  let best: Graded | undefined;
  let bestScore = -1;
  for (const answer of compound.answers) {
    const verdicts: Verdicts = {};
    let score = 0;
    for (const slot of SLOTS[compound.category]) {
      const v = verdict(slot, guess[slot], answer[slot]);
      verdicts[slot] = v;
      score += SCORE[v];
    }
    const solved = Object.values(verdicts).every((v) => v === 'right');
    if (solved) return { verdicts, solved };
    if (score > bestScore) {
      best = { verdicts, solved };
      bestScore = score;
    }
  }
  return best!;
}

const same = (category: Category, a: Guess, b: Guess) => SLOTS[category].every((s) => a[s] === b[s]);

/** Why a guess cannot be sent yet, or null when it can. */
export function problem(category: Category, guess: Guess, previous: readonly Guess[]): string | null {
  const missing = SLOTS[category].filter((s) => !OPTIONAL.includes(s) && guess[s] === undefined);
  if (missing.length) return `Falta ${missing.map((s) => `o ${SLOT_LABEL[s].toLowerCase()}`).join(' e ')}`;
  if (previous.some((p) => same(category, p, guess))) return 'Você já tentou esse nome';
  return null;
}

const RANK: Record<Verdict, number> = { wrong: 0, close: 1, right: 2 };

/** What the keyboard knows: each piece's best verdict so far, by `slot:id`. */
export function keyStates(compound: Compound, guesses: readonly Guess[]): Map<string, Verdict> {
  const states = new Map<string, Verdict>();
  for (const g of guesses) {
    const { verdicts } = grade(compound, g);
    for (const slot of SLOTS[compound.category]) {
      const id = g[slot];
      const v = verdicts[slot];
      if (id === undefined || !v) continue;
      const key = `${slot}:${id}`;
      const had = states.get(key);
      if (!had || RANK[v] > RANK[had]) states.set(key, v);
    }
  }
  return states;
}

export interface RoundState {
  guesses: readonly Guess[];
  graded: Graded[];
  won: boolean;
  lost: boolean;
  done: boolean;
}

export function roundState(compound: Compound, guesses: readonly Guess[]): RoundState {
  const graded = guesses.map((g) => grade(compound, g));
  const won = graded.some((g) => g.solved);
  const lost = !won && guesses.length >= MAX_TRIES;
  return { guesses, graded, won, lost, done: won || lost };
}
