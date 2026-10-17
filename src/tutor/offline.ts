/**
 * The tutor without a connection to the Claude API: it answers from the course itself.
 * A missed question gets its key, explanation and the theory card behind it; a structure
 * gets the engine's analysis; "me teste" gets a fresh question; anything else is matched
 * against the theory cards.
 */
import { FUNCTION_INFO, type FunctionId } from '../chem/analysis.ts';
import { LESSON_BY_ID, LESSONS } from '../course/course.ts';
import { THEORY } from '../course/theory/index.ts';
import type { Exercise, TheoryCard } from '../course/types.ts';
import { MOLECULES } from '../content/molecules.ts';
import type { Progress } from '../app/store.ts';
import { masteryAll, nextLesson, weakSpots } from '../study/progress.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';
import type { ScreenContext } from './context.ts';
import { analyze, react } from './tools.ts';
import type { Part } from './types.ts';

export interface OfflineDeps {
  /** A practice question from a lesson, as a chat part. */
  exercise(lessonId: string, kind?: Exercise['kind']): Part | undefined;
  /** Puts due reviews and the next lessons on the board; undefined when nothing was added. */
  plan(): Part | undefined;
}

// ---------------------------------------------------------------------------
// Text matching

const STOP = new Set(
  'que qual quais para por com sem uma umas uns dos das nos nas num numa como mais menos muito pouco isso esse essa este esta aqui ali ser sao esta estao tem ter pode podem sobre entre qual quando onde porque pois tambem ainda voce voces meu minha seu sua ele ela eles elas nao sim the and fazer faz feito explique explica explicar entender entendi duvida ajuda ajude quero queria favor'.split(
    ' ',
  ),
);

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');

/**
 * Crude Portuguese stems: the first five letters ("oxidação", "oxidar" → "oxida"), plus the
 * first eight of long words, so "esterificação" also matches more tightly than "éster".
 */
export function stems(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .flatMap((w) => (w.length >= 9 ? [w.slice(0, 5), `${w.slice(0, 8)}+`] : [w.slice(0, 5)]));
}

interface Doc {
  lessonId: string;
  index: number;
  card: TheoryCard;
  weights: Map<string, number>;
}

let docs: Doc[] | undefined;
let idf: Map<string, number> | undefined;

function index() {
  if (docs && idf) return { docs, idf };
  docs = [];
  for (const lesson of LESSONS) {
    (THEORY[lesson.id] ?? []).forEach((card, i) => {
      const weights = new Map<string, number>();
      const add = (text: string, w: number) => {
        for (const s of stems(text)) weights.set(s, (weights.get(s) ?? 0) + w);
      };
      add(card.title, 3);
      add(lesson.title, 2);
      add(card.body.join(' '), 1);
      add(card.tip ?? '', 1);
      add((card.molecules ?? []).map((m) => m.label ?? '').join(' '), 0.5);
      docs!.push({ lessonId: lesson.id, index: i, card, weights });
    });
  }
  const df = new Map<string, number>();
  for (const d of docs) for (const s of d.weights.keys()) df.set(s, (df.get(s) ?? 0) + 1);
  idf = new Map([...df].map(([s, n]) => [s, Math.log(1 + docs!.length / n)]));
  return { docs, idf };
}

