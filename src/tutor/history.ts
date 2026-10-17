/** Turning stored turns into the Messages API history, and model output into storable turns. */
import type Anthropic from '@anthropic-ai/sdk';
import type { ApiMessage, Part, Turn } from './types.ts';

type Block = Anthropic.Beta.BetaContentBlock;
type BlockParam = Anthropic.Beta.BetaContentBlockParam;

/** Block types the model produces that are safe to echo as they came. */
const KNOWN = new Set(['text', 'thinking', 'redacted_thinking', 'tool_use']);

/**
 * An assistant message as it must be sent back. After a server-side fallback, the declined
 * attempt's thinking and tool calls (everything before the last `fallback` block except
 * text) are dropped, and so is the marker itself; unknown block types are never echoed.
 */
export function sanitizeAssistant(content: Block[]): BlockParam[] {
  const boundary = content.map((b) => b.type as string).lastIndexOf('fallback');
  return content.filter((b, i) => {
    const type = b.type as string;
    if (type === 'fallback') return false;
    if (i < boundary) return type === 'text';
    return KNOWN.has(type);
  }) as BlockParam[];
}

/** Plain text of a reply, for turns that have no API record (offline answers). */
export function partsText(parts: Part[]): string {
  return parts
    .map((p) => (p.type === 'text' ? p.text : p.type === 'saved' ? `(${p.summary})` : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

/** The history to send: user turns with their stored context, tutor turns replayed exactly. */
export function toApiMessages(turns: Turn[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const turn of turns) {
    if (turn.role === 'user' && turn.refused) continue;
    if (turn.role === 'user') {
      const content: Anthropic.Beta.BetaTextBlockParam[] = [];
      if (turn.context) content.push({ type: 'text', text: turn.context });
      content.push({ type: 'text', text: turn.text || '…' });
      out.push({ role: 'user', content });
    } else if (turn.api?.length) {
      out.push(...turn.api);
    } else if (turn.status !== 'streaming') {
      const text = partsText(turn.parts);
      if (text) out.push({ role: 'assistant', content: [{ type: 'text', text }] });
    }
  }
  return out;
}

/** A short thread title from the first question. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 46).trimEnd()}…` : clean || 'Nova conversa';
}
