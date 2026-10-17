/** The study board as the app keeps it, and the moves it makes on its own. */
import { LESSON_BY_ID } from '../course/course.ts';
import {
  type Board,
  type BoardCard,
  COLUMN_TITLE,
  type ColumnId,
  addCard,
  cardForLesson,
  emptyBoard,
  newCard,
  removeCard,
  seedFromCourse,
  syncBoard,
} from '../study/board.ts';
import type { TaskInput } from '../tutor/tools.ts';
import { persisted, uid, usePersisted } from './persist.ts';
import { href } from './router.ts';
import { progressStore } from './store.ts';
import { toast } from './toast.ts';

export const boardStore = persisted<Board>('chemrster:board:v1', (stored) => {
  const base = emptyBoard();
  if (!stored || typeof stored !== 'object') return base;
  const b = stored as Partial<Board>;
  return { columns: { ...base.columns, ...b.columns }, cards: b.cards ?? {} };
});

export const useBoard = () => usePersisted(boardStore);

export const editBoard = (fn: (b: Board) => Board) => boardStore.set(fn);

export function createCard(column: ColumnId, fields: Partial<BoardCard> & { title: string }, index?: number): string {
  const card = newCard(uid('k'), fields);
  boardStore.set((b) => addCard(b, column, card, index));
  return card.id;
}

/** After a lesson or review: lesson cards follow the result, with a note of what moved. */
export function syncAfterPractice(lessons: string[]) {
  const { board, moves } = syncBoard(boardStore.get(), progressStore.get(), new Date(), lessons);
  if (!moves.length) return;
  boardStore.set(board);
  const [first] = moves;
  toast(
    moves.length === 1 ? `“${first.title}” foi para ${COLUMN_TITLE[first.to]} no quadro` : `${moves.length} cartões andaram no quadro`,
    { label: 'Ver quadro', href: href({ name: 'board' }) },
  );
}

/** Opening the board: lessons due for review leave "Dominado". */
export function syncOnVisit(): number {
  const { board, moves } = syncBoard(boardStore.get(), progressStore.get());
  if (moves.length) boardStore.set(board);
  return moves.length;
}

/** Due reviews and the next lessons, as cards. Returns the ids added. */
export function seedBoard(): string[] {
  const before = new Set(Object.keys(boardStore.get().cards));
  boardStore.set((b) => seedFromCourse(b, progressStore.get(), () => uid('k')));
  return Object.keys(boardStore.get().cards).filter((id) => !before.has(id));
}

/** Tasks the tutor planned. A task for a lesson that already has a card updates nothing and is skipped. */
export function addTasks(tasks: TaskInput[]): string[] {
  const ids: string[] = [];
  boardStore.set((b) => {
    let next = b;
    for (const t of tasks) {
      if (t.licao && cardForLesson(next, t.licao)) continue;
      const card = newCard(uid('k'), {
        title: t.titulo,
        notes: t.notas ?? (t.licao ? LESSON_BY_ID[t.licao]?.summary : '') ?? '',
        lessonId: t.licao,
        due: t.prazo,
      });
      next = addCard(next, t.coluna, card);
      ids.push(card.id);
    }
    return next;
  });
  return ids;
}

export function removeCards(ids: string[]) {
  boardStore.set((b) => ids.reduce(removeCard, b));
}
