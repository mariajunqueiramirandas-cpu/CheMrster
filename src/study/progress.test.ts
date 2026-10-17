import { describe, expect, it } from 'vitest';
import { type Attempt, type Progress, dayKey, withAttempt } from '../app/store.ts';
import {
  calendarWeeks,
  dailySeries,
  daysUntil,
  heatLevel,
  masteryOf,
  retention,
  reviewForecast,
  totals,
  weakSpots,
  masteryAll,
  accuracyByKind,
} from './progress.ts';

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const empty = (): Progress => ({ xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] });
const attempt = (lesson: string, ok: boolean, extra: Partial<Attempt> = {}): Omit<Attempt, 't'> => ({
  lesson,
  kind: 'choice',
  ok,
  ms: 20_000,
  source: 'lesson',
  ...extra,
});

describe('mastery', () => {
  it('forgets along a curve that reads 90% on the review date', () => {
    expect(retention(0, 1)).toBe(1);
    expect(retention(1, 1)).toBeCloseTo(0.9);
    expect(retention(4, 3)).toBeCloseTo(0.9);
    expect(retention(8, 3)).toBeCloseTo(0.825, 2);
    // A month without review fades but is not forgotten.
    expect(retention(30, 1)).toBeGreaterThan(0.3);
    // Longer boxes forget more slowly.
    expect(retention(4, 5)).toBeGreaterThan(retention(4, 2));
  });

  it('combines recent first tries with retention', () => {
    const now = day(2026, 10, 17);
    let p = empty();
    for (let i = 0; i < 8; i++) p = withAttempt(p, attempt('adicao', true), now);
    p = withAttempt(p, attempt('adicao', false, { retry: true }), now); // retries do not count
    p = { ...p, completed: { adicao: { best: 1, times: 1, last: dayKey(now), box: 2 } } };
    const today = masteryOf(p, 'adicao', now);
    expect(today.skill).toBeCloseTo(0.9);
    expect(today.evidence).toBe(8);
    expect(today.level).toBe('forte');
    expect(today.dueIn).toBe(2);
    const later = masteryOf(p, 'adicao', day(2026, 10, 25));
    expect(later.retention).toBeLessThan(0.75);
    expect(later.level).toBe('media');
    expect(later.dueIn).toBeLessThan(0);
  });

  it('gives half credit to a lesson started but not finished', () => {
    let p = empty();
    for (let i = 0; i < 3; i++) p = withAttempt(p, attempt('quiral', true));
    const m = masteryOf(p, 'quiral');
    expect(m.completed).toBe(false);
    expect(m.mastery).toBeLessThan(0.5);
    expect(m.level).toBe('fraca');
    expect(masteryOf(empty(), 'quiral').level).toBe('nova');
  });

  it('falls back to the best score for records saved before the log existed', () => {
    const now = day(2026, 10, 17);
    const p = { ...empty(), completed: { saturacao: { best: 0.75, times: 2, last: dayKey(now), box: 1 } } };
    expect(masteryOf(p, 'saturacao', now).skill).toBe(0.75);
  });

  it('lists the weakest started lessons first', () => {
    const now = day(2026, 10, 17);
    let p = empty();
    for (let i = 0; i < 6; i++) p = withAttempt(p, attempt('adicao', i % 2 === 0), now);
    for (let i = 0; i < 6; i++) p = withAttempt(p, attempt('oxidacao', i < 5), now);
    const last = dayKey(now);
    p = { ...p, completed: { adicao: { best: 0.5, times: 1, last, box: 1 }, oxidacao: { best: 0.8, times: 1, last, box: 1 } } };
    expect(weakSpots(masteryAll(p, now)).map((m) => m.id)).toEqual(['adicao', 'oxidacao']);
  });
});

describe('calendar', () => {
  it('aggregates answers and time by day', () => {
    const now = day(2026, 10, 17);
    let p = empty();
    p = withAttempt(p, attempt('a', true, { ms: 30_000 }), now);
    p = withAttempt(p, attempt('a', false, { ms: 10 * 60_000 }), now); // capped at 2 min
    p = withAttempt(p, attempt('a', true, { retry: true }), now);
    const today = dailySeries(p, 3, now).at(-1)!;
    expect(today.answered).toBe(3);
    expect(today.firstTries).toBe(2);
    expect(today.accuracy).toBe(0.5);
    expect(today.ms).toBe(30_000 + 120_000 + 20_000);
    expect(totals(p, now).minutes).toBe(3);
  });

  it('lays weeks out Sunday first and marks the days ahead', () => {
    const now = day(2026, 10, 15); // a Thursday
    const weeks = calendarWeeks(empty(), 3, now);
    expect(weeks).toHaveLength(3);
    expect(weeks[0][0].date.getDay()).toBe(0);
    const current = weeks[2];
    expect(current[4].key).toBe(dayKey(now));
    expect(current[4].future).toBe(false);
    expect(current[5].future).toBe(true);
  });

  it('grades a day against the goal', () => {
    expect(heatLevel(0, 20)).toBe(0);
    expect(heatLevel(5, 20)).toBe(1);
    expect(heatLevel(15, 20)).toBe(2);
    expect(heatLevel(20, 20)).toBe(3);
    expect(heatLevel(45, 20)).toBe(4);
  });

  it('forecasts reviews, overdue ones today', () => {
    const now = day(2026, 10, 17);
    const p = {
      ...empty(),
      completed: {
        late: { best: 1, times: 1, last: dayKey(day(2026, 10, 1)), box: 2 },
        soon: { best: 1, times: 1, last: dayKey(now), box: 2 },
        far: { best: 1, times: 1, last: dayKey(now), box: 5 },
      },
    };
    const f = reviewForecast(p, 7, now);
    expect(f[0].lessons).toEqual(['late']);
    expect(f[2].lessons).toEqual(['soon']);
    expect(f.flatMap((d) => d.lessons)).not.toContain('far');
  });

  it('counts days to the exam', () => {
    expect(daysUntil('2026-11-08', day(2026, 10, 17, 23))).toBe(22);
    expect(daysUntil('2026-10-16', day(2026, 10, 17))).toBe(-1);
    expect(daysUntil('', day(2026, 10, 17))).toBeUndefined();
  });

  it('splits accuracy by question format', () => {
    let p = empty();
    p = withAttempt(p, attempt('a', true, { kind: 'tap' }));
    p = withAttempt(p, attempt('a', false, { kind: 'tap' }));
    p = withAttempt(p, attempt('a', true, { kind: 'pick' }));
    const byKind = Object.fromEntries(accuracyByKind(p).map((k) => [k.kind, k]));
    expect(byKind.tap).toMatchObject({ tries: 2, right: 1 });
    expect(byKind.pick).toMatchObject({ tries: 1, right: 1 });
    expect(byKind.choice).toMatchObject({ tries: 0, right: 0 });
  });
});
