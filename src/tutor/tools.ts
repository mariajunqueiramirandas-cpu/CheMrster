/**
 * The tutor's tools. Facts about a structure come from the same chemistry engine that grades
 * the exercises, so the tutor never has to guess a formula, a function or a product; the
 * other tools act on the learner's study space (a practice question in the chat, cards on
 * the concept map, tasks on the board).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { carbonsByClass, chiralCarbons, classifyChain, functionalGroups, geometricDoubleBonds, molarMass } from '../chem/analysis.ts';
import { toSmiles } from '../chem/graph.ts';
import { LESSON_BY_ID, LESSONS } from '../course/course.ts';
import { subscript } from '../course/kit.ts';
import { labReactions } from '../course/lab.ts';
import { createRng } from '../course/random.ts';
import type { Exercise, Scheme, Term } from '../course/types.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';

export type ToolName = 'analisar_molecula' | 'reagir' | 'propor_exercicio' | 'salvar_no_mapa' | 'planejar_tarefas';

const PLAYABLE = LESSONS.filter((l) => l.generate).map((l) => l.id);
const REACTION_IDS = ['h2', 'Br2', 'HBr', 'H2O', 'polymer', 'ox', 'dehydration', 'ester', 'salt', 'hyd-ácido', 'hyd-básico', 'br-light', 'nitration', 'combustion'];

/** Tool definitions as the Messages API takes them. Kept in a fixed order so the prompt cache holds. */
export const TOOL_DEFS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'analisar_molecula',
    description:
      'Analisa uma estrutura (SMILES) com o motor químico do app, o mesmo que corrige os exercícios: fórmula molecular, massa molar, classificação da cadeia, funções orgânicas, carbonos quirais, duplas com isomeria cis-trans e carbonos primários a quaternários. Use antes de afirmar qualquer fato sobre uma estrutura específica.',
    input_schema: {
      type: 'object',
      properties: { smiles: { type: 'string', description: 'A estrutura em SMILES, ex.: CC(=O)Oc1ccccc1C(=O)O' } },
      required: ['smiles'],
      additionalProperties: false,
    },
  },
  {
    name: 'reagir',
    description:
      'Calcula, com o motor de reações do app, as reações orgânicas do ENEM que se aplicam a uma estrutura (hidrogenação, adições com Markovnikov, oxidação, desidratação, esterificação, neutralização, hidrólise, saponificação, bromação, nitração com o dirigente certo, polimerização, combustão balanceada) e seus produtos. Sem "reacao", lista todas as que se aplicam.',
    input_schema: {
      type: 'object',
      properties: {
        smiles: { type: 'string', description: 'O reagente orgânico em SMILES.' },
        reacao: { type: 'string', enum: REACTION_IDS, description: 'Uma reação específica (opcional).' },
      },
      required: ['smiles'],
      additionalProperties: false,
    },
  },
  {
    name: 'propor_exercicio',
    description:
      'Gera uma questão nova de uma lição da trilha, no formato do app, e a mostra ao aluno no chat para ele responder ali mesmo. Você recebe o gabarito e a explicação: não revele a resposta; espere o aluno responder (a resposta chega como mensagem dele).',
    input_schema: {
      type: 'object',
      properties: {
        licao: { type: 'string', enum: PLAYABLE, description: 'Id da lição.' },
        formato: { type: 'string', enum: ['choice', 'pick', 'tap'], description: 'choice = múltipla escolha, pick = escolher a estrutura, tap = tocar nos átomos (opcional).' },
      },
      required: ['licao'],
      additionalProperties: false,
    },
  },
  {
    name: 'salvar_no_mapa',
    description:
      'Cria cartões de conceito no mapa (canvas infinito) do aluno, ligados por setas com rótulo. Use quando o aluno pedir para salvar, resumir ou montar um mapa mental. O primeiro cartão fica no centro e os outros ao redor. Textos curtos: o cartão é para revisar de relance.',
    input_schema: {
      type: 'object',
      properties: {
        cartoes: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string', description: 'Até 6 palavras.' },
              texto: { type: 'string', description: 'Uma ou duas frases; **negrito** nos termos-chave.' },
              smiles: { type: 'string', description: 'Estrutura para desenhar no cartão (opcional).' },
            },
            required: ['titulo', 'texto'],
            additionalProperties: false,
          },
        },
        ligacoes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              de: { type: 'integer', description: 'Índice (0…) do cartão de origem.' },
              para: { type: 'integer', description: 'Índice do cartão de destino.' },
              rotulo: { type: 'string', description: 'Escrito sobre a seta, como um reagente: "é um", "oxida a", "+ HBr".' },
            },
            required: ['de', 'para'],
            additionalProperties: false,
          },
        },
      },
      required: ['cartoes'],
      additionalProperties: false,
    },
  },
  {
    name: 'planejar_tarefas',
    description:
      'Adiciona tarefas ao quadro de estudos (kanban) do aluno. Ligue a tarefa a uma lição com "licao" quando ela corresponder a uma: o cartão então anda sozinho conforme o aluno pratica. Use quando o aluno pedir um plano, um cronograma ou para organizar os estudos.',
    input_schema: {
      type: 'object',
      properties: {
        tarefas: {
          type: 'array',
          minItems: 1,
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              titulo: { type: 'string' },
              notas: { type: 'string', description: 'O que fazer, em uma frase.' },
              licao: { type: 'string', enum: PLAYABLE },
              coluna: { type: 'string', enum: ['todo', 'doing', 'review'], description: 'todo = A estudar (padrão), doing = Estudando, review = Revisar.' },
              prazo: { type: 'string', description: 'Data AAAA-MM-DD (opcional).' },
            },
            required: ['titulo'],
            additionalProperties: false,
          },
        },
      },
      required: ['tarefas'],
      additionalProperties: false,
    },
  },
];

