import { describe, expect, it } from 'vitest';
import { canonicalKey } from '../chem/graph.ts';
import { depict } from '../nanquim/index.ts';
import { COURSE, LESSONS } from './course.ts';
import { createRng } from './random.ts';
import type { Exercise, MolSpec } from './types.ts';

function specsOf(ex: Exercise): MolSpec[] {
  const out: MolSpec[] = [];
  if (ex.kind === 'pick') out.push(...ex.options);
  if (ex.molecule) out.push(ex.molecule);
  if (ex.kind !== 'tap' && ex.scheme) {
    for (const t of [...ex.scheme.left, ...ex.scheme.right]) if ('mol' in t) out.push(t.mol);
  }
  return out;
}

describe('course', () => {
  it('numbers lessons by atomic number, with unique ids', () => {
    expect(LESSONS.map((l) => l.element.number)).toEqual(LESSONS.map((_, i) => i + 1));
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(COURSE.every((u) => u.lessons.length > 0)).toBe(true);
  });

  it('has every lesson written, with theory', () => {
    for (const lesson of LESSONS) {
      expect(lesson.generate, lesson.id).toBeDefined();
      expect(lesson.theory?.length, lesson.id).toBeGreaterThan(0);
    }
  });
});

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
            expect(ex.options.length, ex.prompt).toBeGreaterThanOrEqual(2);
          } else if (ex.kind === 'pick') {
            expect(ex.answer).toBeGreaterThanOrEqual(0);
            expect(ex.options.length, ex.prompt).toBeGreaterThanOrEqual(3);
            // Different strings are not enough: two drawings of one substance would both be right.
            const keys = ex.options.map((o) => `${canonicalKey(o.smiles)}|${o.formula ?? ''}`);
            expect(new Set(keys).size, `${ex.prompt} ${ex.options.map((o) => o.smiles).join(' ')}`).toBe(ex.options.length);
          } else {
            expect(ex.answer.length, ex.prompt).toBeGreaterThan(0);
            const tappable = ex.tappable ?? ex.answer;
            for (const a of ex.answer) expect(tappable).toContain(a);
            expect(tappable.length, ex.prompt).toBeGreaterThan(ex.answer.length);
          }
          for (const spec of specsOf(ex)) {
            expect(() => depict(spec.smiles, { formula: spec.formula, polymer: spec.polymer, conventions: 'enem', style: 'enem' }), spec.smiles).not.toThrow();
          }
        }
      }
    });
  }

  it('is reproducible from a seed', () => {
    for (const lesson of LESSONS) {
      expect(lesson.generate!(createRng(7)), lesson.id).toEqual(lesson.generate!(createRng(7)));
    }
  });
});
