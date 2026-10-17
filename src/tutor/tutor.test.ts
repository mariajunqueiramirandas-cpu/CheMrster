import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { Progress } from '../app/store.ts';
import { learnerSnapshot, messageContext } from './context.ts';
import { type TurnCallbacks, describeError, runTurn } from './engine.ts';
import { sanitizeAssistant, toApiMessages } from './history.ts';
import { parseMarkup, plainText, trimPartial } from './markup.ts';
import { findMolecule, offlineReply, searchTheory } from './offline.ts';
import { systemPrompt } from './prompt.ts';
import { TOOL_DEFS, ToolInputError, analyze, makeExercise, react, validateToolInput } from './tools.ts';
import type { Part, Turn } from './types.ts';

const empty = (): Progress => ({ xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] });

describe('markup', () => {
  it('parses paragraphs, lists, bold, lesson links and structures', () => {
    const blocks = parseMarkup(
      'O **etanol** é um álcool.\n\n<mol smiles="CCO" nome="etanol"/>\n\n- primário\n- saturado\n\n1. um\n2. dois\n\nPratique: [[licao:oxigenadas]]',
    );
    expect(blocks.map((b) => b.type)).toEqual(['p', 'mol', 'ul', 'ol', 'p']);
    expect(blocks[0]).toEqual({
      type: 'p',
      inline: [
        { type: 'text', text: 'O ' },
        { type: 'bold', text: 'etanol' },
        { type: 'text', text: ' é um álcool.' },
      ],
    });
    expect(blocks[1]).toEqual({ type: 'mol', smiles: 'CCO', name: 'etanol' });
    expect(blocks[4]).toMatchObject({ inline: [{ type: 'text', text: 'Pratique: ' }, { type: 'lesson', id: 'oxigenadas' }] });
  });

  it('keeps SMILES with slashes and brackets intact', () => {
    expect(parseMarkup('<mol smiles="C/C=C\\C"/>')[0]).toEqual({ type: 'mol', smiles: 'C/C=C\\C', name: undefined });
    expect(parseMarkup("<mol smiles='[O-][N+](=O)c1ccccc1' />")[0]).toMatchObject({ smiles: '[O-][N+](=O)c1ccccc1' });
  });

  it('hides half-written tags while streaming', () => {
    expect(trimPartial('Veja: <mol smiles="CC')).toBe('Veja: ');
    expect(trimPartial('Veja: <mo')).toBe('Veja: ');
    expect(trimPartial('Pratique [[licao:adi')).toBe('Pratique ');
    expect(trimPartial('um **termo')).toBe('um termo');
    expect(trimPartial('um **termo** pronto')).toBe('um **termo** pronto');
    expect(parseMarkup('Texto <mol smiles="CC', { streaming: true })).toHaveLength(1);
  });

  it('flattens to plain text', () => {
    expect(plainText('### Título\nO **etanol** <mol smiles="CCO" nome="etanol"/> e [[licao:quiral]]')).toBe('Título\nO etanol etanol e quiral');
  });
});

describe('tools', () => {
  it('declares input schemas the API accepts', () => {
    for (const t of TOOL_DEFS) {
      expect(t.input_schema.type).toBe('object');
      expect(t.description!.length).toBeGreaterThan(40);
    }
    expect(new Set(TOOL_DEFS.map((t) => t.name)).size).toBe(TOOL_DEFS.length);
  });

  it('validates inputs before anything runs', () => {
    expect(validateToolInput('analisar_molecula', { smiles: 'CCO' })).toEqual({ name: 'analisar_molecula', smiles: 'CCO' });
    expect(() => validateToolInput('analisar_molecula', {})).toThrow(ToolInputError);
    expect(() => validateToolInput('propor_exercicio', { licao: 'inexistente' })).toThrow(ToolInputError);
    expect(() => validateToolInput('nada', {})).toThrow(ToolInputError);
    const map = validateToolInput('salvar_no_mapa', {
      cartoes: [{ titulo: 'Álcool', texto: 'OH em carbono saturado' }, { titulo: 'Etanol', texto: '' }],
      ligacoes: [{ de: 1, para: 0, rotulo: 'é um' }, { de: 0, para: 0 }, { de: 0, para: 9 }],
    });
    expect(map).toMatchObject({ ligacoes: [{ de: 1, para: 0, rotulo: 'é um' }] });
    const tasks = validateToolInput('planejar_tarefas', { tarefas: [{ titulo: 'Revisar', prazo: 'amanhã', coluna: 'review' }] });
    expect(tasks).toMatchObject({ tarefas: [{ titulo: 'Revisar', coluna: 'review', prazo: undefined }] });
  });

  it('answers from the chemistry engine', () => {
    const aspirin = analyze('CC(=O)Oc1ccccc1C(=O)O');
    expect(aspirin.formula_molecular).toBe('C₉H₈O₄');
    expect(aspirin.funcoes).toEqual(expect.arrayContaining(['éster', 'ácido carboxílico']));
    expect(aspirin.cadeia.aromatica).toBe(true);
    const propene = react('C=CC', 'HBr');
    expect(propene.reacoes?.[0].produto).toBe('CC(C)Br');
    expect(react('CCO', 'nitration').aplicavel).toBe(false);
    expect(() => analyze('C1CC')).toThrow();
  });

  it('makes a question in the requested format', () => {
    const ex = makeExercise('quiral', 'tap', 7)!;
    expect(ex.kind).toBe('tap');
    expect(makeExercise('adicao', undefined, 3)).toBeDefined();
    expect(makeExercise('nada', undefined, 3)).toBeUndefined();
  });
});

