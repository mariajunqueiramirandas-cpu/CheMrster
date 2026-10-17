import { describe, expect, it } from 'vitest';
import { createRng } from './random.ts';
import { MAX_REVIEW_LESSONS, buildReview } from './review.ts';

describe('review sessions', () => {
  it('mixes questions from every due lesson', () => {
    const items = buildReview(createRng(3), ['adicao', 'quiral', 'polimeros']);
    expect(items.length).toBeGreaterThanOrEqual(9);
    expect(new Set(items.map((i) => i.lessonId))).toEqual(new Set(['adicao', 'quiral', 'polimeros']));
    // Interleaved: the first round visits each lesson once.
    expect(new Set(items.slice(0, 3).map((i) => i.lessonId)).size).toBe(3);
  });

  it('stays short however much is due', () => {
    const ids = ['tetravalencia', 'tres-formulas', 'classes-de-carbono', 'saturacao', 'quiral', 'adicao'];
    const items = buildReview(createRng(1), ids);
    expect(new Set(items.map((i) => i.lessonId)).size).toBe(MAX_REVIEW_LESSONS);
    expect(items.length).toBeLessThanOrEqual(12);
  });

  it('gives a single lesson enough questions', () => {
    expect(buildReview(createRng(5), ['esterificacao'])).toHaveLength(5);
    expect(buildReview(createRng(5), ['nao-existe'])).toEqual([]);
  });
});
