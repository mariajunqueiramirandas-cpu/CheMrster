import { describe, expect, it } from 'vitest';
import { depict, moleculeFromSmiles } from '../nanquim/index.ts';
import { LESSON_BY_ID } from './course.ts';
import { THEORY } from './theory/index.ts';
import type { MolSpec, Scheme } from './types.ts';

const draws = (spec: MolSpec) => depict(spec.smiles, { formula: spec.formula, polymer: spec.polymer, conventions: 'enem', style: 'enem' });

const schemeMolecules = (scheme?: Scheme): MolSpec[] =>
  scheme ? [...scheme.left, ...scheme.right].flatMap((t) => ('mol' in t ? [t.mol] : [])) : [];

describe('theory cards', () => {
  for (const [id, cards] of Object.entries(THEORY)) {
    it(`teaches "${id}" with drawable cards`, () => {
      expect(LESSON_BY_ID[id], `unknown lesson ${id}`).toBeDefined();
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.title.trim().length, id).toBeGreaterThan(0);
        expect(card.body.length, card.title).toBeGreaterThan(0);
        for (const p of card.body) expect(p.trim().length, card.title).toBeGreaterThan(0);
        for (const spec of [...(card.molecules ?? []), ...schemeMolecules(card.scheme)]) {
          expect(() => draws(spec), `${card.title}: ${spec.smiles}`).not.toThrow();
          const atoms = moleculeFromSmiles(spec.smiles).atoms.length;
          const marks = 'marks' in spec ? ((spec as { marks?: number[] }).marks ?? []) : [];
          for (const a of [...(spec.highlight ?? []), ...marks]) {
            expect(Number.isInteger(a) && a >= 0 && a < atoms, `${card.title}: atom ${a} of ${spec.smiles}`).toBe(true);
          }
        }
      }
    });
  }
});
