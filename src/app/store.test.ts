import { describe, expect, it } from 'vitest';
import { type Progress, daysSince, dayKey, dueLessons, nextBox, nextReviewIn } from './store.ts';

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const progress = (completed: Progress['completed']): Progress => ({ xp: 0, completed, streak: { count: 0, last: null }, days: {}, log: [] });

describe('spaced review', () => {
  it('moves lessons between Leitner boxes', () => {
    expect(nextBox(undefined, 1)).toBe(1);
    expect(nextBox(1, 0.9)).toBe(2);
    expect(nextBox(4, 1)).toBe(5);
    expect(nextBox(5, 1)).toBe(5);
    expect(nextBox(3, 0.7)).toBe(3);
    expect(nextBox(4, 0.4)).toBe(1);
  });

  it('counts calendar days', () => {
    expect(daysSince(dayKey(day(2026, 10, 15, 23)), day(2026, 10, 16, 0))).toBe(1);
    expect(daysSince(dayKey(day(2026, 10, 1)), day(2026, 10, 17))).toBe(16);
    expect(daysSince(dayKey(day(2026, 12, 31)), day(2027, 1, 2))).toBe(2);
  });

  it('brings lessons back after 1, 2, 4, 8 and 16 days', () => {
    const now = day(2026, 10, 17);
    const p = progress({
      a: { best: 1, times: 1, last: dayKey(day(2026, 10, 16)), box: 1 }, // 1 day, box 1: due
      b: { best: 1, times: 2, last: dayKey(day(2026, 10, 16)), box: 2 }, // needs 2 days
      c: { best: 0.5, times: 1, last: dayKey(day(2026, 10, 10)), box: 3 }, // 7 of 4 days: overdue
      d: { best: 1, times: 1, last: dayKey(now), box: 1 }, // practised today
      e: { best: 0.9, times: 1 }, // saved before reviews existed
    });
    const due = dueLessons(p, now).map((x) => x.id);
    expect(due).toEqual(['e', 'c', 'a']);
    expect(nextReviewIn(progress({ b: p.completed.b }), now)).toBe(1);
    expect(nextReviewIn(progress({}), now)).toBeUndefined();
  });

  it('ranks ties by the weaker lesson', () => {
    const now = day(2026, 10, 17);
    const last = dayKey(day(2026, 10, 16));
    const p = progress({
      strong: { best: 1, times: 1, last, box: 1 },
      weak: { best: 0.6, times: 1, last, box: 1 },
    });
    expect(dueLessons(p, now).map((x) => x.id)).toEqual(['weak', 'strong']);
  });
});