/** The same definitions with fine-grained input streaming, for streamed requests. */
export const STREAMING_TOOL_DEFS: Anthropic.Beta.BetaTool[] = TOOL_DEFS.map((t) => ({ ...t, eager_input_streaming: true }));

// ---------------------------------------------------------------------------
// Validation: tool inputs are model output, so check them before acting.

export class ToolInputError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function str(o: Record<string, unknown>, key: string, required: true, max?: number): string;
function str(o: Record<string, unknown>, key: string, required?: false, max?: number): string | undefined;
function str(o: Record<string, unknown>, key: string, required = false, max = 2000): string | undefined {
  const v = o[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new ToolInputError(`"${key}" é obrigatório.`);
    return undefined;
  }
  if (typeof v !== 'string') throw new ToolInputError(`"${key}" deve ser texto.`);
  return v.slice(0, max);
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], key: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new ToolInputError(`"${key}" inválido: ${value}.`);
  return value as T;
}

export interface MapCardInput {
  titulo: string;
  texto: string;
  smiles?: string;
}
export interface MapLinkInput {
  de: number;
  para: number;
  rotulo: string;
}
export interface TaskInput {
  titulo: string;
  notas?: string;
  licao?: string;
  coluna: 'todo' | 'doing' | 'review';
  prazo?: string;
}

export type ToolInput =
  | { name: 'analisar_molecula'; smiles: string }
  | { name: 'reagir'; smiles: string; reacao?: string }
  | { name: 'propor_exercicio'; licao: string; formato?: Exercise['kind'] }
  | { name: 'salvar_no_mapa'; cartoes: MapCardInput[]; ligacoes: MapLinkInput[] }
  | { name: 'planejar_tarefas'; tarefas: TaskInput[] };

export function validateToolInput(name: string, input: unknown): ToolInput {
  if (!isObj(input)) throw new ToolInputError('A entrada deve ser um objeto.');
  switch (name) {
    case 'analisar_molecula':
      return { name, smiles: str(input, 'smiles', true, 400) };
    case 'reagir':
      return { name, smiles: str(input, 'smiles', true, 400), reacao: oneOf(str(input, 'reacao'), REACTION_IDS, 'reacao') };
    case 'propor_exercicio':
      return {
        name,
        licao: oneOf(str(input, 'licao', true), PLAYABLE, 'licao')!,
        formato: oneOf(str(input, 'formato'), ['choice', 'pick', 'tap'] as const, 'formato'),
      };
    case 'salvar_no_mapa': {
      const cards = input.cartoes;
      if (!Array.isArray(cards) || !cards.length) throw new ToolInputError('"cartoes" deve ser uma lista com ao menos um cartão.');
      const cartoes = cards.slice(0, 12).map((c, i) => {
        if (!isObj(c)) throw new ToolInputError(`Cartão ${i} inválido.`);
        return { titulo: str(c, 'titulo', true, 80), texto: str(c, 'texto', false, 600) ?? '', smiles: str(c, 'smiles', false, 400) };
      });
      const links = input.ligacoes ?? [];
      if (!Array.isArray(links)) throw new ToolInputError('"ligacoes" deve ser uma lista.');
      const ligacoes = links.flatMap((l) => {
        if (!isObj(l) || !Number.isInteger(l.de) || !Number.isInteger(l.para)) return [];
        const de = l.de as number;
        const para = l.para as number;
        if (de < 0 || para < 0 || de >= cartoes.length || para >= cartoes.length || de === para) return [];
        return [{ de, para, rotulo: (typeof l.rotulo === 'string' ? l.rotulo : '').slice(0, 40) }];
      });
      return { name, cartoes, ligacoes };
    }
    case 'planejar_tarefas': {
      const tasks = input.tarefas;
      if (!Array.isArray(tasks) || !tasks.length) throw new ToolInputError('"tarefas" deve ser uma lista com ao menos uma tarefa.');
      return {
        name,
        tarefas: tasks.slice(0, 10).map((t, i) => {
          if (!isObj(t)) throw new ToolInputError(`Tarefa ${i} inválida.`);
          const prazo = str(t, 'prazo');
          return {
            titulo: str(t, 'titulo', true, 100),
            notas: str(t, 'notas', false, 400),
            licao: oneOf(str(t, 'licao'), PLAYABLE, 'licao'),
            coluna: oneOf(str(t, 'coluna'), ['todo', 'doing', 'review'] as const, 'coluna') ?? 'todo',
            prazo: prazo && /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : undefined,
          };
        }),
      };
    }
    default:
      throw new ToolInputError(`Ferramenta desconhecida: ${name}.`);
  }
}

