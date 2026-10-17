/**
 * What the learner's history says: how well each lesson is known today (accuracy that
 * fades with a forgetting curve), the study calendar, the review forecast and weak spots.
 */
import { COURSE, LESSONS } from '../course/course.ts';
import type { Exercise } from '../course/types.ts';
import { type Attempt, type DayStats, INTERVALS, type Progress, dayKey, daysSince } from '../app/store.ts';

export type MasteryLevel = 'nova' | 'fraca' | 'media' | 'forte';

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  nova: 'Não começou',
  fraca: 'Precisa de reforço',
  media: 'Em progresso',
  forte: 'Dominada',
};

export interface LessonMastery {
  id: string;
  level: MasteryLevel;
  /** 0..1: skill × retention. */
  mastery: number;
  /** Recent first-try accuracy, smoothed toward 50% while there is little evidence. */
  skill: number;
  /** 0..1: how much is still remembered; 0.9 on the review date. */
  retention: number;
  /** First tries the skill is based on. */
  evidence: number;
  completed: boolean;
  /** Days until the review (≤ 0 = due); undefined until completed. */
  dueIn?: number;
}

/** Attempts per lesson that the skill looks at: the recent ones say more than old ones. */
export const SKILL_WINDOW = 16;

/**
 * Forgetting curve (the power law used by FSRS): 90% remembered on the review date, then a
 * slow decline, so a lesson unseen for a month is fading rather than gone.
 */
export function retention(elapsedDays: number, box: number | undefined): number {
  const stability = INTERVALS[Math.min(5, Math.max(1, box ?? 1))];
  return (1 + ((19 / 81) * Math.max(0, elapsedDays)) / stability) ** -0.5;
}

function firstTries(log: Attempt[], lesson: string): Attempt[] {
  const out: Attempt[] = [];
  for (let i = log.length - 1; i >= 0 && out.length < SKILL_WINDOW; i--) {
    if (log[i].lesson === lesson && !log[i].retry) out.push(log[i]);
  }
  return out;
}

export function levelOf(mastery: number, started: boolean): MasteryLevel {
  if (!started) return 'nova';
  if (mastery >= 0.8) return 'forte';
  if (mastery >= 0.55) return 'media';
  return 'fraca';
}

export function masteryOf(p: Progress, id: string, now = new Date()): LessonMastery {
  const record = p.completed[id];
  const tries = firstTries(p.log, id);
  const right = tries.filter((a) => a.ok).length;
  // Laplace smoothing: three right answers are not yet mastery.
  const fromLog = tries.length ? (right + 1) / (tries.length + 2) : undefined;
  const skill = fromLog ?? record?.best ?? 0;
  if (!record) {
    // Started but not finished: half credit, so an abandoned lesson never reads as known.
    const mastery = skill * 0.5;
    return { id, level: levelOf(mastery, tries.length > 0), mastery, skill, retention: 1, evidence: tries.length, completed: false };
  }
  const elapsed = record.last ? daysSince(record.last, now) : Infinity;
  const r = Number.isFinite(elapsed) ? retention(elapsed, record.box) : 0.5;
  const mastery = skill * r;
  const dueIn = Number.isFinite(elapsed) ? INTERVALS[record.box ?? 1] - elapsed : 0;
  return { id, level: levelOf(mastery, true), mastery, skill, retention: r, evidence: tries.length, completed: true, dueIn };
}

export function masteryAll(p: Progress, now = new Date()): Record<string, LessonMastery> {
  return Object.fromEntries(LESSONS.filter((l) => l.generate).map((l) => [l.id, masteryOf(p, l.id, now)]));
}

/** The course as a whole: mean mastery over every playable lesson. */
export function overallMastery(all: Record<string, LessonMastery>): number {
  const values = Object.values(all);
  return values.length ? values.reduce((s, m) => s + m.mastery, 0) / values.length : 0;
}

export function unitMastery(all: Record<string, LessonMastery>): Array<{ id: string; title: string; mastery: number; done: number; total: number }> {
  return COURSE.map((unit) => {
    const ms = unit.lessons.map((l) => all[l.id]).filter(Boolean);
    return {
      id: unit.id,
      title: unit.title,
      mastery: ms.length ? ms.reduce((s, m) => s + m.mastery, 0) / ms.length : 0,
      done: ms.filter((m) => m.completed).length,
      total: ms.length,
    };
  });
}

