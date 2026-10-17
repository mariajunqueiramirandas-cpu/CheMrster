/**
 * The tutor inside the app: conversations (saved), the reply being streamed (in memory),
 * the side panel, and the bridge between the tutor's tools and the learner's map, board
 * and progress. Without an API connection the offline tutor answers instead.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { answerLabel, isCorrect } from '../course/answers.ts';
import { LESSON_BY_ID } from '../course/course.ts';
import type { Exercise } from '../course/types.ts';
import { type ScreenContext, learnerSnapshot, messageContext } from '../tutor/context.ts';
import type { ToolRunner } from '../tutor/engine.ts';
import { titleFrom, toApiMessages } from '../tutor/history.ts';
import { offlineReply } from '../tutor/offline.ts';
import { analyze, describeExercise, makeExercise, react } from '../tutor/tools.ts';
import type { Part, Thread, TutorTurn, UserTurn } from '../tutor/types.ts';
import { addTasks, removeCards, seedBoard } from './board-store.ts';
import { addCluster, removeFromMap } from './canvas-store.ts';
import { memory, persisted, uid, usePersisted } from './persist.ts';
import { settingsStore } from './settings.ts';
import { MAX_STEP_MS, progressStore, recordAttempt } from './store.ts';

interface TutorData {
  threads: Record<string, Thread>;
  /** Most recent first. */
  order: string[];
}

const MAX_THREADS = 40;

export const tutorStore = persisted<TutorData>('chemrster:tutor:v1', (stored) => {
  const d = stored as Partial<TutorData> | undefined;
  if (!d || typeof d !== 'object' || !d.threads) return { threads: {}, order: [] };
  // A reply cut off by a closed tab is finished as it stands.
  const threads = Object.fromEntries(
    Object.entries(d.threads).map(([id, t]) => [
      id,
      { ...t, turns: t.turns.map((turn) => (turn.role === 'assistant' && turn.status === 'streaming' ? { ...turn, status: 'stopped' as const } : turn)) },
    ]),
  );
  return { threads, order: (d.order ?? []).filter((id) => threads[id]) };
});

export const useTutorData = () => usePersisted(tutorStore);

/** Replies being written right now, by conversation, kept out of storage until they are done. */
const live = memory<Record<string, TutorTurn>>({});
export const useLiveTurns = live.use;
const setLive = (threadId: string, turn: TutorTurn | null) =>
  live.set((all) => {
    const next = { ...all };
    if (turn) next[threadId] = turn;
    else delete next[threadId];
    return next;
  });

/** The tutor side panel, over any screen. */
const panel = memory<{ open: boolean; threadId?: string }>({ open: false });
export const useTutorPanel = panel.use;
export const openTutor = (threadId?: string) => panel.set({ open: true, threadId });
export const closeTutor = () => panel.set((p) => ({ ...p, open: false }));
export const showThread = (threadId?: string) => panel.set((p) => ({ ...p, threadId }));

// ---------------------------------------------------------------------------
// Connection

export type Connection = { kind: 'server' } | { kind: 'key'; apiKey: string } | { kind: 'offline' };

const server = memory<boolean | undefined>(undefined);
let checking: Promise<boolean> | undefined;

/** Whether this site's server holds an API key (the proxy in server/anthropic-proxy.ts). */
export function checkServer(): Promise<boolean> {
  checking ??= fetch('/api/anthropic/status', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : { available: false }))
    .then((j: { available?: unknown }) => j.available === true)
    .catch(() => false)
    .then((ok) => {
      server.set(ok);
      return ok;
    });
  return checking;
}

/** The learner's own key wins; otherwise the server's; otherwise the offline tutor. */
export function connectionOf(apiKey: string, serverReady: boolean | undefined): Connection {
  if (apiKey.trim()) return { kind: 'key', apiKey: apiKey.trim() };
  if (serverReady) return { kind: 'server' };
  return { kind: 'offline' };
}

export function useConnection(): Connection & { checked: boolean } {
  const ready = server.use();
  const { apiKey } = usePersisted(settingsStore);
  if (ready === undefined) void checkServer();
  return { ...connectionOf(apiKey, ready), checked: ready !== undefined };
}

