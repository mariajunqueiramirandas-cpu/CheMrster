/**
 * Organic names, as Brazilian textbooks teach the IUPAC rules: prefixes for the branches
 * (2,2-dimetil), the main chain's size (prop), its bonds (an, en, in) and the function's
 * suffix (ol, al, ona, oico...), with the locants where they can vary: propan-2-ol. Every name is
 * written from its parts, so the spelling rules (and the older forms people still use, like
 * 2-propanol) live in one place. Structures are SMILES, drawn by Nanquim.
 */
import { countAtoms } from '../chem/analysis.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';

/** The organic functions of the ENEM. */
export type OrgFunction =
  | 'hidrocarboneto'
  | 'alcool'
  | 'fenol'
  | 'aldeido'
  | 'cetona'
  | 'acido'
  | 'ester'
  | 'eter'
  | 'amina'
  | 'amida'
  | 'haleto'
  | 'nitrila'
  | 'nitro';

export const FUNCTION_LABEL: Record<OrgFunction, string> = {
  hidrocarboneto: 'hidrocarboneto',
  alcool: 'álcool',
  fenol: 'fenol',
  aldeido: 'aldeído',
  cetona: 'cetona',
  acido: 'ácido carboxílico',
  ester: 'éster',
  eter: 'éter',
  amina: 'amina',
  amida: 'amida',
  haleto: 'haleto orgânico',
  nitrila: 'nitrila',
  nitro: 'nitrocomposto',
};

/** Prefixes for 1 to 10 carbons. */
export const STEMS = ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'] as const;
const MULT = ['', '', 'di', 'tri', 'tetra'] as const;

/** Branches and the groups named as prefixes, with their carbons and how they are written. */
export const GROUPS = {
  metil: { carbons: 1, formula: 'CH₃–' },
  etil: { carbons: 2, formula: 'CH₃–CH₂–' },
  propil: { carbons: 3, formula: 'CH₃–CH₂–CH₂–' },
  isopropil: { carbons: 3, formula: '(CH₃)₂CH–' },
  pentil: { carbons: 5, formula: 'CH₃(CH₂)₄–' },
  '3-metilbutil': { carbons: 5, formula: '(CH₃)₂CH–CH₂–CH₂–' },
  octil: { carbons: 8, formula: 'CH₃(CH₂)₇–' },
  etenil: { carbons: 2, formula: 'CH₂=CH–' },
  fenil: { carbons: 6, formula: 'C₆H₅–' },
  metoxi: { carbons: 1, formula: 'CH₃–O–' },
  etoxi: { carbons: 2, formula: 'CH₃–CH₂–O–' },
  fluoro: { carbons: 0, formula: 'F–' },
  cloro: { carbons: 0, formula: 'Cl–' },
  bromo: { carbons: 0, formula: 'Br–' },
  iodo: { carbons: 0, formula: 'I–' },
  nitro: { carbons: 0, formula: 'O₂N–' },
  hidroxi: { carbons: 0, formula: 'HO–' },
} as const;

export type GroupId = keyof typeof GROUPS;

/** Where a group sits: a carbon of the main chain, or the N of an amine. */
export type Locant = number | 'N';

export interface Substituent {
  at: Locant[];
  group: GroupId;
}

/** The suffix of the main function; hydrocarbons, ethers, halides and nitro compounds end in -o. */
export type OrgSuffix = 'ol' | 'al' | 'ona' | 'oico' | 'amina' | 'amida' | 'nitrila' | 'oato';

/** Suffixes whose carbon can sit anywhere, so they carry a locant: propan-2-ol. The others are always carbon 1. */
const LOCATED: ReadonlySet<OrgSuffix> = new Set(['ol', 'ona', 'amina']);

export interface OrgParts {
  /** Branches and prefix groups, in any order (names list them alphabetically). */
  subs?: Substituent[];
  /** A closed chain: ciclo-. */
  ring?: boolean;
  /** Carbons of the main chain, or the benzene ring. */
  parent: number | 'benzeno';
  /** Where each double and triple bond starts. */
  en?: number[];
  in?: number[];
  suffix?: OrgSuffix;
  /** Where the suffix's groups are, one locant per group (two for -dioico, -diol). Default [1]. */
  at?: number[];
  /** Esters: the group on the O, named with -ila (etila). */
  alkyl?: GroupId;
  /** Every locant is the only one possible, so the name leaves them out: propanona, metilpropano. */
  bare?: boolean;
}

