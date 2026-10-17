/** Checking an answer, shared by the exercise player and the tutor's inline questions. */
import type { Exercise } from './types.ts';

export type Answer = number | number[] | null;

export function hasAnswer(answer: Answer): boolean {
  return Array.isArray(answer) ? answer.length > 0 : answer !== null;
}

export function isCorrect(ex: Exercise, answer: Answer): boolean {
  if (ex.kind === 'tap') {
    const picked = [...((answer as number[]) ?? [])].sort((a, b) => a - b);
    return picked.length === ex.answer.length && picked.every((a, i) => a === ex.answer[i]);
  }
  return answer === ex.answer;
}

/** How the learner's answer reads in a sentence: "“cis”", "a estrutura 2", "os átomos 3 e 5". */
export function answerLabel(ex: Exercise, answer: number | number[]): string {
  if (ex.kind === 'choice' && typeof answer === 'number') return `“${ex.options[answer]}”`;
  if (ex.kind === 'pick' && typeof answer === 'number') return `a estrutura ${answer + 1}`;
  const atoms = Array.isArray(answer) ? answer.map((a) => a + 1) : [answer];
  return atoms.length === 1 ? `o átomo ${atoms[0]}` : `os átomos ${atoms.slice(0, -1).join(', ')} e ${atoms.at(-1)}`;
}
