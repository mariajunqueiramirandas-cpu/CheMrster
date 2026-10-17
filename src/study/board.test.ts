import { describe, expect, it } from 'vitest';
import { type Attempt, type Progress, dayKey, withAttempt } from '../app/store.ts';
import { addCard, columnOf, emptyBoard, moveCard, newCard, removeCard, seedFromCourse, syncBoard, updateCard } from './board.ts';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const empty = (): Progress => ({ xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] });
const answer = (lesson: string, ok: boolean): Omit<Attempt, 't'> => ({ lesson, kind: 'choice', ok, ms: 10_000, source: 'lesson' });

let n = 0;
const id = () => `c${n++}`;

describe('board', () => {
  it('adds, moves, edits and removes cards', () => {
    let b = emptyBoard();
    b = addCard(b, 'todo', newCard('a', { title: 'Funções' }));
    b = addCard(b, 'todo', newCard('b', { title: 'Isomeria' }));
    b = addCard(b, 'todo', newCard('c', { title: 'Polímeros' }), 0);
    expect(b.columns.todo).toEqual(['c', 'a', 'b']);
    b = moveCard(b, 'c', 'todo', 2);
    expect(b.columns.todo).toEqual(['a', 'b', 'c']);
    b = moveCard(b, 'a', 'doing');
    expect(columnOf(b, 'a')).toBe('doing');
    expect(b.columns.todo).toEqual(['b', 'c']);
    b = updateCard(b, 'a', { notes: 'rever aldeído × cetona' });
    expect(b.cards.a.notes).toBe('rever aldeído × cetona');
    b = removeCard(b, 'a');
    expect(b.cards.a).toBeUndefined();
    expect(b.columns.doing).toEqual([]);
  });

  it('seeds due reviews and the next lessons, once', () => {
    const now = day(2026, 10, 17);
    const p = { ...empty(), completed: { tetravalencia: { best: 1, times: 1, last: dayKey(day(2026, 10, 10)), box: 1 } } };
    let b = seedFromCourse(emptyBoard(), p, id, now, 3);
    expect(b.columns.review.map((c) => b.cards[c].lessonId)).toEqual(['tetravalencia']);
    expect(b.columns.todo.map((c) => b.cards[c].lessonId)).toEqual(['tres-formulas', 'classes-de-carbono', 'aberta-fechada']);
    // Seeding again skips the lessons that have cards and adds the three after them.
    b = seedFromCourse(b, p, id, now, 3);
    expect(Object.keys(b.cards)).toHaveLength(7);
    expect(b.columns.review).toHaveLength(1);
  });

  it('moves lesson cards with the learner', () => {
    const now = day(2026, 10, 17);
    let b = emptyBoard();
    b = addCard(b, 'todo', newCard('strong', { title: 'Adição', lessonId: 'adicao' }));
    b = addCard(b, 'todo', newCard('weak', { title: 'Oxidação', lessonId: 'oxidacao' }));
    b = addCard(b, 'todo', newCard('half', { title: 'Ésteres', lessonId: 'esterificacao' }));
    b = addCard(b, 'todo', newCard('free', { title: 'Simulado' }));
    let p = empty();
    for (let i = 0; i < 8; i++) p = withAttempt(p, answer('adicao', true), now);
    for (let i = 0; i < 8; i++) p = withAttempt(p, answer('oxidacao', i < 4), now);
    p = withAttempt(p, answer('esterificacao', true), now);
    const last = dayKey(now);
    p = { ...p, completed: { adicao: { best: 1, times: 1, last, box: 1 }, oxidacao: { best: 0.5, times: 1, last, box: 1 } } };

    const after = syncBoard(b, p, now, ['adicao', 'oxidacao', 'esterificacao']);
    expect(columnOf(after.board, 'strong')).toBe('done');
    expect(columnOf(after.board, 'weak')).toBe('review');
    expect(columnOf(after.board, 'half')).toBe('doing');
    expect(columnOf(after.board, 'free')).toBe('todo');
    expect(after.moves.map((m) => m.to).sort()).toEqual(['doing', 'done', 'review']);

    // A plain visit leaves cards alone until the lesson is due again.
    expect(syncBoard(after.board, p, now).moves).toEqual([]);
    const later = syncBoard(after.board, p, day(2026, 10, 19));
    expect(later.moves).toEqual([{ id: 'strong', title: 'Adição', from: 'done', to: 'review' }]);
  });
});