describe('prompt and context', () => {
  it('carries the whole course and stays stable', () => {
    const s = systemPrompt();
    expect(s).toContain('[id: adicao]');
    expect(s).toContain('Markovnikov');
    expect(s).toBe(systemPrompt());
    // Big enough to cache, small enough to stay cheap.
    expect(s.length).toBeGreaterThan(20_000);
    expect(s.length).toBeLessThan(120_000);
  });

  it('summarises the learner', () => {
    const snap = learnerSnapshot(empty(), { name: 'Ana', dailyGoal: 20, examDate: '2026-11-08' }, new Date(2026, 9, 17));
    expect(snap).toContain('Nome: Ana.');
    expect(snap).toContain('daqui a 22 dias');
    expect(snap).toContain('Próxima lição da trilha: Quatro ligações');
    expect(messageContext(snap, { kind: 'molecule', smiles: 'CCO' })).toMatch(/<tela>\nEstrutura aberta no editor: CCO\.\n<\/tela>$/);
  });
});

describe('history', () => {
  it('replays tutor turns exactly and drops a declined attempt before a fallback', () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 'a' },
      { type: 'text', text: 'Parte ', citations: null },
      { type: 'tool_use', id: 't0', name: 'reagir', input: {} },
      { type: 'fallback', from: { model: 'x' }, to: { model: 'y' } },
      { type: 'thinking', thinking: '', signature: 'b' },
      { type: 'text', text: 'final', citations: null },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(sanitizeAssistant(content).map((b) => b.type)).toEqual(['text', 'thinking', 'text']);

    const turns: Turn[] = [
      { role: 'user', id: 'u1', at: 0, text: 'Oi', context: '<aluno>x</aluno>' },
      { role: 'assistant', id: 'a1', at: 0, status: 'done', mode: 'ai', parts: [], api: [{ role: 'assistant', content: [{ type: 'text', text: 'Olá' }] }] },
      { role: 'user', id: 'u2', at: 0, text: 'E aí?' },
      { role: 'assistant', id: 'a2', at: 0, status: 'done', mode: 'offline', parts: [{ type: 'text', text: 'Resposta offline' }] },
      { role: 'assistant', id: 'a3', at: 0, status: 'error', mode: 'ai', parts: [{ type: 'notice', tone: 'error', text: 'falhou' }] },
      // A declined message is not sent again.
      { role: 'user', id: 'u3', at: 0, text: 'pedido recusado', refused: true },
      { role: 'assistant', id: 'a4', at: 0, status: 'done', mode: 'ai', parts: [{ type: 'notice', tone: 'info', text: 'recusado' }] },
    ];
    const api = toApiMessages(turns);
    expect(api).toHaveLength(4);
    expect(api[0]).toEqual({ role: 'user', content: [{ type: 'text', text: '<aluno>x</aluno>' }, { type: 'text', text: 'Oi' }] });
    expect(api[3]).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Resposta offline' }] });
  });
});

