/**
 * Mixed review sessions: a few fresh questions from each lesson that is due, interleaved
 * so that consecutive questions come from different lessons (retrieval + interleaving).
 */
import { LESSON_BY_ID } from './course.ts';
import type { Rng } from './random.ts';
import type { Exercise } from './types.ts';

export interface ReviewItem {
  lessonId: string;
  exercise: Exercise;
}

/** At most this many lessons per session, so a review stays around ten questions. */
export const MAX_REVIEW_LESSONS = 4;

export function buildReview(rng: Rng, lessonIds: string[], target = 10): ReviewItem[] {
  const ids = lessonIds.filter((id) => LESSON_BY_ID[id]?.generate).slice(0, MAX_REVIEW_LESSONS);
  if (!ids.length) return [];
  const perLesson = Math.min(5, Math.max(2, Math.ceil(target / ids.length)));
  const stacks = ids.map((id) => LESSON_BY_ID[id].generate!(rng).slice(0, perLesson).map((exercise) => ({ lessonId: id, exercise })));
  const out: ReviewItem[] = [];
  for (let round = 0; round < perLesson; round++) {
    for (const stack of rng.shuffle(stacks)) if (stack[round]) out.push(stack[round]);
  }
  return out;
}
