/**
 * Checking a typed name. What counts is the IUPAC name; how it is typed does not: accents,
 * capitals, hyphens and extra spaces are ignored, and the charge can go as ferro(III),
 * ferro (III) or ferro III. A traditional or everyday name of the same compound is not an
 * answer: it gets a nudge toward the IUPAC name instead, and the player tries again.
 */
import type { Compound } from './catalog.ts';

/** A name reduced to what matters: "Sulfato de Ferro (III)" and "sulfato de ferro iii" match. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-‐‑‒–—]/g, '')
    .replace(/\(\s*([ivx]+)\s*\)/g, ' $1 ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // di-hidrogeno is also written diidrogeno.
    .replace(/dihidrogeno/g, 'diidrogeno');
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
    return { kind: 'other', note: 'Esse é o nome popular. O desafio pede o nome IUPAC: tente de novo.' };
  }
  return { kind: 'wrong' };
}
