import { beforeEach, describe, expect, it, vi } from 'vitest';
import { columnOf, emptyBoard } from '../study/board.ts';
import { edgesOf, emptyCanvas, intersects, nodesOf } from '../study/canvas.ts';
import { addTasks, boardStore, createCard, syncAfterPractice } from './board-store.ts';
import { addCluster, canvasStore, editCanvas, redoCanvas, saveToMap, undoCanvas } from './canvas-store.ts';
import { exportAll, importAll } from './persist.ts';
import { settingsStore, updateSettings } from './settings.ts';
import { progressStore, recordLesson } from './store.ts';
import { answerExercise, ask, connectionOf, tutorStore } from './tutor-store.ts';
import type { TutorTurn } from '../tutor/types.ts';

beforeEach(() => {
  canvasStore.set(emptyCanvas('m'));
  boardStore.set(emptyBoard());
  progressStore.set({ xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] });
  tutorStore.set({ threads: {}, order: [] });
});

describe('concept map store', () => {
  it('saves cards from anywhere without stacking them', () => {
    const a = saveToMap({ kind: 'note', title: 'Álcool', text: '–OH em carbono saturado' }, { quiet: true });
    const b = saveToMap({ kind: 'molecule', title: 'Etanol', smiles: 'CCO' }, { quiet: true });
    const { nodes } = canvasStore.get();
    expect(intersects(nodes[a], nodes[b])).toBe(false);
  });

  it('hangs a tutor cluster off the card it grew from, and undoes it', () => {
    const anchor = saveToMap({ kind: 'note', title: 'Funções' }, { quiet: true });
    const ids = addCluster(
      [
        { titulo: 'Oxigenadas', texto: 'Com O' },
        { titulo: 'Álcool', texto: '–OH', smiles: 'CCO' },
        { titulo: 'Cetona', texto: 'C=O entre carbonos', smiles: 'CC(C)=O' },
      ],
      [{ de: 0, para: 1, rotulo: 'inclui' }],
      anchor,
    );
    const c = canvasStore.get();
    expect(ids).toHaveLength(3);
    const nodes = nodesOf(c);
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) expect(intersects(nodes[i], nodes[j])).toBe(false);
    expect(edgesOf(c).map((e) => [e.from, e.to, e.label])).toEqual([
      [ids[0], ids[1], 'inclui'],
      [anchor, ids[0], ''],
    ]);
    undoCanvas();
    expect(nodesOf(canvasStore.get()).map((n) => n.id)).toEqual([anchor]);
    redoCanvas();
    expect(nodesOf(canvasStore.get())).toHaveLength(4);
  });
});

describe('board store', () => {
  it('skips tutor tasks for lessons already on the board', () => {
    createCard('todo', { title: 'Adição', lessonId: 'adicao' });
    const ids = addTasks([
      { titulo: 'Adição de novo', licao: 'adicao', coluna: 'todo' },
      { titulo: 'Simulado de sábado', coluna: 'doing', prazo: '2026-10-24' },
    ]);
    expect(ids).toHaveLength(1);
    const b = boardStore.get();
    expect(b.cards[ids[0]]).toMatchObject({ title: 'Simulado de sábado', due: '2026-10-24' });
    expect(columnOf(b, ids[0])).toBe('doing');
  });

  it('moves a lesson card after the lesson is done', () => {
    const id = createCard('todo', { title: 'Adição', lessonId: 'adicao' });
    for (let i = 0; i < 8; i++) progressStore.set((p) => ({ ...p, log: [...p.log, { t: Date.now(), lesson: 'adicao', kind: 'choice', ok: true, ms: 1000, source: 'lesson' }] }));
    recordLesson('adicao', 1, 15);
    syncAfterPractice(['adicao']);
    expect(columnOf(boardStore.get(), id)).toBe('done');
  });
});

describe('tutor store', () => {
  it('prefers the learner’s key, then the server, then offline', () => {
    expect(connectionOf(' sk-ant-1 ', true)).toEqual({ kind: 'key', apiKey: 'sk-ant-1' });
    expect(connectionOf('', true)).toEqual({ kind: 'server' });
    expect(connectionOf('', false)).toEqual({ kind: 'offline' });
    expect(connectionOf('', undefined)).toEqual({ kind: 'offline' });
  });

  it('answers offline, takes an answer to its question, and logs it', async () => {
    // No server here: the status check fails and the offline tutor answers.
    const thread = ask({ text: 'me testa em isomeria geométrica' })!;
    await vi.waitFor(() => expect(tutorStore.get().threads[thread].turns).toHaveLength(2), { timeout: 3000 });
    const reply = tutorStore.get().threads[thread].turns[1] as TutorTurn;
    expect(reply.mode).toBe('offline');
    const part = reply.parts.find((p) => p.type === 'exercise');
    if (part?.type !== 'exercise') throw new Error('expected a question');

    answerExercise(thread, reply.id, part.id, part.exercise.answer);
    await vi.waitFor(() => expect(tutorStore.get().threads[thread].turns).toHaveLength(4), { timeout: 3000 });
    const turns = tutorStore.get().threads[thread].turns;
    expect(turns[2]).toMatchObject({ role: 'user', text: expect.stringContaining('acertei') });
    expect((turns[1] as TutorTurn).parts.find((p) => p.type === 'exercise')).toMatchObject({ correct: true });
    const log = progressStore.get().log;
    expect(log.at(-1)).toMatchObject({ source: 'tutor', lesson: 'geometrica', ok: true });
    expect(progressStore.get().xp).toBe(2);
  });
});

describe('backup', () => {
  it('exports everything and restores it', () => {
    saveToMap({ kind: 'note', title: 'Guardar' }, { quiet: true });
    createCard('todo', { title: 'Estudar' });
    const doc = JSON.parse(JSON.stringify(exportAll()));
    canvasStore.set(emptyCanvas('x'));
    boardStore.set(emptyBoard());
    expect(importAll(doc)).toBeGreaterThanOrEqual(4);
    expect(Object.values(canvasStore.get().nodes).map((n) => n.title)).toEqual(['Guardar']);
    expect(Object.values(boardStore.get().cards).map((c) => c.title)).toEqual(['Estudar']);
    expect(() => importAll({ app: 'outro' })).toThrow();
  });

  it('never carries the API key, and keeps this device’s key on restore', () => {
    updateSettings({ apiKey: 'sk-ant-secret', name: 'Ana' });
    const doc = JSON.parse(JSON.stringify(exportAll()));
    expect(JSON.stringify(doc)).not.toContain('sk-ant-secret');
    updateSettings({ apiKey: 'sk-ant-other', name: 'Bia' });
    importAll(doc);
    expect(settingsStore.get()).toMatchObject({ apiKey: 'sk-ant-other', name: 'Ana' });
  });

  it('starts the map’s undo history over after a restore', () => {
    const doc = JSON.parse(JSON.stringify(exportAll()));
    editCanvas((c) => ({ ...c, nodes: {} }));
    saveToMap({ kind: 'note', title: 'Depois' }, { quiet: true });
    importAll(doc);
    undoCanvas();
    expect(Object.values(canvasStore.get().nodes).map((n) => n.title)).toEqual(Object.values(doc.data['chemrster:canvas:v1'].nodes).map((n) => (n as { title: string }).title));
  });
});