/** The SDK is loaded the first time the AI tutor answers, so the app starts without it. */
async function clientFor(c: Exclude<Connection, { kind: 'offline' }>): Promise<Anthropic> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Through the server, the proxy adds the real key; the browser never sees it.
  if (c.kind === 'server') return new Anthropic({ apiKey: 'via-servidor', baseURL: `${location.origin}/api/anthropic`, dangerouslyAllowBrowser: true });
  return new Anthropic({ apiKey: c.apiKey, dangerouslyAllowBrowser: true });
}

// ---------------------------------------------------------------------------
// Threads

function saveThread(thread: Thread) {
  tutorStore.set((d) => {
    const order = [thread.id, ...d.order.filter((id) => id !== thread.id)];
    const threads = { ...d.threads, [thread.id]: thread };
    for (const old of order.slice(MAX_THREADS)) delete threads[old];
    return { threads, order: order.slice(0, MAX_THREADS) };
  });
}

function patchThread(id: string, fn: (t: Thread) => Thread) {
  const t = tutorStore.get().threads[id];
  if (t) tutorStore.set((d) => ({ ...d, threads: { ...d.threads, [id]: fn(t) } }));
}

export function deleteThread(id: string) {
  tutorStore.set((d) => {
    const threads = { ...d.threads };
    delete threads[id];
    return { threads, order: d.order.filter((x) => x !== id) };
  });
  if (panel.get().threadId === id) showThread(undefined);
}

export const isBusy = (threadId?: string) => !!threadId && !!live.get()[threadId];

export interface AskOptions {
  text: string;
  /** What is on screen: the question, the theory card, the molecule. */
  screen?: ScreenContext;
  /** Short line above the message ("Sobre a questão de Adição"). */
  about?: string;
  /** Continue this conversation; without it, a new one starts. */
  thread?: string;
  /** Open the side panel on the conversation. */
  open?: boolean;
}

/** Sends a message to the tutor and starts the reply. Returns the conversation's id. */
export function ask({ text, screen, about, thread: threadId, open }: AskOptions): string | undefined {
  if (isBusy(threadId)) return threadId;
  const s = settingsStore.get();
  const snapshot = learnerSnapshot(progressStore.get(), { name: s.name, examDate: s.examDate, dailyGoal: s.dailyGoal });
  const turn: UserTurn = { role: 'user', id: uid('u'), at: Date.now(), text: text.trim(), context: messageContext(snapshot, screen), screen, about };
  const existing = threadId ? tutorStore.get().threads[threadId] : undefined;
  const now = Date.now();
  const thread: Thread = existing
    ? { ...existing, updatedAt: now, turns: [...existing.turns, turn] }
    : { id: uid('t'), title: titleFrom(about ?? text), createdAt: now, updatedAt: now, turns: [turn] };
  saveThread(thread);
  if (open) openTutor(thread.id);
  else if (panel.get().open) showThread(thread.id);
  void respond(thread.id);
  return thread.id;
}

const controllers = new Map<string, AbortController>();

export function stopReply(threadId: string) {
  controllers.get(threadId)?.abort();
}

/** Tries the last reply again, after an error. */
export function retry(threadId: string) {
  const t = tutorStore.get().threads[threadId];
  const last = t?.turns.at(-1);
  if (!t || isBusy(threadId) || last?.role !== 'assistant') return;
  patchThread(threadId, (th) => ({ ...th, turns: th.turns.slice(0, -1) }));
  void respond(threadId);
}

function commit(threadId: string, turn: TutorTurn) {
  setLive(threadId, null);
  controllers.delete(threadId);
  patchThread(threadId, (t) => ({ ...t, updatedAt: Date.now(), turns: [...t.turns, turn] }));
}

// ---------------------------------------------------------------------------
// Tools, bound to the app

