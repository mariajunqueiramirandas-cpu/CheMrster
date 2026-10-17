import { describe, expect, it } from 'vitest';
import { depict } from '../nanquim/index.ts';
import { LESSONS } from './course.ts';
import { createRng } from './random.ts';

describe('lesson generators', () => {
  for (const lesson of LESSONS.filter((l) => l.generate)) {
    it(`builds valid exercises for "${lesson.title}"`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const exercises = lesson.generate!(createRng(seed));
        expect(exercises).toHaveLength(8);
        for (const ex of exercises) {
          expect(ex.prompt.length).toBeGreaterThan(5);
          expect(ex.explain.length).toBeGreaterThan(5);
          if (ex.kind === 'choice') {
            expect(ex.answer, ex.prompt).toBeGreaterThanOrEqual(0);
            expect(new Set(ex.options).size, ex.prompt).toBe(ex.options.length);
            expect(ex.options.length).toBeGreaterThanOrEqual(2);
          } else if (ex.kind === 'pick') {
            expect(ex.answer).toBeGreaterThanOrEqual(0);
            expect(new Set(ex.options.map((o) => o.smiles + o.formula)).size, ex.prompt).toBe(ex.options.length);
          } else {
            expect(ex.answer.length, ex.prompt).toBeGreaterThan(0);
            const tappable = ex.tappable ?? ex.answer;
            for (const a of ex.answer) expect(tappable).toContain(a);
          }
          const specs = ex.kind === 'pick' ? [...ex.options, ...(ex.molecule ? [ex.molecule] : [])] : ex.molecule ? [ex.molecule] : [];
          for (const spec of specs) expect(() => depict(spec.smiles, { formula: spec.formula })).not.toThrow();
        }
      }
    });
  }

  it('is reproducible from a seed', () => {
    const lesson = LESSONS[0];
    expect(lesson.generate!(createRng(7))).toEqual(lesson.generate!(createRng(7)));
  });
});
