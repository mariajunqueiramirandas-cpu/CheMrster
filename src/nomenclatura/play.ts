/** A learner's days of play: what was guessed, the statistics, and the result to share. */
import { type Compound, compoundById } from './catalog.ts';
import { type Daily, daily } from './daily.ts';
import { MAX_TRIES, type RoundState, type Verdict, roundState } from './grade.ts';
import { CATEGORIES, CATEGORY_EMOJI, type Category, type Guess, SLOTS } from './pieces.ts';

export interface RoundPlay {
  /** The compound played (kept, so a later catalog change cannot swap it under a finished game). */
  id: string;
  guesses: Guess[];
}

export type DayPlay = Partial<Record<Category, RoundPlay>>;

/** By puzzle number. */
export type Days = Record<string, DayPlay>;

export interface Round {
  compound: Compound;
  state: RoundState;
}

/** A day's three rounds, as played (or fresh). */
export function roundsOf(n: number, day: DayPlay | undefined, today: Daily = daily(n)): Record<Category, Round> {
  return Object.fromEntries(
    CATEGORIES.map((cat) => {
      const play = day?.[cat];
      const compound = (play && compoundById(play.id)) || today[cat];
      return [cat, { compound, state: roundState(compound, play?.guesses ?? []) }];
    }),
  ) as Record<Category, Round>;
}

/** All three rounds finished. */
export const isComplete = (rounds: Record<Category, Round>) => Object.values(rounds).every((r) => r.state.done);

export interface Stats {
  /** Days with at least one finished round. */
  played: number;
  /** Days with all three rounds finished. */
  complete: number;
  /** Finished rounds and the ones solved. */
  rounds: number;
  wins: number;
  /** Consecutive complete days up to today (or yesterday, while today is still open). */
  streak: number;
  best: number;
  /** Solved rounds by the try that solved them (index 0 = first try). */
  tries: number[];
  losses: number;
  byCategory: Record<Category, { rounds: number; wins: number }>;
}

export function stats(days: Days, today: number): Stats {
  const s: Stats = {
    played: 0,
    complete: 0,
    rounds: 0,
    wins: 0,
    streak: 0,
    best: 0,
    tries: Array(MAX_TRIES).fill(0),
    losses: 0,
    byCategory: { acido: { rounds: 0, wins: 0 }, base: { rounds: 0, wins: 0 }, sal: { rounds: 0, wins: 0 } },
  };
  const complete = new Set<number>();
  for (const [key, day] of Object.entries(days)) {
    const n = Number(key);
    const rounds = roundsOf(n, day);
    const finished = Object.values(rounds).filter((r) => r.state.done);
    if (!finished.length) continue;
    s.played++;
    if (isComplete(rounds)) complete.add(n);
    for (const { compound, state } of finished) {
      s.rounds++;
      s.byCategory[compound.category].rounds++;
      if (state.won) {
        s.wins++;
        s.byCategory[compound.category].wins++;
        s.tries[state.guesses.length - 1]++;
      } else s.losses++;
    }
  }
  s.complete = complete.size;
  for (let n = complete.has(today) ? today : today - 1; complete.has(n); n--) s.streak++;
  let run = 0;
  for (const n of [...complete].sort((a, b) => a - b)) {
    run = complete.has(n - 1) ? run + 1 : 1;
    s.best = Math.max(s.best, run);
  }
  return s;
}

export type Squares = 'normal' | 'contrast';

const SQUARE: Record<Squares, Record<Verdict, string>> = {
  normal: { right: '🟩', close: '🟨', wrong: '⬛' },
  // The high-contrast colours, as in Wordle's.
  contrast: { right: '🟧', close: '🟦', wrong: '⬛' },
};

/** The verdicts of one guess as squares, in slot order. */
export const squares = (round: Round, i: number, look: Squares = 'normal') =>
  SLOTS[round.compound.category].map((slot) => SQUARE[look][round.state.graded[i].verdicts[slot] ?? 'wrong']).join('');

/** The result to paste in a group chat: no names, only how it went. */
export function shareText(n: number, day: DayPlay | undefined, streak: number, look: Squares = 'normal'): string {
  const rounds = roundsOf(n, day);
  const solved = CATEGORIES.filter((c) => rounds[c].state.won).length;
  const lines = [`CheMrster #${n} · ${solved}/${CATEGORIES.length}${streak > 1 ? ` · 🔥${streak}` : ''}`];
  for (const cat of CATEGORIES) {
    const r = rounds[cat];
    const score = r.state.won ? r.state.guesses.length : r.state.done ? 'X' : '–';
    const rows = r.state.guesses.map((_, i) => squares(r, i, look)).join(' ');
    lines.push(`${CATEGORY_EMOJI[cat]} ${score}/${MAX_TRIES} ${rows}`.trimEnd());
  }
  return lines.join('\n');
}