export const stemOf = (p: OrgParts) => (p.parent === 'benzeno' ? 'benzeno' : (p.ring ? 'ciclo-' : '') + STEMS[p.parent]);

/** Joins two pieces of a name: a hyphen before a number, before h (metil-hexano, ciclo-hexano) and before N-. */
function join(left: string, right: string): string {
  if (!left) return right;
  if (/[a-z]$/.test(left) && /^(\d|h|N)/.test(right)) return `${left}-${right}`;
  return left + right;
}

const locs = (at: readonly Locant[]) => at.join(',');

/** The prefixes, alphabetical by group (di-, tri- do not count): 3-etil-2-metil. */
export function prefixText(subs: readonly Substituent[] = [], showLocants = true): string {
  const sorted = [...subs].sort((a, b) => a.group.localeCompare(b.group, 'pt'));
  return sorted.reduce((out, s) => {
    const shown = showLocants ? s.at : s.at.filter((l) => l === 'N');
    const word = MULT[s.at.length] + s.group;
    return join(out, shown.length ? `${locs(shown)}-${word}` : word);
  }, '');
}

interface Segment {
  text: string;
  at?: readonly number[];
}

/**
 * The main chain and what follows it. `pull` takes the first locant out (for the older style,
 * where it goes in front: 2-propanol, 1,3-butadieno).
 */
function parentText(p: OrgParts, showLocants: boolean, pull: boolean): { text: string; pulled?: string } {
  if (p.parent === 'benzeno') return { text: 'benzeno' };
  const segments: Segment[] = [];
  if (p.en?.length) segments.push({ text: 'en', at: p.en });
  if (p.in?.length) segments.push({ text: 'in', at: p.in });
  if (!segments.length) segments.push({ text: 'an' });
  if (!p.suffix) segments.push({ text: 'o' });
  else {
    const at = p.at ?? [1];
    segments.push({ text: MULT[at.length] + p.suffix, at: LOCATED.has(p.suffix) ? at : undefined });
  }
  let out = join(p.ring ? 'ciclo' : '', STEMS[p.parent]);
  let pulled: string | undefined;
  segments.forEach((s, i) => {
    let where = s.at && showLocants ? locs(s.at) : '';
    if (where && pull && !pulled) {
      pulled = where;
      where = '';
    }
    const body = s.text === 'en' || s.text === 'in' ? MULT[s.at!.length] + s.text : s.text;
    // A consonant needs a vowel before it: buta-1,3-dieno, etano-1,2-diol, etanonitrila.
    if (/^[^aeiou]/.test(body)) out += i === 0 ? 'a' : 'o';
    out += where ? `-${where}-${body}` : body;
  });
  return { text: out, pulled };
}

/** One way to write the name: with or without the locants that cannot vary, in today's or the older style. */
export function render(p: OrgParts, showLocants: boolean, old: boolean): string {
  const parent = parentText(p, showLocants, old);
  let name = join(prefixText(p.subs, showLocants), parent.pulled ? `${parent.pulled}-${parent.text}` : parent.text);
  if (p.suffix === 'oico') name = `ácido ${name}`;
  if (p.suffix === 'oato') name = `${name} de ${p.alkyl}a`;
  return name;
}

/**
 * Whether a name that leaves its locants out may also be written with them: 2-metilpropano and
 * propan-2-ona, yes; 1-eteno, 1-metilbenzeno and ciclo-hexan-1-ol, no one writes those.
 */
export const numberable = (p: OrgParts) => !!p.bare && p.parent !== 'benzeno' && !p.ring && p.parent > 2;

/** Every accepted spelling, the name to show first: today's style, the older one, then with all locants written. */
export function spellings(p: OrgParts): string[] {
  const out = [render(p, !p.bare, false), render(p, !p.bare, true)];
  if (numberable(p)) out.push(render(p, true, false), render(p, true, true));
  return [...new Set(out)];
}

/** Carbons the parts account for: the chain, the branches and an ester's alkyl group. */
export function partCarbons(p: OrgParts): number {
  const chain = p.parent === 'benzeno' ? 6 : p.parent;
  const subs = (p.subs ?? []).reduce((n, s) => n + GROUPS[s.group].carbons * s.at.length, 0);
  return chain + subs + (p.alkyl ? GROUPS[p.alkyl].carbons : 0);
}

const HILL_REST = ['Br', 'Cl', 'F', 'I', 'N', 'O', 'S'];

