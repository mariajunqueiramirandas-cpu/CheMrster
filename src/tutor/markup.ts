/**
 * The tutor writes a small markup: paragraphs, "- " and "1. " lists, ### headings,
 * **bold**, `code`, [[licao:id]] links to lessons and <mol smiles="…" nome="…"/> for a
 * structure to draw. Text that is still streaming may end in half a tag; it stays hidden
 * until the tag is complete.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'lesson'; id: string };

export type Block =
  | { type: 'p'; inline: Inline[] }
  | { type: 'h'; inline: Inline[] }
  | { type: 'ul' | 'ol'; items: Inline[][] }
  | { type: 'mol'; smiles: string; name?: string };

const MOL = /<mol\b([^>]*?)\/?>(?:\s*<\/mol>)?/g;
const ATTR = /(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*'([^']*)'/g;

/** Drops a tag or link cut off at the end of a streaming text, and an unclosed **. */
export function trimPartial(text: string): string {
  let out = text.replace(/<(?:m(?:o(?:l[^>]*)?)?)?$/, '').replace(/\[\[[^\]]*\]?$/, '');
  if ((out.match(/\*\*/g)?.length ?? 0) % 2 === 1) {
    const at = out.lastIndexOf('**');
    out = out.slice(0, at) + out.slice(at + 2);
  }
  return out;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[\[licao:([\w-]+)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: 'bold', text: m[1] });
    else if (m[2] !== undefined) out.push({ type: 'code', text: m[2] });
    else out.push({ type: 'lesson', id: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

function attrs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (let m = ATTR.exec(source); m; m = ATTR.exec(source)) out[(m[1] ?? m[3]).toLowerCase()] = m[2] ?? m[4];
  ATTR.lastIndex = 0;
  return out;
}

function textBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: Inline[][] } | null = null;
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', inline: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (!line) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', inline: parseInline(heading[1].replace(/\*\*/g, '')) });
    } else if (bullet || numbered) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else if (list && /^\s{2,}/.test(raw)) {
      // A wrapped list item.
      const items: Inline[][] = list.items;
      items[items.length - 1].push({ type: 'text', text: ` ${line}` });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export function parseMarkup(source: string, { streaming = false } = {}): Block[] {
  const text = streaming ? trimPartial(source) : source;
  const blocks: Block[] = [];
  let last = 0;
  for (let m = MOL.exec(text); m; m = MOL.exec(text)) {
    blocks.push(...textBlocks(text.slice(last, m.index)));
    const a = attrs(m[1]);
    if (a.smiles) blocks.push({ type: 'mol', smiles: a.smiles, name: a.nome ?? a.name });
    last = m.index + m[0].length;
  }
  MOL.lastIndex = 0;
  blocks.push(...textBlocks(text.slice(last)));
  return blocks;
}

/** The markup as plain text, for a card title or a screen reader. */
export function plainText(source: string): string {
  return source
    .replace(MOL, (_, a: string) => attrs(a).nome ?? attrs(a).name ?? '')
    .replace(/\[\[licao:([\w-]+)\]\]/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