describe('offline tutor', () => {
  const deps = {
    exercise: (lessonId: string): Part => ({ type: 'exercise', id: 'x', lessonId, exercise: makeExercise(lessonId, undefined, 1)! }),
    plan: (): Part => ({ type: 'saved', id: 's', target: 'board', ids: ['a'], summary: '1 cartão no quadro' }),
  };

  it('finds the theory behind a question', () => {
    expect(searchTheory('o que é carbono quiral?')[0].lessonId).toBe('quiral');
    expect(searchTheory('regra de markovnikov')[0].lessonId).toBe('adicao');
    expect(searchTheory('saponificação do sabão')[0].lessonId).toBe('lipidios');
  });

  it('recognises molecules by name or SMILES', () => {
    expect(findMolecule('me fala da aspirina')?.name).toBe('Ácido acetilsalicílico');
    expect(findMolecule('analisa a acetona')?.smiles).toBe('CC(C)=O');
    expect(findMolecule('e o CC(=O)O?')?.smiles).toBe('CC(=O)O');
    expect(findMolecule('OLA tudo bem')).toBeUndefined();
  });

  it('explains a missed question with its key and theory', () => {
    const exercise = makeExercise('adicao', 'choice', 5)!;
    if (exercise.kind !== 'choice') throw new Error('expected a choice question');
    const wrong = (exercise.answer + 1) % exercise.options.length;
    const [reply] = offlineReply(
      { text: 'Por que errei?', screen: { kind: 'question', lessonId: 'adicao', exercise, chosen: wrong, correct: false }, progress: empty() },
      deps,
    );
    expect(reply.type === 'text' && reply.text).toContain(exercise.options[exercise.answer]);
    expect(reply.type === 'text' && reply.text).toContain('[[licao:adicao]]');
  });

  it('answers practice, plan, molecule and theory requests', () => {
    expect(offlineReply({ text: 'me testa em isomeria geométrica', progress: empty() }, deps).map((p) => p.type)).toEqual(['text', 'exercise']);
    expect(offlineReply({ text: 'monta um plano de estudos', progress: empty() }, deps).some((p) => p.type === 'saved')).toBe(true);
    const mol = offlineReply({ text: 'analisa o etanol', progress: empty() }, deps)[0];
    expect(mol.type === 'text' && mol.text).toContain('C₂H₆O');
    const theory = offlineReply({ text: 'como funciona a esterificação?', progress: empty() }, deps)[0];
    expect(theory.type === 'text' && theory.text).toContain('[[licao:esterificacao]]');
    expect(offlineReply({ text: 'qual o melhor time de futebol?', progress: empty() }, deps).at(-1)).toMatchObject({ type: 'notice' });
  });
});

// ---------------------------------------------------------------------------
// The engine against the real SDK, with the API replaced by canned SSE streams.

type Event = Record<string, unknown> & { type: string };

function sse(events: Event[]): Response {
  const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}

const start = (id: string): Event => ({
  type: 'message_start',
  message: { id, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } },
});
const textBlock = (index: number, text: string): Event[] => [
  { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
  { type: 'content_block_stop', index },
];
const toolBlock = (index: number, id: string, name: string, json: string): Event[] => [
  { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {} } },
  { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json } },
  { type: 'content_block_stop', index },
];
const end = (stop: string): Event[] => [
  { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } },
  { type: 'message_stop' },
];

function fakeApi(responses: Event[][]) {
  const requests: Array<{ body: Record<string, unknown>; headers: Headers }> = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({ body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return sse(next);
  });
  const client = new Anthropic({ apiKey: 'test', fetch: fetch as unknown as typeof globalThis.fetch, maxRetries: 0 });
  return { client, requests };
}

function recorder() {
  const log: string[] = [];
  let text = '';
  const callbacks: TurnCallbacks = {
    onStepStart: () => log.push('step'),
    onText: (d) => (text += d),
    onToolStart: (_id, name) => log.push(`start:${name}`),
    onToolEnd: (_id, name, o) => log.push(`end:${name}${o.isError ? ':error' : ''}`),
    onDiscardStep: () => log.push('discard'),
  };
  return { callbacks, log, text: () => text };
}

const userMessage = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Analise o etanol' }] }];