/** The molecular formula in Hill order (C, H, then alphabetical): C3H8O. */
export function molecularFormula(smiles: string): string {
  const mol = moleculeFromSmiles(smiles);
  return ['C', 'H', ...HILL_REST]
    .map((el) => [el, countAtoms(mol, el)] as const)
    .filter(([, n]) => n > 0)
    .map(([el, n]) => (n === 1 ? el : `${el}${n}`))
    .join('');
}

export interface OrgDef {
  smiles: string;
  tier: 1 | 2 | 3;
  fn: OrgFunction;
  /** How the name is built; absent for names IUPAC keeps as they are (fenol, ácido benzoico). */
  parts?: OrgParts;
  /** Kept names, the first one shown. */
  kept?: string[];
  /** Other accepted IUPAC names: metilamina for metanamina. */
  also?: string[];
  /** Usual names, which get a nudge toward the IUPAC one: acetona, ácido acético. */
  common?: string[];
  fact?: string;
  /** For a kept name, where it comes from. */
  note?: string;
}

type Extra = Pick<OrgDef, 'also' | 'common' | 'fact' | 'note'>;

const o = (smiles: string, tier: OrgDef['tier'], fn: OrgFunction, parts: OrgParts | string[], extra: Extra = {}): OrgDef =>
  Array.isArray(parts) ? { smiles, tier, fn, kept: parts, ...extra } : { smiles, tier, fn, parts, ...extra };

const sub = (group: GroupId, ...at: Locant[]): Substituent => ({ group, at });

