/**
 * The study board (kanban): cards move from "A estudar" to "Dominado". Cards linked to a
 * lesson follow the learner's real progress: finishing the lesson moves them along, and a
 * lesson that comes due for review moves back to "Revisar".
 */
import { LESSON_BY_ID, LESSONS } from '../course/course.ts';
import { type Progress, dueLessons } from '../app/store.ts';
import { masteryOf } from './progress.ts';

export type ColumnId = 'todo' | 'doing' | 'review' | 'done';

export const COLUMNS: Array<{ id: ColumnId; title: string; hint: string; limit?: number }> = [
  { id: 'todo', title: 'A estudar', hint: 'O que vem pela frente.' },
  { id: 'doing', title: 'Estudando', hint: 'Foco: até três de cada vez.', limit: 3 },
  { id: 'review', title: 'Revisar', hint: 'Lições que voltam na revisão espaçada.' },
  { id: 'done', title: 'Dominado', hint: 'Seguro por enquanto.' },
];

export const COLUMN_TITLE = Object.fromEntries(COLUMNS.map((c) => [c.id, c.title])) as Record<ColumnId, string>;

export type CardColor = 'none' | 'magenta' | 'cobalt' | 'green' | 'amber';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface BoardCard {
  id: string;
  title: string;
  notes: string;
  /** A course lesson this card stands for; it then moves with the lesson's progress. */
  lessonId?: string;
  /** YYYY-MM-DD. */
  due?: string;
  color: CardColor;
  checklist: ChecklistItem[];
  createdAt: number;
}

export interface Board {
  columns: Record<ColumnId, string[]>;
  cards: Record<string, BoardCard>;
}

export const emptyBoard = (): Board => ({ columns: { todo: [], doing: [], review: [], done: [] }, cards: {} });

export function columnOf(board: Board, id: string): ColumnId | undefined {
  return (Object.keys(board.columns) as ColumnId[]).find((c) => board.columns[c].includes(id));
}

export function cardForLesson(board: Board, lessonId: string): BoardCard | undefined {
  return Object.values(board.cards).find((c) => c.lessonId === lessonId);
}

export function newCard(id: string, fields: Partial<BoardCard> & { title: string }, now = Date.now()): BoardCard {
  return { notes: '', color: 'none', checklist: [], createdAt: now, ...fields, id };
}

export function addCard(board: Board, column: ColumnId, card: BoardCard, index = Infinity): Board {
  const list = [...board.columns[column]];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, card.id);
  return { columns: { ...board.columns, [column]: list }, cards: { ...board.cards, [card.id]: card } };
}

export function updateCard(board: Board, id: string, patch: Partial<Omit<BoardCard, 'id'>>): Board {
  const card = board.cards[id];
  if (!card) return board;
  return { ...board, cards: { ...board.cards, [id]: { ...card, ...patch } } };
}

export function removeCard(board: Board, id: string): Board {
  const cards = { ...board.cards };
  delete cards[id];
  const columns = Object.fromEntries(Object.entries(board.columns).map(([c, ids]) => [c, ids.filter((x) => x !== id)])) as Board['columns'];
  return { columns, cards };
}

/** Moves a card to `index` of column `to`, where `index` counts the column without the card. */
export function moveCard(board: Board, id: string, to: ColumnId, index = Infinity): Board {
  if (!board.cards[id]) return board;
  const columns = Object.fromEntries(Object.entries(board.columns).map(([c, ids]) => [c, ids.filter((x) => x !== id)])) as Board['columns'];
  const list = columns[to];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, id);
  return { ...board, columns };
}

export interface BoardMove {
  id: string;
  title: string;
  from: ColumnId;
  to: ColumnId;
}

/**
 * Moves lesson cards to match progress. After practising (`practised` lists the lessons),
 * those cards go to "Dominado" when the lesson is strong and to "Revisar" otherwise, and a
 * lesson left half-way goes to "Estudando". On any visit, a lesson that has come due for
 * review leaves "Dominado". Cards the learner placed are otherwise left alone.
 */
export function syncBoard(board: Board, p: Progress, now = new Date(), practised?: string[]): { board: Board; moves: BoardMove[] } {
  const moves: BoardMove[] = [];
  let next = board;
  for (const card of Object.values(board.cards)) {
    if (!card.lessonId) continue;
    const from = columnOf(next, card.id);
    if (!from) continue;
    const m = masteryOf(p, card.lessonId, now);
    let to: ColumnId = from;
    if (practised?.includes(card.lessonId)) {
      if (m.completed) to = (m.dueIn ?? 0) > 0 && m.level === 'forte' ? 'done' : 'review';
      else if (m.evidence > 0 && from === 'todo') to = 'doing';
    } else if (from === 'done' && m.completed && (m.dueIn ?? 0) <= 0) {
      to = 'review';
    }
    if (to !== from) {
      next = moveCard(next, card.id, to, 0);
      moves.push({ id: card.id, title: card.title, from, to });
    }
  }
  return { board: next, moves };
}

/**
 * Fills the board from the course: lessons due for review go to "Revisar", the next
 * lessons to "A estudar". Lessons that already have a card are skipped.
 */
export function seedFromCourse(board: Board, p: Progress, makeId: () => string, now = new Date(), upcoming = 4): Board {
  let next = board;
  const has = (lessonId: string) => !!cardForLesson(next, lessonId);
  const card = (lessonId: string) =>
    newCard(makeId(), { title: LESSON_BY_ID[lessonId].title, notes: LESSON_BY_ID[lessonId].summary, lessonId }, now.getTime());
  for (const due of dueLessons(p, now)) {
    if (LESSON_BY_ID[due.id] && !has(due.id)) next = addCard(next, 'review', card(due.id));
  }
  const ahead = LESSONS.filter((l) => l.generate && !p.completed[l.id] && !has(l.id)).slice(0, upcoming);
  for (const l of ahead) next = addCard(next, 'todo', card(l.id));
  return next;
}