describe('tutor engine', () => {
  it('streams a reply with prompt caching, fallbacks and eager tool streaming', async () => {
    const { client, requests } = fakeApi([[start('m1'), ...textBlock(0, 'Olá!'), ...end('end_turn')]]);
    const r = recorder();
    const result = await runTurn({ client, model: 'claude-opus-5-5', messages: userMessage, runTool: () => ({ content: '' }), callbacks: r.callbacks });
    expect(result.stop).toBe('end');
    expect(r.text()).toBe('Olá!');
    expect(result.api).toEqual([{ role: 'assistant', content: [expect.objectContaining({ type: 'text', text: 'Olá!' })] }]);
    const { body, headers } = requests[0];
    expect(body).toMatchObject({ model: 'claude-opus-5-5', stream: true, fallbacks: 'default', cache_control: { type: 'ephemeral' }, output_config: { effort: 'medium' } });
    expect((body.tools as Array<{ eager_input_streaming?: boolean }>).every((t) => t.eager_input_streaming)).toBe(true);
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('leaves fallbacks off for Haiku', async () => {
    const { client, requests } = fakeApi([[start('m1'), ...textBlock(0, 'Oi'), ...end('end_turn')]]);
    await runTurn({ client, model: 'claude-haiku-5-5', messages: userMessage, runTool: () => ({ content: '' }), callbacks: recorder().callbacks });
    expect(requests[0].body.fallbacks).toBeUndefined();
  });

  it('runs tools, returns every result together, and continues', async () => {
    const { client, requests } = fakeApi([
      [
        start('m1'),
        ...textBlock(0, 'Vou analisar. '),
        ...toolBlock(1, 'tu1', 'analisar_molecula', '{"smiles": "CCO"}'),
        ...toolBlock(2, 'tu2', 'analisar_molecula', '{}'),
        ...end('tool_use'),
      ],
      [start('m2'), ...textBlock(0, 'É um álcool.'), ...end('end_turn')],
    ]);
    const r = recorder();
    const seen: unknown[] = [];
    const result = await runTurn({
      client,
      model: 'claude-opus-5-5',
      messages: userMessage,
      runTool: (input) => {
        seen.push(input);
        return { content: JSON.stringify(analyze((input as { smiles: string }).smiles)) };
      },
      callbacks: r.callbacks,
    });
    expect(result.stop).toBe('end');
    expect(seen).toEqual([{ name: 'analisar_molecula', smiles: 'CCO' }]);
    // Tools run in parallel, so they may finish in any order.
    expect(r.log.slice(0, 3)).toEqual(['step', 'start:analisar_molecula', 'start:analisar_molecula']);
    expect(r.log.slice(3, 5).sort()).toEqual(['end:analisar_molecula', 'end:analisar_molecula:error']);
    expect(r.log[5]).toBe('step');
    expect(result.api.map((m) => m.role)).toEqual(['assistant', 'user', 'assistant']);
    const second = requests[1].body.messages as Array<{ role: string; content: Array<Record<string, unknown>> }>;
    const results = second[2].content;
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu1' });
    expect(results[1]).toMatchObject({ type: 'tool_result', tool_use_id: 'tu2', is_error: true });
    expect(String(results[1].content)).toContain('INVALID_JSON');
    expect(r.text()).toBe('Vou analisar. É um álcool.');
  });

  it('never runs a tool cut off by max_tokens', async () => {
    const { client } = fakeApi([[start('m1'), ...toolBlock(0, 'tu1', 'salvar_no_mapa', '{"cartoes": [{"titulo": "A"'), ...end('max_tokens')]]);
    const runTool = vi.fn(() => ({ content: '' }));
    const result = await runTurn({ client, model: 'claude-opus-5-5', messages: userMessage, runTool, callbacks: recorder().callbacks });
    expect(result.stop).toBe('max_tokens');
    expect(runTool).not.toHaveBeenCalled();
    expect(result.api).toEqual([]);
  });

  it('discards a refused reply', async () => {
    const { client } = fakeApi([[start('m1'), ...textBlock(0, 'Parcial'), ...end('refusal')]]);
    const r = recorder();
    const result = await runTurn({ client, model: 'claude-opus-5-5', messages: userMessage, runTool: () => ({ content: '' }), callbacks: r.callbacks });
    expect(result).toEqual({ api: [], stop: 'refusal' });
    expect(r.log).toContain('discard');
  });

  it('explains API errors in the learner’s language', () => {
    const headers = new Headers();
    expect(describeError(new Anthropic.AuthenticationError(401, undefined, 'bad key', headers)).action).toBe('settings');
    expect(describeError(new Anthropic.RateLimitError(429, undefined, 'slow down', headers)).action).toBe('retry');
    expect(describeError(new Error('x')).text).toContain('x');
    const noKey = { type: 'error', error: { type: 'proxy_not_configured', message: 'sem chave' } };
    expect(describeError(Anthropic.APIError.generate(503, noKey, 'sem chave', headers)).action).toBe('settings');
    expect(describeError(Anthropic.APIError.generate(529, { type: 'error', error: { type: 'overloaded_error' } }, 'overloaded', headers)).action).toBe('retry');
  });
});
