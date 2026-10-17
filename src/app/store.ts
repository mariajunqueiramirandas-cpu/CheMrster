/** Learner progress, kept in localStorage (per device) and shared through a tiny external store. */
import type { Exercise } from '../course/types.ts';
import { persisted, usePersisted } from './persist.ts';

export interface LessonRecord {
  /** Best accuracy so far, 0..1. */
  best: number;
  times: number;
  /** Day of the last practice (lesson or review), as dayKey. Missing on records saved before reviews existed. */
  last?: string;
  /** Leitner box 1–5: the lesson comes back for review after 1, 2, 4, 8 or 16 days. */
  box?: number;
}

export type AttemptSource = 'lesson' | 'review' | 'tutor';

/** One answered question. */
export interface Attempt {
  /** When it was answered (epoch ms). */
  t: number;
  lesson: string;
  kind: Exercise['kind'];
  ok: boolean;
  /** A missed question asked again at the end of the session: not a first try. */
  retry?: boolean;
  /** Time spent on it, capped so a question left open does not count as study. */
  ms: number;
  source: AttemptSource;
}

/** What happened on one calendar day. */
export interface DayStats {
  xp: number;
  /** Every answer, retries included. */
  answered: number;
  firstTries: number;
  firstRight: number;
  /** Time on theory and questions. */
  ms: number;
}

export interface Progress {
  xp: number;
  completed: Record<string, LessonRecord>;
  streak: { count: number; last: string | null; best?: number };
  /** By dayKey. */
  days: Record<string, DayStats>;
  /** The latest answers, oldest first, capped at LOG_CAP. */
  log: Attempt[];
}

export const LOG_CAP = 2000;
/** Longest stretch one question or theory card can add to study time. */
export const MAX_STEP_MS = 120_000;

const EMPTY: Progress = { xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] };

const store = persisted<Progress>('chemrster:progress:v1', (stored) =>
  stored && typeof stored === 'object' ? { ...EMPTY, ...(stored as Partial<Progress>) } : EMPTY,
);

export const progressStore = store;

export function useProgress(): Progress {
  return usePersisted(store);
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from `key` to `now` (calendar days, so a review at 23:50 counts as yesterday at 00:10). */
export function daysSince(key: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - fromDayKey(key).getTime()) / 86_400_000);
}

/** Live streak: it lapses when yesterday was skipped. */
export function currentStreak(p: Progress, now = new Date()): number {
  if (!p.streak.last) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return p.streak.last === dayKey(now) || p.streak.last === dayKey(yesterday) ? p.streak.count : 0;
}

// ---------------------------------------------------------------------------
// Spaced review (Leitner boxes)

export const INTERVALS = [0, 1, 2, 4, 8, 16];

/** Box after a practice: up one when it went well, back to 1 when it went badly. */
export function nextBox(box: number | undefined, accuracy: number): number {
  if (accuracy >= 0.85) return Math.min(5, (box ?? 0) + 1);
  if (accuracy >= 0.6) return Math.max(1, box ?? 1);
  return 1;
}

export interface DueLesson {
  id: string;
  /** Days past the review date (0 = due today). */
  overdue: number;
  record: LessonRecord;
}

/** Completed lessons whose review date has come, most urgent first (most overdue, then weakest). */
export function dueLessons(p: Progress, now = new Date()): DueLesson[] {
  return Object.entries(p.completed)
    .map(([id, record]) => {
      const box = record.box ?? 1;
      const elapsed = record.last ? daysSince(record.last, now) : Infinity;
      return { id, record, overdue: elapsed - INTERVALS[box] };
    })
    .filter((d) => d.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue || a.record.best - b.record.best);
}

/** Days until the next lesson is due for review, or undefined when nothing has been completed. */
export function nextReviewIn(p: Progress, now = new Date()): number | undefined {
  const waits = Object.values(p.completed).map((r) => (r.last ? INTERVALS[r.box ?? 1] - daysSince(r.last, now) : 0));
  return waits.length ? Math.max(0, Math.min(...waits)) : undefined;
}

// ---------------------------------------------------------------------------
// Recording

const NO_DAY: DayStats = { xp: 0, answered: 0, firstTries: 0, firstRight: 0, ms: 0 };

/** Pure: the progress after gaining `xp` today, with the streak kept alive. */
function withXp(p: Progress, xp: number, now: Date): Progress {
  if (xp <= 0) return p;
  const today = dayKey(now);
  const day = p.days[today] ?? NO_DAY;
  const streak =
    p.streak.last === today
      ? p.streak
      : (() => {
          const count = currentStreak(p, now) + 1;
          return { count, last: today, best: Math.max(p.streak.best ?? 0, count) };
        })();
  return { ...p, xp: p.xp + xp, streak, days: { ...p.days, [today]: { ...day, xp: day.xp + xp } } };
}

/** Pure: the progress after one answered question. */
export function withAttempt(p: Progress, attempt: Omit<Attempt, 't'>, now = new Date()): Progress {
  const today = dayKey(now);
  const day = p.days[today] ?? NO_DAY;
  const ms = Math.max(0, Math.min(MAX_STEP_MS, Math.round(attempt.ms)));
  const first = !attempt.retry;
  const log = [...p.log, { ...attempt, ms, t: now.getTime() }];
  return {
    ...p,
    log: log.length > LOG_CAP ? log.slice(log.length - LOG_CAP) : log,
    days: {
      ...p.days,
      [today]: {
        ...day,
        answered: day.answered + 1,
        firstTries: day.firstTries + (first ? 1 : 0),
        firstRight: day.firstRight + (first && attempt.ok ? 1 : 0),
        ms: day.ms + ms,
      },
    },
  };
}

export function recordAttempt(attempt: Omit<Attempt, 't'>, xp = 0, now = new Date()) {
  store.set((p) => withXp(withAttempt(p, attempt, now), xp, now));
}

/** Time spent reading theory counts as study too. */
export function recordStudyTime(ms: number, now = new Date()) {
  const add = Math.max(0, Math.min(MAX_STEP_MS, Math.round(ms)));
  if (!add) return;
  store.set((p) => {
    const today = dayKey(now);
    const day = p.days[today] ?? NO_DAY;
    return { ...p, days: { ...p.days, [today]: { ...day, ms: day.ms + add } } };
  });
}

export function recordLesson(lessonId: string, accuracy: number, xp: number, now = new Date()) {
  store.set((state) => {
    const prev = state.completed[lessonId];
    const completed = {
      ...state.completed,
      [lessonId]: {
        best: Math.max(prev?.best ?? 0, accuracy),
        times: (prev?.times ?? 0) + 1,
        last: dayKey(now),
        box: nextBox(prev?.box, accuracy),
      },
    };
    return withXp({ ...state, completed }, xp, now);
  });
}

/** A review session: each lesson's box moves with how well its questions went. */
export function recordReview(accuracyByLesson: Record<string, number>, xp: number, now = new Date()) {
  store.set((state) => {
    const completed = { ...state.completed };
    for (const [id, accuracy] of Object.entries(accuracyByLesson)) {
      const prev = completed[id];
      if (!prev) continue;
      completed[id] = { ...prev, last: dayKey(now), box: nextBox(prev.box, accuracy) };
    }
    return withXp({ ...state, completed }, xp, now);
  });
}

export function resetProgress() {
  store.set(EMPTY);
}