/** Theory cards that best match a question, best first. */
export function searchTheory(query: string, limit = 3, onlyLesson?: string): Array<{ lessonId: string; index: number; card: TheoryCard; score: number }> {
  const { docs, idf } = index();
  const q = [...new Set(stems(query))];
  if (!q.length) return [];
  return docs
    .filter((d) => !onlyLesson || d.lessonId === onlyLesson)
    .map((d) => ({
      ...d,
      score: q.reduce((s, t) => s + Math.min(3, d.weights.get(t) ?? 0) * (idf.get(t) ?? 0), 0),
    }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Names a gallery molecule answers to: "Propanona (acetona)" is both, and a one-word note ("Aspirina.") too. */
function moleculeKeys(m: (typeof MOLECULES)[number]): string[] {
  const note = m.note && m.note.split(' ').length <= 2 ? m.note : '';
  const keys = `${m.name}(${note})`.split(/[()]/).map((k) => normalize(k).replace(/\s+/g, ' ').trim());
  keys.push(normalize(m.id.replace(/-/g, ' ')).trim());
  return [...new Set(keys.filter((k) => k.length >= 4))];
}

/** A structure named or written in the message: a gallery molecule by name, or a SMILES. */
export function findMolecule(text: string): { smiles: string; name?: string } | undefined {
  const norm = ` ${normalize(text).replace(/\s+/g, ' ')} `;
  let best: { smiles: string; name: string; length: number } | undefined;
  for (const m of MOLECULES) {
    for (const k of moleculeKeys(m)) {
      if (norm.includes(` ${k} `) && (!best || k.length > best.length)) best = { smiles: m.smiles, name: m.name, length: k.length };
    }
  }
  if (best) return { smiles: best.smiles, name: best.name };
  for (const token of text.split(/\s+/)) {
    const t = token.replace(/^[("'“]+|[)"'”.,;:!?]+$/g, '');
    if (t.length < 2 || !/[CNOcno]/.test(t) || !/^[A-Za-z0-9@+\-[\]()=#$/\\%.*]+$/.test(t)) continue;
    // A word in capitals ("OLA") is not a structure; SMILES have bonds, rings or branches, or are all-element.
    if (!/[=#()[\]0-9@/\\]/.test(t) && !/^(?:C|O|N|S|Cl|Br|F|I|c|o|n)+$/.test(t)) continue;
    try {
      const mol = moleculeFromSmiles(t);
      if (mol.atoms.length >= 2) return { smiles: t };
    } catch {
      // Not a SMILES.
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Replies

const text = (t: string): Part => ({ type: 'text', text: t });

function cardMarkup(lessonId: string, card: TheoryCard, { molecules = true } = {}): string {
  const parts = [`**${card.title}**`, ...card.body];
  if (molecules) for (const m of (card.molecules ?? []).slice(0, 2)) parts.push(`<mol smiles="${m.smiles}" nome="${m.label ?? m.name ?? ''}"/>`);
  if (card.tip) parts.push(`No ENEM: ${card.tip}`);
  parts.push(`[[licao:${lessonId}]]`);
  return parts.join('\n\n');
}

function correctText(ex: Exercise): string {
  if (ex.kind === 'choice') return `A resposta certa é **${ex.options[ex.answer]}**.`;
  if (ex.kind === 'pick') return `A estrutura certa é esta:\n\n<mol smiles="${ex.options[ex.answer].smiles}"/>`;
  return 'Os átomos certos ficaram marcados na questão.';
}

/** The theory card of a lesson closest to a question's wording. */
function cardFor(lessonId: string, query: string): { card: TheoryCard; index: number } | undefined {
  const hit = searchTheory(query, 1, lessonId)[0];
  if (hit) return { card: hit.card, index: hit.index };
  const first = THEORY[lessonId]?.[0];
  return first ? { card: first, index: 0 } : undefined;
}

function lessonForFunction(id: FunctionId): string {
  return ['amida', 'amina', 'nitrila', 'nitrocomposto', 'haleto orgânico'].includes(id) ? 'nitrogenadas' : 'oxigenadas';
}

function moleculeReply(smiles: string, name?: string): string {
  const a = analyze(smiles);
  const title = name ?? 'Esta estrutura';
  const chain = [
    a.cadeia.aberta ? 'aberta' : a.cadeia.aromatica ? 'fechada, aromática' : 'fechada',
    a.cadeia.ramificada ? 'ramificada' : 'normal',
    a.cadeia.insaturada ? 'insaturada' : 'saturada',
    a.cadeia.heterogenea ? 'heterogênea' : 'homogênea',
  ].join(', ');
  const lines = [
    `**${title}**: ${a.formula_molecular}${a.massa_molar_g_mol ? `, ${a.massa_molar_g_mol.toLocaleString('pt-BR')} g/mol` : ''}.`,
    `<mol smiles="${smiles}" nome="${name ?? ''}"/>`,
    [
      `- Cadeia: ${chain}.`,
      `- Funções: ${a.funcoes.length ? a.funcoes.map((f) => `${f} (${FUNCTION_INFO[f as FunctionId]?.group ?? ''})`).join(', ') : 'nenhuma, só C e H'}.`,
      `- Carbonos: ${a.carbonos.primarios} primários, ${a.carbonos.secundarios} secundários, ${a.carbonos.terciarios} terciários, ${a.carbonos.quaternarios} quaternários.`,
      `- Carbonos quirais: ${a.carbonos_quirais}${a.duplas_com_isomeria_cis_trans ? `; duplas com isomeria cis-trans: ${a.duplas_com_isomeria_cis_trans}` : ''}.`,
    ].join('\n'),
  ];
  const reactions = react(smiles).reacoes ?? [];
  if (reactions.length) lines.push(`Reações que o laboratório calcula para ela: ${reactions.map((r) => r.nome.toLowerCase()).join(', ')}. Abra em Estruturas para ver os produtos.`);
  const links = new Set<string>();
  for (const f of a.funcoes) links.add(lessonForFunction(f as FunctionId));
  if (a.carbonos_quirais) links.add('quiral');
  if (a.duplas_com_isomeria_cis_trans) links.add('geometrica');
  if (links.size) lines.push([...links].slice(0, 3).map((id) => `[[licao:${id}]]`).join(' '));
  return lines.join('\n\n');
}

const WANTS_PRACTICE = /\b(exerc|questa|quest|teste|testa|treina|pratic|quiz|simulad|pergunt[ae] (algo|uma))/;
const WANTS_PLAN = /\b(plano|planej|cronograma|organiz|rotina|agenda|semana de estudo|o que (devo|eu devo) estudar|por onde come)/;
const GREETING = /^\s*(oi|ola|bom dia|boa tarde|boa noite|e ai|hey|hello)\b/;

/** Which lesson a practice request is about: the best theory match, else the weakest or next lesson. */
function practiceLesson(query: string, p: Progress): string | undefined {
  const hit = searchTheory(query, 1)[0];
  if (hit && LESSON_BY_ID[hit.lessonId]?.generate && hit.score > 2) return hit.lessonId;
  const weak = weakSpots(masteryAll(p))[0];
  return weak?.id ?? nextLesson(p)?.id ?? LESSONS.find((l) => l.generate)?.id;
}

export function offlineReply(input: { text: string; screen?: ScreenContext; progress: Progress }, deps: OfflineDeps): Part[] {
  const { screen, progress } = input;
  const q = normalize(input.text);

  // A question on screen: explain the miss, or give a nudge before answering.
  if (screen?.kind === 'question') {
    const ex = screen.exercise;
    const found = cardFor(screen.lessonId, `${ex.prompt} ${ex.explain}`);
    if (screen.chosen === undefined) {
      const tip = found?.card.tip ?? found?.card.body[0];
      return [
        text(
          [
            'Uma pista, sem entregar a resposta:',
            found ? `**${found.card.title}**: ${found.card.body[0]}` : '',
            tip && tip !== found?.card.body[0] ? tip : '',
            ex.molecule ? 'Olhe a estrutura com calma e procure exatamente o que o enunciado pede.' : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      ];
    }
    const parts: string[] = [];
    parts.push(screen.correct ? 'Você acertou. O porquê:' : correctText(ex));
    parts.push(ex.explain);
    if (found) parts.push(`Para fixar, a teoria por trás:\n\n${cardMarkup(screen.lessonId, found.card, { molecules: false })}`);
    return [text(parts.join('\n\n'))];
  }

  if (screen?.kind === 'theory' && !WANTS_PRACTICE.test(q)) {
    const terms = [...screen.card.body.join(' ').matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
    const lines = ['Sem a IA conectada, eu não reescrevo o texto, mas posso destacar o essencial deste cartão:'];
    if (terms.length) lines.push(terms.map((t) => `- **${t}**`).join('\n'));
    if (screen.card.tip) lines.push(`No ENEM: ${screen.card.tip}`);
    const others = (THEORY[screen.lessonId] ?? []).filter((c) => c.title !== screen.card.title).map((c) => c.title);
    if (others.length) lines.push(`A mesma lição também explica: ${others.join('; ')}.`);
    lines.push(`Praticar ajuda a fixar: [[licao:${screen.lessonId}]]`);
    return [text(lines.join('\n\n'))];
  }

  if (screen?.kind === 'molecule' && !WANTS_PRACTICE.test(q)) return [text(moleculeReply(screen.smiles, screen.name))];

  if (WANTS_PLAN.test(q)) {
    const saved = deps.plan();
    const all = masteryAll(progress);
    const weak = weakSpots(all);
    const next = nextLesson(progress);
    const lines = ['Um plano simples, que funciona: **revisões vencidas primeiro**, depois **a próxima lição**, e um **ponto fraco** por dia.'];
    if (next) lines.push(`Próxima lição: [[licao:${next.id}]]`);
    if (weak.length) lines.push(`Para reforçar: ${weak.map((m) => `[[licao:${m.id}]]`).join(' ')}`);
    const parts: Part[] = [text(lines.join('\n\n'))];
    if (saved) parts.push(saved);
    return parts;
  }

  if (WANTS_PRACTICE.test(q)) {
    const lessonId = screen?.kind === 'theory' ? screen.lessonId : practiceLesson(input.text, progress);
    const part = lessonId ? deps.exercise(lessonId) : undefined;
    if (part) return [text(`Uma questão de **${LESSON_BY_ID[lessonId!].title}**. Responda aqui mesmo:`), part];
  }

  const molecule = findMolecule(input.text);
  if (molecule) return [text(moleculeReply(molecule.smiles, molecule.name))];

  const hits = searchTheory(input.text, 2);
  if (hits.length && hits[0].score > 1.5) {
    const [best, second] = hits;
    const lines = [cardMarkup(best.lessonId, best.card)];
    if (second && second.lessonId !== best.lessonId && second.score > best.score * 0.6) lines.push(`Veja também: **${second.card.title}** [[licao:${second.lessonId}]]`);
    return [text(lines.join('\n\n'))];
  }

  return [
    text(
      [
        GREETING.test(q) ? 'Oi! Sou o tutor do CheMrster.' : 'Não encontrei isso na apostila do app.',
        'Sem a IA conectada, eu respondo com o conteúdo das lições. Tente, por exemplo:',
        '- "o que é carbono quiral?"\n- "me explica a regra de Markovnikov"\n- "analisa a aspirina" ou um SMILES como CC(=O)O\n- "me testa em isomeria"\n- "monta um plano de estudos"',
      ].join('\n\n'),
    ),
    { type: 'notice', tone: 'info', text: 'Para conversar livremente com o tutor, conecte a IA em Ajustes.', action: 'settings' },
  ];
}
