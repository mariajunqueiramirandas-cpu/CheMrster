/** Learner progress, kept in localStorage (per device) and shared through a tiny external store. */
import { useSyncExternalStore } from 'react';

export interface LessonRecord {
  /** Best accuracy so far, 0..1. */
  best: number;
  times: number;
  /** Day of the last practice (lesson or review), as dayKey. Missing on records saved before reviews existed. */
  last?: string;
  /** Leitner box 1–5: the lesson comes back for review after 1, 2, 4, 8 or 16 days. */
  box?: number;
}

export interface Progress {
  xp: number;
  completed: Record<string, LessonRecord>;
  streak: { count: number; last: string | null };
}

const KEY = 'chemrster:progress:v1';
const EMPTY: Progress = { xp: 0, completed: {}, streak: { count: 0, last: null } };

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Private mode or blocked storage: start fresh in memory.
  }
  return EMPTY;
}

let state: Progress = load();
const listeners = new Set<() => void>();

function save(next: Progress) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Keep working in memory.
  }
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function fromDayKey(key: string): Date {
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

function bumpStreak(now: Date) {
  const today = dayKey(now);
  return state.streak.last === today ? state.streak : { count: currentStreak(state, now) + 1, last: today };
}

export function recordLesson(lessonId: string, accuracy: number, xp: number, now = new Date()) {
  const prev = state.completed[lessonId];
  save({
    xp: state.xp + xp,
    completed: {
      ...state.completed,
      [lessonId]: {
        best: Math.max(prev?.best ?? 0, accuracy),
        times: (prev?.times ?? 0) + 1,
        last: dayKey(now),
        box: nextBox(prev?.box, accuracy),
      },
    },
    streak: bumpStreak(now),
  });
}

/** A review session: each lesson's box moves with how well its questions went. */
export function recordReview(accuracyByLesson: Record<string, number>, xp: number, now = new Date()) {
  const completed = { ...state.completed };
  for (const [id, accuracy] of Object.entries(accuracyByLesson)) {
    const prev = completed[id];
    if (!prev) continue;
    completed[id] = { ...prev, last: dayKey(now), box: nextBox(prev.box, accuracy) };
  }
  save({ xp: state.xp + xp, completed, streak: bumpStreak(now) });
}

export function resetProgress() {
  save(EMPTY);
}