export const ORGANIC_DEFS: OrgDef[] = [
  // Tier 1: straight chains, no locants.
  o('C', 1, 'hidrocarboneto', { parent: 1 }, { fact: 'O gás natural e o biogás; também sai da digestão do gado e é um gás estufa potente.' }),
  o('CC', 1, 'hidrocarboneto', { parent: 2 }),
  o('CCC', 1, 'hidrocarboneto', { parent: 3 }, { fact: 'Junto com o butano, forma o GLP, o gás de cozinha.' }),
  o('CCCC', 1, 'hidrocarboneto', { parent: 4 }, { fact: 'O principal gás do botijão de cozinha (GLP) e dos isqueiros.' }),
  o('CCCCC', 1, 'hidrocarboneto', { parent: 5 }),
  o('CCCCCC', 1, 'hidrocarboneto', { parent: 6 }, { fact: 'Solvente usado para extrair o óleo da soja.' }),
  o('CCCCCCCC', 1, 'hidrocarboneto', { parent: 8 }, { fact: 'Um dos hidrocarbonetos da gasolina.' }),
  o('C=C', 1, 'hidrocarboneto', { parent: 2, en: [1], bare: true }, { common: ['etileno'], fact: 'Hormônio vegetal que faz as frutas amadurecerem; vira o polietileno das sacolas.' }),
  o('C=CC', 1, 'hidrocarboneto', { parent: 3, en: [1], bare: true }, { common: ['propileno'], fact: 'Matéria-prima do polipropileno, o plástico de potes e tampas.' }),
  o('C#C', 1, 'hidrocarboneto', { parent: 2, in: [1], bare: true }, { common: ['acetileno'], fact: 'O gás do maçarico oxiacetilênico, que corta e solda metais.' }),
  o('c1ccccc1', 1, 'hidrocarboneto', { parent: 'benzeno' }, { fact: 'Aromático e cancerígeno: está na gasolina e na fumaça do cigarro.' }),
  o('CO', 1, 'alcool', { parent: 1, suffix: 'ol', bare: true }, { common: ['álcool metílico'], fact: 'Tóxico: bebido, pode causar cegueira. Usado na produção de biodiesel.' }),
  o('CCO', 1, 'alcool', { parent: 2, suffix: 'ol', bare: true }, { common: ['álcool etílico', 'álcool'], fact: 'O álcool combustível e o das bebidas, feito da fermentação da cana no Brasil.' }),
  o('C=O', 1, 'aldeido', { parent: 1, suffix: 'al' }, { common: ['formaldeído', 'formol', 'aldeído fórmico'], fact: 'Em solução aquosa, é o formol, que conserva peças anatômicas.' }),
  o('CC=O', 1, 'aldeido', { parent: 2, suffix: 'al' }, { common: ['acetaldeído', 'aldeído acético'], fact: 'O fígado oxida o etanol a etanal: ele é um dos culpados pela ressaca.' }),
  o('CCC=O', 1, 'aldeido', { parent: 3, suffix: 'al' }, { common: ['propionaldeído'] }),
  o('CC(C)=O', 1, 'cetona', { parent: 3, suffix: 'ona', at: [2], bare: true }, { common: ['acetona', 'dimetilcetona'], fact: 'A acetona do removedor de esmalte.' }),
  o('OC=O', 1, 'acido', { parent: 1, suffix: 'oico' }, { common: ['ácido fórmico'], fact: 'Está na picada das formigas (formica, em latim) e na urtiga.' }),
  o('CC(=O)O', 1, 'acido', { parent: 2, suffix: 'oico' }, { common: ['ácido acético'], fact: 'O vinagre é uma solução de 4% a 6% dele.' }),
  o('CCC(=O)O', 1, 'acido', { parent: 3, suffix: 'oico' }, { common: ['ácido propiônico'], fact: 'Seus sais conservam pães e queijos contra o mofo.' }),
  o('CCl', 1, 'haleto', { parent: 1, subs: [sub('cloro', 1)], bare: true }, { common: ['cloreto de metila'] }),
  o('CN', 1, 'amina', { parent: 1, suffix: 'amina', bare: true }, { also: ['metilamina'] }),

  // Tier 2: locants, branches, rings, the other functions.
  o('CCCO', 2, 'alcool', { parent: 3, suffix: 'ol', at: [1] }, { common: ['álcool propílico'] }),
  o('CC(C)O', 2, 'alcool', { parent: 3, suffix: 'ol', at: [2] }, { common: ['álcool isopropílico', 'isopropanol'], fact: 'O álcool isopropílico que limpa telas e eletrônicos.' }),
  o('CCCCO', 2, 'alcool', { parent: 4, suffix: 'ol', at: [1] }, { common: ['álcool butílico'] }),
  o('C=CCC', 2, 'hidrocarboneto', { parent: 4, en: [1] }),
  o('CC=CC', 2, 'hidrocarboneto', { parent: 4, en: [2] }, { fact: 'Tem isômeros cis e trans: cada carbono da dupla tem dois ligantes diferentes.' }),
  o('CC#C', 2, 'hidrocarboneto', { parent: 3, in: [1], bare: true }),
  o('CC#CC', 2, 'hidrocarboneto', { parent: 4, in: [2] }),
  o('CC(C)C', 2, 'hidrocarboneto', { parent: 3, subs: [sub('metil', 2)], bare: true }, { common: ['isobutano'], fact: 'Isômero de cadeia do butano: mesma fórmula, C₄H₁₀, cadeia ramificada.' }),
  o('CCC(C)C', 2, 'hidrocarboneto', { parent: 4, subs: [sub('metil', 2)] }, { common: ['isopentano'] }),
  o('CC(C)(C)C', 2, 'hidrocarboneto', { parent: 3, subs: [sub('metil', 2, 2)] }, { common: ['neopentano'], fact: 'Tem um carbono quaternário: ligado a outros quatro carbonos.' }),
  o('C1CC1', 2, 'hidrocarboneto', { parent: 3, ring: true }, { fact: 'Já foi usado como anestésico; o anel de três carbonos é muito tensionado.' }),
  o('C1CCCC1', 2, 'hidrocarboneto', { parent: 5, ring: true }),
  o('C1CCCCC1', 2, 'hidrocarboneto', { parent: 6, ring: true }, { fact: 'O anel de seis carbonos fica sem tensão na forma de "cadeira".' }),
  o('Cc1ccccc1', 2, 'hidrocarboneto', { parent: 'benzeno', subs: [sub('metil', 1)], bare: true }, { common: ['tolueno'], fact: 'O solvente de tintas e colas, também presente na gasolina.' }),
  o('CCc1ccccc1', 2, 'hidrocarboneto', { parent: 'benzeno', subs: [sub('etil', 1)], bare: true }),
  o('CCC(C)=O', 2, 'cetona', { parent: 4, suffix: 'ona', at: [2], bare: true }, { common: ['metiletilcetona', 'MEK'], fact: 'Solvente de colas e tintas.' }),
  o('CCCC(C)=O', 2, 'cetona', { parent: 5, suffix: 'ona', at: [2] }),
  o('CCC(=O)CC', 2, 'cetona', { parent: 5, suffix: 'ona', at: [3] }, { common: ['dietilcetona'] }),
  o('CCCC=O', 2, 'aldeido', { parent: 4, suffix: 'al' }, { common: ['butiraldeído'] }),
  o('CCCC(=O)O', 2, 'acido', { parent: 4, suffix: 'oico' }, { common: ['ácido butírico'], fact: 'O cheiro da manteiga rançosa e do chulé.' }),
  o('CCCCC(=O)O', 2, 'acido', { parent: 5, suffix: 'oico' }, { common: ['ácido valérico'] }),
  o('COC=O', 2, 'ester', { parent: 1, suffix: 'oato', alkyl: 'metil' }, { common: ['formiato de metila'] }),
  o('COC(C)=O', 2, 'ester', { parent: 2, suffix: 'oato', alkyl: 'metil' }, { common: ['acetato de metila'] }),
  o('CCOC(C)=O', 2, 'ester', { parent: 2, suffix: 'oato', alkyl: 'etil' }, { common: ['acetato de etila'], fact: 'Solvente de removedores de esmalte e colas; cheira a fruta.' }),
  o('CCCCCOC(C)=O', 2, 'ester', { parent: 2, suffix: 'oato', alkyl: 'pentil' }, { common: ['acetato de pentila', 'acetato de amila'], fact: 'Um flavorizante com aroma de banana e pera.' }),
  o('COCC', 2, 'eter', { parent: 2, subs: [sub('metoxi', 1)], bare: true }, { common: ['éter etílico e metílico', 'éter metiletílico'] }),
  o('CCOCC', 2, 'eter', { parent: 2, subs: [sub('etoxi', 1)], bare: true }, { common: ['éter etílico', 'éter dietílico', 'éter'], fact: 'O "éter" que já foi anestésico em cirurgias; muito volátil e inflamável.' }),
  o('CCN', 2, 'amina', { parent: 2, suffix: 'amina', bare: true }, { also: ['etilamina'] }),
  o('NC=O', 2, 'amida', { parent: 1, suffix: 'amida' }, { common: ['formamida'] }),
  o('CC(N)=O', 2, 'amida', { parent: 2, suffix: 'amida' }, { common: ['acetamida'] }),
  o('CCC(N)=O', 2, 'amida', { parent: 3, suffix: 'amida' }, { common: ['propionamida'] }),
  o('CCCl', 2, 'haleto', { parent: 2, subs: [sub('cloro', 1)], bare: true }, { common: ['cloreto de etila'], fact: 'O spray gelado que anestesia pancadas no futebol.' }),
  o('CCBr', 2, 'haleto', { parent: 2, subs: [sub('bromo', 1)], bare: true }, { common: ['brometo de etila'] }),
  o('CC(C)Cl', 2, 'haleto', { parent: 3, subs: [sub('cloro', 2)] }, { common: ['cloreto de isopropila'] }),
  o('ClCCl', 2, 'haleto', { parent: 1, subs: [sub('cloro', 1, 1)], bare: true }, { common: ['cloreto de metileno'], fact: 'Solvente que remove tintas e a cafeína do café descafeinado.' }),
  o('ClC(Cl)Cl', 2, 'haleto', { parent: 1, subs: [sub('cloro', 1, 1, 1)], bare: true }, { common: ['clorofórmio'], fact: 'O clorofórmio, um dos primeiros anestésicos.' }),
  o('C=CCl', 2, 'haleto', { parent: 2, en: [1], subs: [sub('cloro', 1)], bare: true }, { common: ['cloreto de vinila'], fact: 'O monômero do PVC, o plástico dos canos.' }),
  o('Clc1ccccc1', 2, 'haleto', { parent: 'benzeno', subs: [sub('cloro', 1)], bare: true }),
  o('Oc1ccccc1', 2, 'fenol', ['fenol'], { also: ['hidroxibenzeno'], common: ['ácido fênico'], note: 'O OH preso ao benzeno dá o **fenol**, o mais simples da função, que empresta o nome a ela.', fact: 'O ácido fênico, primeiro antisséptico das cirurgias. Mais ácido que os álcoois.' }),
  o('OC(=O)c1ccccc1', 2, 'acido', ['ácido benzoico'], { also: ['ácido benzenocarboxílico'], note: 'O COOH preso ao benzeno: **ácido benzoico**, nome que a IUPAC mantém.', fact: 'Ele e o benzoato de sódio conservam refrigerantes e sucos (INS 210 e 211).' }),

  // Tier 3: several branches, dienes and polyols, secondary amines, the rest of the textbook.
  o('CC(C)CC(C)(C)C', 3, 'hidrocarboneto', { parent: 5, subs: [sub('metil', 2, 2, 4)] }, { common: ['isoctano', 'isooctano'], fact: 'A referência de octanagem 100 da gasolina: resiste à compressão sem detonar.' }),
  o('CCCC(C)C', 3, 'hidrocarboneto', { parent: 5, subs: [sub('metil', 2)] }, { common: ['isoexano'] }),
  o('CCC(C)CC', 3, 'hidrocarboneto', { parent: 5, subs: [sub('metil', 3)] }),
  o('CC(C)C(C)C', 3, 'hidrocarboneto', { parent: 4, subs: [sub('metil', 2, 3)] }),
  o('CCC(CC)CC', 3, 'hidrocarboneto', { parent: 5, subs: [sub('etil', 3)] }),
  o('CCCC(CC)C(C)C', 3, 'hidrocarboneto', { parent: 6, subs: [sub('metil', 2), sub('etil', 3)] }),
  o('C=CC=C', 3, 'hidrocarboneto', { parent: 4, en: [1, 3] }, { common: ['butadieno', 'eritreno'], fact: 'Monômero da borracha sintética (SBR) dos pneus.' }),
  o('C=CC(C)=C', 3, 'hidrocarboneto', { parent: 4, en: [1, 3], subs: [sub('metil', 2)] }, { common: ['isopreno'], fact: 'A unidade que se repete na borracha natural e nos terpenos.' }),
  o('CC=C(C)C', 3, 'hidrocarboneto', { parent: 4, en: [2], subs: [sub('metil', 2)] }),
  o('C=C(C)C', 3, 'hidrocarboneto', { parent: 3, en: [1], subs: [sub('metil', 2)], bare: true }, { common: ['isobutileno', 'isobuteno'] }),
  o('CC(C)C#C', 3, 'hidrocarboneto', { parent: 4, in: [1], subs: [sub('metil', 3)] }),
  o('C1=CCCCC1', 3, 'hidrocarboneto', { parent: 6, ring: true, en: [1], bare: true }),
  o('Cc1ccccc1C', 3, 'hidrocarboneto', { parent: 'benzeno', subs: [sub('metil', 1, 2)] }, { common: ['orto-xileno', 'o-xileno'] }),
  o('Cc1ccc(C)cc1', 3, 'hidrocarboneto', { parent: 'benzeno', subs: [sub('metil', 1, 4)] }, { common: ['para-xileno', 'p-xileno'], fact: 'Matéria-prima do PET das garrafas.' }),
  o('C=Cc1ccccc1', 3, 'hidrocarboneto', { parent: 'benzeno', subs: [sub('etenil', 1)], bare: true }, { also: ['vinilbenzeno'], common: ['estireno'], fact: 'O monômero do poliestireno, o isopor.' }),
  o('CC(O)CC', 3, 'alcool', { parent: 4, suffix: 'ol', at: [2] }, { common: ['álcool sec-butílico'], fact: 'Tem um carbono quiral: existe em duas formas, uma imagem especular da outra.' }),
  o('CC(C)(C)O', 3, 'alcool', { parent: 3, suffix: 'ol', at: [2], subs: [sub('metil', 2)] }, { common: ['álcool terc-butílico'] }),
  o('OCCO', 3, 'alcool', { parent: 2, suffix: 'ol', at: [1, 2] }, { common: ['etilenoglicol', 'glicol'], fact: 'O anticongelante dos radiadores; também é matéria-prima do PET.' }),
  o('OCC(O)CO', 3, 'alcool', { parent: 3, suffix: 'ol', at: [1, 2, 3] }, { common: ['glicerina', 'glicerol'], fact: 'Subproduto da produção de biodiesel; hidrata a pele em cosméticos.' }),
  o('C=CCO', 3, 'alcool', { parent: 3, en: [2], suffix: 'ol', at: [1] }, { common: ['álcool alílico'] }),
  o('OC1CCCCC1', 3, 'alcool', { parent: 6, ring: true, suffix: 'ol', bare: true }),
  o('CC(C)C=O', 3, 'aldeido', { parent: 3, suffix: 'al', subs: [sub('metil', 2)], bare: true }, { common: ['isobutiraldeído'] }),
  o('O=Cc1ccccc1', 3, 'aldeido', ['benzaldeído'], { also: ['benzenocarbaldeído'], note: 'O CHO preso ao benzeno: **benzaldeído**, nome que a IUPAC mantém.', fact: 'O aroma de amêndoas amargas e de cereja.' }),
  o('CC(=O)C(C)C', 3, 'cetona', { parent: 4, suffix: 'ona', at: [2], subs: [sub('metil', 3)] }),
  o('O=C1CCCCC1', 3, 'cetona', { parent: 6, ring: true, suffix: 'ona', bare: true }, { fact: 'Intermediário na fabricação do náilon.' }),
  o('OC(=O)C(=O)O', 3, 'acido', { parent: 2, suffix: 'oico', at: [1, 2] }, { common: ['ácido oxálico'], fact: 'Está no espinafre e na carambola; com cálcio, forma pedras nos rins.' }),
  o('CC(O)C(=O)O', 3, 'acido', { parent: 3, suffix: 'oico', subs: [sub('hidroxi', 2)] }, { common: ['ácido lático', 'ácido láctico'], fact: 'Forma-se nos músculos em exercício intenso e no leite que azeda.' }),
  o('CCCC(=O)OCC', 3, 'ester', { parent: 4, suffix: 'oato', alkyl: 'etil' }, { common: ['butirato de etila'], fact: 'Flavorizante com aroma de abacaxi.' }),
  o('CC(C)CCOC(C)=O', 3, 'ester', { parent: 2, suffix: 'oato', alkyl: '3-metilbutil' }, { common: ['acetato de isoamila', 'acetato de isopentila'], fact: 'O aroma de banana das balas e dos refrescos.' }),
  o('CCCCCCCCOC(C)=O', 3, 'ester', { parent: 2, suffix: 'oato', alkyl: 'octil' }, { common: ['acetato de octila'], fact: 'Flavorizante com aroma de laranja.' }),
  o('COc1ccccc1', 3, 'eter', { parent: 'benzeno', subs: [sub('metoxi', 1)], bare: true }, { common: ['anisol'] }),
  o('CC(C)N', 3, 'amina', { parent: 3, suffix: 'amina', at: [2] }, { also: ['isopropilamina'] }),
  o('CNC', 3, 'amina', { parent: 1, suffix: 'amina', subs: [sub('metil', 'N')], bare: true }, { also: ['dimetilamina'] }),
  o('CN(C)C', 3, 'amina', { parent: 1, suffix: 'amina', subs: [sub('metil', 'N', 'N')], bare: true }, { also: ['trimetilamina'], fact: 'O cheiro de peixe; o limão o neutraliza, porque a amina é uma base.' }),
  o('Nc1ccccc1', 3, 'amina', ['fenilamina', 'anilina'], { also: ['aminobenzeno', 'benzenamina'], note: 'O grupo **fenil** (C₆H₅–) ligado ao NH₂: **fenil** + **amina**.', fact: 'Matéria-prima de corantes, como o índigo do jeans.' }),
  o('CC#N', 3, 'nitrila', { parent: 2, suffix: 'nitrila' }, { common: ['acetonitrila', 'cianeto de metila'] }),
  o('CCC#N', 3, 'nitrila', { parent: 3, suffix: 'nitrila' }, { common: ['propionitrila', 'cianeto de etila'] }),
  o('[O-][N+](=O)c1ccccc1', 3, 'nitro', { parent: 'benzeno', subs: [sub('nitro', 1)], bare: true }, { fact: 'Reduzido, vira fenilamina (anilina).' }),
  o('ClC(Cl)(Cl)Cl', 3, 'haleto', { parent: 1, subs: [sub('cloro', 1, 1, 1, 1)], bare: true }, { common: ['tetracloreto de carbono'] }),
  o('ClCCCl', 3, 'haleto', { parent: 2, subs: [sub('cloro', 1, 2)] }, { common: ['dicloreto de etileno'], fact: 'Intermediário na fabricação do PVC.' }),
  o('FC(F)(Cl)Cl', 3, 'haleto', { parent: 1, subs: [sub('cloro', 1, 1), sub('fluoro', 1, 1)], bare: true }, { common: ['CFC-12', 'freon-12', 'fréon'], fact: 'Um CFC: o gás das geladeiras antigas que destrói a camada de ozônio.' }),
  o('CCCCBr', 3, 'haleto', { parent: 4, subs: [sub('bromo', 1)] }, { common: ['brometo de butila'] }),
];