/** Completed or started lessons that most need work, weakest first. */
export function weakSpots(all: Record<string, LessonMastery>, count = 3): LessonMastery[] {
  return Object.values(all)
    .filter((m) => m.level === 'fraca' || m.level === 'media')
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, count);
}

// ---------------------------------------------------------------------------
// Calendar

export interface DayPoint extends DayStats {
  key: string;
  date: Date;
  /** First-try accuracy that day, when anything was answered. */
  accuracy?: number;
}

const NO_DAY: DayStats = { xp: 0, answered: 0, firstTries: 0, firstRight: 0, ms: 0 };

function point(p: Progress, date: Date): DayPoint {
  const key = dayKey(date);
  const d = p.days[key] ?? NO_DAY;
  return { ...d, key, date, accuracy: d.firstTries ? d.firstRight / d.firstTries : undefined };
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The last `days` days, oldest first, today last. */
export function dailySeries(p: Progress, days: number, now = new Date()): DayPoint[] {
  return Array.from({ length: days }, (_, i) => point(p, addDays(now, i - days + 1)));
}

/** Heat level 0–4 against the daily goal: 3 means the goal was met that day. */
export function heatLevel(xp: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (xp <= 0) return 0;
  if (xp < goal / 2) return 1;
  if (xp < goal) return 2;
  if (xp < goal * 2) return 3;
  return 4;
}

/**
 * Week columns (Sunday on top, as Brazilian calendars print them) ending with the current
 * week; days after today are marked `future`.
 */
export function calendarWeeks(p: Progress, weeks: number, now = new Date()): Array<Array<DayPoint & { future: boolean }>> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = addDays(today, -today.getDay() - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { ...point(p, date), future: date > today };
    }),
  );
}

/** Lessons coming back for review on each of the next `days` days; today includes the overdue. */
export function reviewForecast(p: Progress, days = 7, now = new Date()): Array<{ key: string; date: Date; lessons: string[] }> {
  const out = Array.from({ length: days }, (_, i) => {
    const date = addDays(now, i);
    return { key: dayKey(date), date, lessons: [] as string[] };
  });
  for (const [id, record] of Object.entries(p.completed)) {
    const wait = record.last ? INTERVALS[record.box ?? 1] - daysSince(record.last, now) : 0;
    const slot = Math.max(0, wait);
    if (slot < days) out[slot].lessons.push(id);
  }
  return out;
}

export interface Totals {
  questions: number;
  /** First-try accuracy over the last 7 days. */
  accuracy7?: number;
  minutes: number;
  minutes7: number;
  activeDays: number;
  xpToday: number;
}

export function totals(p: Progress, now = new Date()): Totals {
  const week = dailySeries(p, 7, now);
  const all = Object.values(p.days);
  const tries = week.reduce((s, d) => s + d.firstTries, 0);
  const right = week.reduce((s, d) => s + d.firstRight, 0);
  return {
    questions: all.reduce((s, d) => s + d.answered, 0),
    accuracy7: tries ? right / tries : undefined,
    minutes: Math.round(all.reduce((s, d) => s + d.ms, 0) / 60_000),
    minutes7: Math.round(week.reduce((s, d) => s + d.ms, 0) / 60_000),
    activeDays: all.filter((d) => d.xp > 0 || d.answered > 0).length,
    xpToday: week[week.length - 1].xp,
  };
}

export const KIND_LABEL: Record<Exercise['kind'], string> = {
  choice: 'Múltipla escolha',
  pick: 'Escolher a estrutura',
  tap: 'Tocar nos átomos',
};

/** First-try accuracy by question format, over the whole log. */
export function accuracyByKind(p: Progress): Array<{ kind: Exercise['kind']; tries: number; right: number }> {
  const acc = { choice: { tries: 0, right: 0 }, pick: { tries: 0, right: 0 }, tap: { tries: 0, right: 0 } };
  for (const a of p.log) {
    if (a.retry) continue;
    acc[a.kind].tries++;
    if (a.ok) acc[a.kind].right++;
  }
  return (Object.keys(acc) as Array<Exercise['kind']>).map((kind) => ({ kind, ...acc[kind] }));
}

/** Whole days from today to a YYYY-MM-DD date (negative once it has passed). */
export function daysUntil(isoDate: string, now = new Date()): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return undefined;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** The first playable lesson not yet completed. */
export function nextLesson(p: Progress) {
  return LESSONS.find((l) => l.generate && !p.completed[l.id]);
}
