/**
 * One tutor turn against the Claude API: stream the reply, run the tools it calls, feed the
 * results back, and repeat until it answers. Tool inputs stream eagerly, so each one is
 * validated before it runs, and a turn cut off by `max_tokens` or a refusal never runs tools.
 */
import Anthropic from '@anthropic-ai/sdk';
import { sanitizeAssistant } from './history.ts';
import { systemPrompt } from './prompt.ts';
import { STREAMING_TOOL_DEFS, type ToolInput, ToolInputError, type ToolName, validateToolInput } from './tools.ts';
import type { ApiMessage, Part } from './types.ts';

export interface ToolOutcome {
  /** What the model reads back. */
  content: string;
  isError?: boolean;
  /** Something to show in the chat (a question, a "saved" receipt). */
  part?: Part;
  /** A short line for the tool chip. */
  detail?: string;
}

export type ToolRunner = (input: ToolInput, id: string) => Promise<ToolOutcome> | ToolOutcome;

export interface TurnCallbacks {
  /** A model call begins; what it streams can be discarded until it ends. */
  onStepStart(): void;
  onText(delta: string): void;
  onToolStart(id: string, name: ToolName): void;
  onToolEnd(id: string, name: ToolName, outcome: ToolOutcome): void;
  /** The text streamed in the current step is void (a refusal): take it off the screen. */
  onDiscardStep(): void;
}

export type TurnStop = 'end' | 'refusal' | 'max_tokens' | 'steps';

export interface TurnResult {
  /** Messages to append to the history: assistant turns and tool results. */
  api: ApiMessage[];
  stop: TurnStop;
}

export interface TurnOptions {
  client: Anthropic;
  model: string;
  messages: ApiMessage[];
  runTool: ToolRunner;
  callbacks: TurnCallbacks;
  signal?: AbortSignal;
  /** Model calls per turn, tool rounds included. */
  maxSteps?: number;
}

/** Claude Haiku has no server-side fallback; the larger models re-run a declined request on another model. */
const hasFallback = (model: string) => !model.startsWith('claude-haiku');

export function requestParams(model: string, messages: ApiMessage[]): Anthropic.Beta.MessageCreateParamsStreaming {
  return {
    model,
    max_tokens: 32000,
    stream: true,
    system: [{ type: 'text', text: systemPrompt() }],
    tools: STREAMING_TOOL_DEFS,
    messages,
    // Chat answers: enough thought to be right, short enough to feel like a conversation.
    output_config: { effort: 'medium' },
    // Caches system prompt, tools and history up to the last message.
    cache_control: { type: 'ephemeral' },
    ...(hasFallback(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  };
}

async function runOne(
  block: Anthropic.Beta.BetaToolUseBlock,
  runTool: ToolRunner,
  callbacks: TurnCallbacks,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const name = block.name as ToolName;
  callbacks.onToolStart(block.id, name);
  let outcome: ToolOutcome;
  try {
    outcome = await runTool(validateToolInput(block.name, block.input), block.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outcome = {
      content: JSON.stringify(err instanceof ToolInputError ? { INVALID_JSON: JSON.stringify(block.input), erro: message } : { erro: message }),
      isError: true,
    };
  }
  callbacks.onToolEnd(block.id, name, outcome);
  return { type: 'tool_result', tool_use_id: block.id, content: outcome.content, ...(outcome.isError ? { is_error: true } : {}) };
}

export async function runTurn({ client, model, messages, runTool, callbacks, signal, maxSteps = 6 }: TurnOptions): Promise<TurnResult> {
  const added: ApiMessage[] = [];
  let jsonRetries = 0;
  for (let step = 0; step < maxSteps; step++) {
    callbacks.onStepStart();
    const stream = client.beta.messages.stream(requestParams(model, [...messages, ...added]), { signal });
    stream.on('text', (delta) => callbacks.onText(delta));
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // A tool input that is not JSON at all fails the stream: ask again, a couple of times.
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= 2) throw err;
      callbacks.onDiscardStep();
      step--;
      continue;
    }
    if (message.stop_reason === 'refusal') {
      callbacks.onDiscardStep();
      return { api: added, stop: 'refusal' };
    }
    const content = sanitizeAssistant(message.content);
    const uses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    // A tool input cut off by max_tokens can still look valid: never run it.
    if (message.stop_reason === 'max_tokens' && uses.length) return { api: added, stop: 'max_tokens' };
    added.push({ role: 'assistant', content });
    if (message.stop_reason === 'pause_turn') continue;
    if (!uses.length) return { api: added, stop: message.stop_reason === 'max_tokens' ? 'max_tokens' : 'end' };
    const results = await Promise.all(uses.map((u) => runOne(u, runTool, callbacks)));
    // Every result goes back in one message, so the model keeps calling tools in parallel.
    added.push({ role: 'user', content: results });
  }
  return { api: added, stop: 'steps' };
}

/** A message for the learner when a request fails, and whether trying again can help. */
export function describeError(err: unknown): { text: string; action?: 'settings' | 'retry' } {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { text: 'A chave da API não foi aceita. Confira a chave em Ajustes.', action: 'settings' };
  }
  if (err instanceof Anthropic.RateLimitError) return { text: 'Muitas perguntas em pouco tempo. Espere um minuto e tente de novo.', action: 'retry' };
  if (err instanceof Anthropic.APIConnectionError) return { text: 'Sem conexão com o tutor. Verifique a internet e tente de novo.', action: 'retry' };
  if (err instanceof Anthropic.InternalServerError) return { text: 'O tutor está sobrecarregado agora. Tente de novo em instantes.', action: 'retry' };
  if (err instanceof Anthropic.APIError && err.status === 503) {
    return { text: 'O servidor do app não tem uma chave da API configurada. Use a sua chave em Ajustes.', action: 'settings' };
  }
  if (err instanceof Anthropic.BadRequestError) return { text: `A API recusou o pedido: ${err.message}`, action: 'retry' };
  if (err instanceof Anthropic.APIError) return { text: `Erro da API (${err.status ?? 'sem código'}): ${err.message}`, action: 'retry' };
  return { text: `Algo deu errado: ${err instanceof Error ? err.message : String(err)}`, action: 'retry' };
}
