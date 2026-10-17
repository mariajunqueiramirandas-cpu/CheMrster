/** Every lesson's theory cards, by lesson id. */
import type { TheoryCard } from '../types.ts';
import { BASICS } from './basics.ts';
import { REACTIONS } from './reactions.ts';

export const THEORY: Record<string, TheoryCard[]> = { ...BASICS, ...REACTIONS };