// ---------------------------------------------------------------------------
// Engine-backed tools (pure)

export function analyze(smiles: string) {
  const mol = moleculeFromSmiles(smiles);
  const chain = classifyChain(mol);
  const classes = carbonsByClass(mol);
  const groups = functionalGroups(mol);
  return {
    smiles_canonico: toSmiles(mol),
    formula_molecular: subscript(mol.formula()),
    massa_molar_g_mol: molarMass(mol) === undefined ? null : Math.round(molarMass(mol)! * 100) / 100,
    cadeia: {
      aberta: !chain.fechada,
      aromatica: chain.aromatica,
      ramificada: chain.ramificada,
      insaturada: chain.insaturada,
      heterogenea: chain.heterogenea,
    },
    funcoes: [...new Set(groups.map((g) => g.id))],
    carbonos: {
      primarios: classes['primário'].length,
      secundarios: classes['secundário'].length,
      terciarios: classes['terciário'].length,
      quaternarios: classes['quaternário'].length,
    },
    carbonos_quirais: chiralCarbons(mol).length,
    duplas_com_isomeria_cis_trans: geometricDoubleBonds(mol).length,
  };
}

const termText = (t: Term) => `${t.coef ? `${t.coef} ` : ''}${'mol' in t ? t.mol.smiles : 'text' in t ? t.text : '?'}`;

/** "C=CC + HBr → CC(C)Br (H⁺)", with structures as SMILES. */
export function schemeText(s: Scheme): string {
  const side = (terms: Term[]) => terms.map(termText).join(' + ');
  const cond = [s.over, s.under].filter(Boolean).join(', ');
  return `${side(s.left)} ${s.reversible ? '⇌' : '→'} ${side(s.right)}${cond ? ` (${cond})` : ''}`;
}

export function react(smiles: string, reacao?: string) {
  const all = labReactions(smiles);
  const chosen = reacao ? all.filter((r) => r.id === reacao) : all;
  if (reacao && !chosen.length) {
    return { aplicavel: false, motivo: `A reação "${reacao}" não se aplica a esta estrutura.`, possiveis: all.map((r) => r.id) };
  }
  return {
    aplicavel: chosen.length > 0,
    reacoes: chosen.map((r) => ({ id: r.id, nome: r.name, equacao: schemeText(r.scheme), produto: r.product?.smiles ?? null, nota: r.note })),
  };
}

/** One fresh question from a lesson, in the requested format when the lesson has it. */
export function makeExercise(lessonId: string, kind: Exercise['kind'] | undefined, seed: number): Exercise | undefined {
  const lesson = LESSON_BY_ID[lessonId];
  const set = lesson?.generate?.(createRng(seed)) ?? [];
  return (kind && set.find((e) => e.kind === kind)) || set[0];
}

/** What the tutor is told about a question it put on screen: everything, including the key. */
export function describeExercise(ex: Exercise) {
  const base = { enunciado: ex.prompt, explicacao: ex.explain, estrutura: ex.molecule?.smiles ?? null };
  if (ex.kind === 'choice') return { ...base, formato: 'múltipla escolha', alternativas: ex.options, gabarito: ex.options[ex.answer] };
  if (ex.kind === 'pick') return { ...base, formato: 'escolher a estrutura', alternativas: ex.options.map((o) => o.smiles), gabarito: ex.options[ex.answer].smiles };
  return { ...base, formato: 'tocar nos átomos', gabarito_atomos: ex.answer.map((a) => a + 1), observacao: 'Os átomos são numerados na ordem do SMILES, a partir de 1.' };
}
