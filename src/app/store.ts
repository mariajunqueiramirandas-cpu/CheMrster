/** Learner progress, kept in localStorage (per device) and shared through a tiny external store. */
import { useSyncExternalStore } from 'react';

export interface LessonRecord {
  /** Best accuracy so far, 0..1. */
  best: number;
  times: number;
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

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Live streak: it lapses when yesterday was skipped. */
export function currentStreak(p: Progress, now = new Date()): number {
  if (!p.streak.last) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return p.streak.last === dayKey(now) || p.streak.last === dayKey(yesterday) ? p.streak.count : 0;
}

export function recordLesson(lessonId: string, accuracy: number, xp: number) {
  const now = new Date();
  const today = dayKey(now);
  const prev = state.completed[lessonId];
  const streak =
    state.streak.last === today ? state.streak : { count: currentStreak(state, now) + 1, last: today };
  save({
    xp: state.xp + xp,
    completed: {
      ...state.completed,
      [lessonId]: { best: Math.max(prev?.best ?? 0, accuracy), times: (prev?.times ?? 0) + 1 },
    },
    streak,
  });
}

export function resetProgress() {
  save(EMPTY);
}
