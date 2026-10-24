/** A player's days: what was typed for each compound, and the statistics. */
import { type Compound, compoundById } from './catalog.ts';
import { daily, dailySize } from './daily.ts';
import { CATEGORIES, type Category } from './pieces.ts';

export interface Answer {
  /** The compound answered (kept, so a later catalog change cannot swap it under a played day). */
  id: string;
  /** What was typed. */
  typed: string;
  correct: boolean;
}

/** A day's answers, in the challenge's order. */
export type DayPlay = Answer[];

/** By challenge number. */
export type Days = Record<string, DayPlay>;

export interface Question {
  compound: Compound;
  answer?: Answer;
}

/** A day's questions, with the answers given so far. */
export function questionsOf(n: number, day: DayPlay | undefined, today: Compound[] = daily(n)): Question[] {
  return today.map((fallback, i) => {
    const answer = day?.[i];
    return { compound: (answer && compoundById(answer.id)) || fallback, answer };
  });
}

/** Whether challenge `n` has every compound answered. */
export const isComplete = (day: DayPlay | undefined, n: number) => (day?.length ?? 0) >= dailySize(n);

export interface Stats {
  /** Days with at least one answer. */
  played: number;
  /** Days with every compound answered. */
  complete: number;
  answered: number;
  correct: number;
  /** Consecutive complete days up to today (or yesterday, while today is still open). */
  streak: number;
  best: number;
  byCategory: Record<Category, { answered: number; correct: number }>;
}

export function stats(days: Days, today: number): Stats {
  const s: Stats = {
    played: 0,
    complete: 0,
    answered: 0,
    correct: 0,
    streak: 0,
    best: 0,
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, { answered: 0, correct: 0 }])) as Stats['byCategory'],
  };
  const complete = new Set<number>();
  for (const [key, day] of Object.entries(days)) {
    if (!day.length) continue;
    s.played++;
    if (isComplete(day, Number(key))) complete.add(Number(key));
    for (const a of day) {
      const category = compoundById(a.id)?.category;
      s.answered++;
      if (a.correct) s.correct++;
      if (!category) continue;
      s.byCategory[category].answered++;
      if (a.correct) s.byCategory[category].correct++;
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