function exercisePart(lessonId: string, kind?: Exercise['kind']): Extract<Part, { type: 'exercise' }> | undefined {
  const exercise = makeExercise(lessonId, kind, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  return exercise ? { type: 'exercise', id: uid('x'), lessonId, exercise } : undefined;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function toolRunner(anchorNode?: string): ToolRunner {
  return (input) => {
    switch (input.name) {
      case 'analisar_molecula': {
        try {
          const a = analyze(input.smiles);
          return { content: JSON.stringify(a), detail: a.formula_molecular };
        } catch (err) {
          return { content: JSON.stringify({ erro: `SMILES inválido: ${err instanceof Error ? err.message : err}` }), isError: true, detail: 'SMILES inválido' };
        }
      }
      case 'reagir': {
        try {
          const r = react(input.smiles, input.reacao);
          return { content: JSON.stringify(r), detail: r.reacoes?.map((x) => x.nome).join(', ') || 'nenhuma reação' };
        } catch (err) {
          return { content: JSON.stringify({ erro: `SMILES inválido: ${err instanceof Error ? err.message : err}` }), isError: true, detail: 'SMILES inválido' };
        }
      }
      case 'propor_exercicio': {
        const part = exercisePart(input.licao, input.formato);
        if (!part) return { content: JSON.stringify({ erro: 'Não foi possível gerar uma questão desta lição.' }), isError: true };
        return {
          content: JSON.stringify({ mostrada_ao_aluno: true, ...describeExercise(part.exercise), proximo_passo: 'Convide o aluno a responder em uma frase, sem revelar o gabarito.' }),
          part,
          detail: LESSON_BY_ID[input.licao].title,
        };
      }
      case 'salvar_no_mapa': {
        const ids = addCluster(input.cartoes, input.ligacoes, anchorNode);
        const summary = `${plural(ids.length, 'cartão', 'cartões')} no mapa`;
        return { content: JSON.stringify({ ok: true, cartoes_criados: ids.length }), part: { type: 'saved', id: uid('s'), target: 'map', ids, summary }, detail: summary };
      }
      case 'planejar_tarefas': {
        const ids = addTasks(input.tarefas);
        const skipped = input.tarefas.length - ids.length;
        const summary = `${plural(ids.length, 'tarefa', 'tarefas')} no quadro`;
        return {
          content: JSON.stringify({ ok: true, tarefas_criadas: ids.length, ja_existiam: skipped }),
          part: { type: 'saved', id: uid('s'), target: 'board', ids, summary },
          detail: summary,
        };
      }
    }
  };
}

const STOP_NOTICE = {
  refusal: 'O tutor não pode responder a esse pedido. Reformule a pergunta com foco no conteúdo de química.',
  max_tokens: 'A resposta ficou longa demais e foi cortada. Peça para continuar ou para resumir.',
  steps: 'O tutor usou muitas ferramentas seguidas e parou. Peça para continuar.',
} as const;

async function respond(threadId: string) {
  const thread = tutorStore.get().threads[threadId];
  const user = [...(thread?.turns ?? [])].reverse().find((t): t is UserTurn => t.role === 'user');
  if (!thread || !user) return;
  const s = settingsStore.get();
  const connection = connectionOf(s.apiKey, server.get() ?? (await checkServer()));
  const turn: TutorTurn = { role: 'assistant', id: uid('a'), at: Date.now(), parts: [], status: 'streaming', mode: connection.kind === 'offline' ? 'offline' : 'ai' };
  setLive(threadId, turn);

  if (connection.kind === 'offline') {
    const parts = offlineReply(
      { text: user.text, screen: user.screen, progress: progressStore.get() },
      {
        exercise: exercisePart,
        plan: () => {
          const ids = seedBoard();
          return ids.length ? { type: 'saved', id: uid('s'), target: 'board', ids, summary: `${plural(ids.length, 'lição', 'lições')} no quadro` } : undefined;
        },
      },
    );
    // A beat, so the answer reads as a reply rather than a page swap.
    await new Promise((r) => setTimeout(r, 350));
    commit(threadId, { ...turn, parts, status: 'done' });
    return;
  }

  const controller = new AbortController();
  controllers.set(threadId, controller);
  const parts: Part[] = [];
  let mark = { length: 0, text: '' };
  let frame = 0;
  const flush = () => {
    frame = 0;
    if (live.get()[threadId]) setLive(threadId, { ...turn, parts: parts.map((p) => ({ ...p })) });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(flush);
  };
  const anchor = user.screen?.kind === 'map-card' ? user.screen.nodeId : undefined;
  const { runTurn, describeError } = await import('../tutor/engine.ts');

  try {
    const result = await runTurn({
      client: await clientFor(connection),
      model: s.model,
      messages: toApiMessages(thread.turns),
      runTool: toolRunner(anchor),
      signal: controller.signal,
      callbacks: {
        onStepStart() {
          const last = parts.at(-1);
          mark = { length: parts.length, text: last?.type === 'text' ? last.text : '' };
        },
        onText(delta) {
          const last = parts.at(-1);
          if (last?.type === 'text') last.text += delta;
          else parts.push({ type: 'text', text: delta });
          schedule();
        },
        onToolStart(id, name) {
          parts.push({ type: 'tool', id, name, status: 'running' });
          schedule();
        },
        onToolEnd(id, _name, outcome) {
          const chip = parts.find((p) => p.type === 'tool' && p.id === id);
          if (chip?.type === 'tool') Object.assign(chip, { status: outcome.isError ? 'error' : 'done', detail: outcome.detail });
          if (outcome.part) parts.push(outcome.part);
          schedule();
        },
        onDiscardStep() {
          parts.length = mark.length;
          const last = parts.at(-1);
          if (last?.type === 'text') last.text = mark.text;
          schedule();
        },
      },
    });
    if (result.stop !== 'end') parts.push({ type: 'notice', tone: 'info', text: STOP_NOTICE[result.stop] });
    cancelAnimationFrame(frame);
    commit(threadId, { ...turn, parts, api: result.api, status: 'done' });
  } catch (err) {
    cancelAnimationFrame(frame);
    if (controller.signal.aborted) {
      commit(threadId, { ...turn, parts, status: 'stopped' });
      return;
    }
    const { text, action } = describeError(err);
    parts.push({ type: 'notice', tone: 'error', text, action });
    commit(threadId, { ...turn, parts, status: 'error' });
  }
}

// ---------------------------------------------------------------------------
// Acting on a reply

function findPart(threadId: string, turnId: string, partId: string) {
  const turn = tutorStore.get().threads[threadId]?.turns.find((t) => t.id === turnId);
  if (turn?.role !== 'assistant') return undefined;
  return { turn, part: turn.parts.find((p) => 'id' in p && p.id === partId) };
}

function patchPart(threadId: string, turnId: string, partId: string, patch: Partial<Part>) {
  patchThread(threadId, (t) => ({
    ...t,
    turns: t.turns.map((turn) =>
      turn.id === turnId && turn.role === 'assistant'
        ? { ...turn, parts: turn.parts.map((p) => ('id' in p && p.id === partId ? ({ ...p, ...patch } as Part) : p)) }
        : turn,
    ),
  }));
}

/** XP for a question answered right in the chat. */
export const TUTOR_XP = 2;

/** The learner answered a question the tutor put in the chat: log it, then tell the tutor. */
export function answerExercise(threadId: string, turnId: string, partId: string, answer: number | number[]) {
  const found = findPart(threadId, turnId, partId);
  const part = found?.part;
  if (!found || part?.type !== 'exercise' || part.answer !== undefined || isBusy(threadId)) return;
  const correct = isCorrect(part.exercise, answer);
  patchPart(threadId, turnId, partId, { answer, correct });
  recordAttempt({ lesson: part.lessonId, kind: part.exercise.kind, ok: correct, ms: Math.min(MAX_STEP_MS, Date.now() - found.turn.at), source: 'tutor' }, correct ? TUTOR_XP : 0);
  ask({
    thread: threadId,
    text: `Respondi ${answerLabel(part.exercise, answer)} e ${correct ? 'acertei' : 'errei'}.`,
    screen: { kind: 'question', lessonId: part.lessonId, exercise: part.exercise, chosen: answer, correct },
  });
}

/** Takes back the cards or tasks a reply created. */
export function undoSaved(threadId: string, turnId: string, partId: string) {
  const part = findPart(threadId, turnId, partId)?.part;
  if (part?.type !== 'saved' || part.undone) return;
  if (part.target === 'map') removeFromMap(part.ids);
  else removeCards(part.ids);
  patchPart(threadId, turnId, partId, { undone: true });
}
