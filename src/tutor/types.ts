/** Conversations with the tutor, as stored and as shown. */
import type Anthropic from '@anthropic-ai/sdk';
import type { Exercise } from '../course/types.ts';
import type { ScreenContext } from './context.ts';
import type { ToolName } from './tools.ts';

export type ApiMessage = Anthropic.Beta.BetaMessageParam;

/** One piece of a tutor reply, in the order it arrived. */
export type Part =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; name: ToolName; status: 'running' | 'done' | 'error'; detail?: string }
  | {
      type: 'exercise';
      id: string;
      lessonId: string;
      exercise: Exercise;
      answer?: number | number[];
      correct?: boolean;
    }
  | { type: 'saved'; id: string; target: 'map' | 'board'; ids: string[]; summary: string; undone?: boolean }
  | { type: 'notice'; tone: 'error' | 'info'; text: string; action?: 'settings' | 'retry' };

export interface UserTurn {
  role: 'user';
  id: string;
  at: number;
  text: string;
  /** The <aluno>/<tela> block sent with the message; never shown, replayed as written. */
  context?: string;
  /** The screen the question came from, for the offline tutor and the "about" line. */
  screen?: ScreenContext;
  /** Short line above the bubble, e.g. "Sobre a questão de Adição". */
  about?: string;
}

export interface TutorTurn {
  role: 'assistant';
  id: string;
  at: number;
  parts: Part[];
  /** The exact API messages of this turn (assistant blocks and tool results), for replay. */
  api?: ApiMessage[];
  status: 'streaming' | 'done' | 'stopped' | 'error';
  mode: 'ai' | 'offline';
}

export type Turn = UserTurn | TutorTurn;

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
}
