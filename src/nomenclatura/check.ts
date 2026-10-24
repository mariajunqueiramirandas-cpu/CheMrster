/**
 * Checking a typed name. What counts is the IUPAC name; how it is typed does not: accents,
 * capitals, hyphens and spaces are ignored, the charge can go as ferro(III), ferro (III) or
 * ferro III, and locants as 2,2-dimetil or 2, 2 - dimetil. A traditional or everyday name of the
 * same compound is not an answer: it gets a nudge toward the IUPAC name instead, and the player
 * tries again.
 */
import type { Compound } from './catalog.ts';

/**
 * A name reduced to what matters: "Sulfato de Ferro (III)" and "sulfato de ferro iii" match, and
 * so do "2,2-dimetilpropano" and "2, 2 dimetil propano". Only a comma between two locants stays.
 */
export function normalize(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/\(\s*([ivx]+)\s*\)/g, ' $1 ')
      // Whatever separates two locants becomes one comma; every other separator goes.
      .replace(/(\d)[^\p{L}\p{N}]+(?=\d)/gu, '$1\u0001')
      .replace(/[^\p{L}\p{N}\u0001]/gu, '')
      .replace(/\u0001/g, ',')
      // di-hidrogeno is also written diidrogeno; ciclo-hexano and metil-hexano, cicloexano and metilexano.
      .replace(/dihidrogeno/g, 'diidrogeno')
      .replace(/([a-z])h(ex|ept)/g, '$1$2')
  );
}

export type Check =
  /** Nothing typed. */
  | { kind: 'empty' }
  /** Another name of this compound: try again with the IUPAC one. */
  | { kind: 'other'; note: string }
  | { kind: 'right' }
  | { kind: 'wrong' };

export function check(compound: Compound, typed: string): Check {
  const t = normalize(typed);
  if (!t) return { kind: 'empty' };
  if (compound.names.some((n) => normalize(n) === t)) return { kind: 'right' };
  if (compound.traditional.some((n) => normalize(n) === t)) {
    return { kind: 'other', note: 'Esse é o nome tradicional. O desafio pede o nome IUPAC: tente de novo.' };
  }
  if (compound.common.some((n) => normalize(n) === t)) {
    const kind = compound.category === 'organico' ? 'usual' : 'popular';
    return { kind: 'other', note: `Esse é o nome ${kind}. O desafio pede o nome IUPAC: tente de novo.` };
  }
  return { kind: 'wrong' };
}
