/**
 * Exercise generators. Each lesson draws fresh questions from curated pools and
 * computes the answers with the chemistry analysis, so no answer key is hand-typed.
 */
import {
  type CarbonClass,
  FUNCTION_INFO,
  type FunctionId,
  carbonNeighbors,
  carbonsByClass,
  chiralCarbons,
  classifyChain,
  functionSet,
  functionalGroups,
  geometricDoubleBonds,
  hydrocarbonClass,
} from '../chem/analysis.ts';
import { MOLECULE_BY_ID } from '../content/molecules.ts';
import { type Molecule, moleculeFromSmiles } from '../nanquim/index.ts';
import {
  ALKANES,
  ALKENES,
  ALKYNES,
  AROMATIC,
  CHAINS,
  CHIRAL,
  CYCLIC,
  EVERYDAY,
  FUNCTION_EXAMPLES,
  GEOMETRIC,
  HYDROCARBONS,
  MAYBE_GEOMETRIC,
  type Named,
} from './pools.ts';
import type { Rng } from './random.ts';
import type { ChoiceExercise, Exercise, MolSpec, PickStructureExercise, TapAtomsExercise } from './types.ts';

const cache = new Map<string, Molecule>();
export function mol(smiles: string): Molecule {
  let m = cache.get(smiles);
  if (!m) {
    m = moleculeFromSmiles(smiles);
    cache.set(smiles, m);
  }
  return m;
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const joinPt = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
export const subscript = (formula: string) => formula.replace(/\d/g, (d) => SUBSCRIPTS[Number(d)]);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s[0].toLowerCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const carbons = (m: Molecule) => m.atoms.filter((a) => a.element === 'C').map((a) => a.index);

function choice(
  rng: Rng,
  prompt: string,
  correct: string,
  distractors: string[],
  explain: string,
  molecule?: MolSpec,
): ChoiceExercise {
  const unique = [...new Set(distractors.filter((d) => d !== correct))];
  const options = rng.shuffle([correct, ...unique]);
  return { kind: 'choice', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

/** Options kept in their natural order (numbers, yes/no). */
function orderedChoice(prompt: string, options: string[], correct: string, explain: string, molecule?: MolSpec): ChoiceExercise {
  return { kind: 'choice', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

function numberOptions(rng: Rng, answer: number, min = 0): string[] {
  const start = Math.max(min, answer - rng.int(3));
  return [0, 1, 2, 3].map((k) => String(start + k));
}

function pick(
  rng: Rng,
  prompt: string,
  correct: MolSpec,
  distractors: MolSpec[],
  explain: string,
  molecule?: MolSpec,
): PickStructureExercise {
  const options = rng.shuffle([correct, ...distractors]);
  return { kind: 'pick', prompt, molecule, options, answer: options.indexOf(correct), explain };
}

function tap(prompt: string, molecule: MolSpec, answer: number[], explain: string, tappable?: number[]): TapAtomsExercise {
  return { kind: 'tap', prompt, molecule, answer: [...answer].sort((a, b) => a - b), explain, tappable };
}

/** Distractors that look alike: isomers first, then molecules of similar size. */
function lookalikes(rng: Rng, target: Named, pool: Named[], count: number): Named[] {
  const formula = mol(target.smiles).formula();
  const size = carbons(mol(target.smiles)).length;
  const others = pool.filter((p) => p.smiles !== target.smiles && p.name !== target.name);
  const isomers = rng.shuffle(others.filter((p) => mol(p.smiles).formula() === formula));
  const near = rng
    .shuffle(others.filter((p) => !isomers.includes(p)))
    .sort((a, b) => Math.abs(carbons(mol(a.smiles)).length - size) - Math.abs(carbons(mol(b.smiles)).length - size));
  return [...isomers, ...near].slice(0, count);
}

function lessonSet(rng: Rng, makers: Array<() => Exercise | undefined>, count = 8): Exercise[] {
  const out: Exercise[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 6) {
    const ex = makers[out.length % makers.length]();
    if (ex) out.push(ex);
  }
  return rng.shuffle(out);
}

// ---------------------------------------------------------------------------
// Unidade 1 — o carbono e suas fórmulas

const SMALL_CHAINS = [...ALKANES.slice(0, 10), ...ALKENES.slice(1, 7), ...ALKYNES.slice(1), ...CYCLIC.slice(2, 5)];

export function tetravalence(rng: Rng): Exercise[] {
  const bondsAt = (m: Molecule, c: number) => {
    let single = m.atoms[c].hydrogens;
    let double = 0;
    let triple = 0;
    for (const bi of m.adjacency[c]) {
      const o = m.bonds[bi].order;
      if (o === 1) single++;
      if (o === 2) double++;
      if (o === 3) triple++;
    }
    return { single, double, triple };
  };
  const countBonds = () => {
    const item = rng.pick([...ALKENES.slice(0, 4), ...ALKYNES.slice(0, 3), ...FUNCTION_EXAMPLES.slice(7, 13), ALKANES[0]]);
    const m = mol(item.smiles);
    const c = rng.pick(carbons(m));
    const { single, double, triple } = bondsAt(m, c);
    const parts = [
      single && plural(single, 'simples', 'simples'),
      double && plural(double, 'dupla', 'duplas'),
      triple && plural(triple, 'tripla', 'triplas'),
    ].filter((p): p is string => !!p);
    const sum = [...Array(single).fill('1'), ...Array(double).fill('2'), ...Array(triple).fill('3')].join(' + ');
    return orderedChoice(
      'Quantas ligações faz o carbono destacado? Conte uma dupla como 2 e uma tripla como 3.',
      ['2', '3', '4', '5'],
      '4',
      `Todo carbono faz 4 ligações: ele é tetravalente. Aqui: ${joinPt(parts)}, ou seja, ${sum} = 4.`,
      { smiles: item.smiles, name: item.name, formula: 'structural', highlight: [c] },
    );
  };
  const hiddenH = () => {
    const item = rng.pick(SMALL_CHAINS.filter((s) => carbons(mol(s.smiles)).length >= 3));
    const m = mol(item.smiles);
    const c = rng.pick(carbons(m));
    const h = m.atoms[c].hydrogens;
    const used = 4 - h;
    return orderedChoice(
      'Na fórmula de bastão os hidrogênios ficam ocultos. Quantos H estão ligados ao carbono destacado?',
      ['0', '1', '2', '3'],
      String(h),
      `Esse carbono já usa ${plural(used, 'ligação', 'ligações')} com a cadeia. Faltam ${4 - used} para chegar a 4, e quem completa são os hidrogênios.`,
      { smiles: item.smiles, name: item.name, highlight: [c] },
    );
  };
  const countC = () => {
    const item = rng.pick(SMALL_CHAINS.filter((s) => carbons(mol(s.smiles)).length >= 4));
    const n = carbons(mol(item.smiles)).length;
    return orderedChoice(
      'Quantos carbonos há nesta cadeia?',
      numberOptions(rng, n, 2),
      String(n),
      'Cada ponta e cada vértice da fórmula de bastão é um carbono. Contando todos, são ' + n + '.',
      { smiles: item.smiles, name: item.name },
    );
  };
  const molecular = () => {
    const item = rng.pick(SMALL_CHAINS.filter((s) => carbons(mol(s.smiles)).length >= 3));
    const m = mol(item.smiles);
    const f = m.formula();
    const c = carbons(m).length;
    const h = m.atoms.reduce((s, a) => s + a.hydrogens, 0);
    return choice(
      rng,
      'Qual é a fórmula molecular desta substância?',
      subscript(f),
      [`C${c}H${h + 2}`, `C${c}H${Math.max(2, h - 2)}`, `C${c + 1}H${h}`, `C${c - 1}H${h}`].map(subscript).slice(0, 3),
      `Conte ${c} carbonos e complete cada um até 4 ligações com H: ${h} hidrogênios, ${subscript(f)}.`,
      { smiles: item.smiles, name: item.name },
    );
  };
  return lessonSet(rng, [countBonds, hiddenH, countC, hiddenH, molecular, countBonds, hiddenH, countC]);
}

export function threeFormulas(rng: Rng): Exercise[] {
  const pool = [...ALKANES.slice(1, 12), ...ALKENES.slice(1, 7), ...ALKYNES.slice(1, 4), ...FUNCTION_EXAMPLES.slice(1, 3), ...FUNCTION_EXAMPLES.slice(8, 13), ...FUNCTION_EXAMPLES.slice(22, 25)];
  const toSkeletal = () => {
    const target = rng.pick(pool);
    const others = lookalikes(rng, target, pool, 2);
    return pick(
      rng,
      'Qual fórmula de bastão representa a mesma substância?',
      { smiles: target.smiles, name: target.name },
      others.map((o) => ({ smiles: o.smiles, name: o.name })),
      `É o ${target.name}. Na fórmula de bastão cada vértice é um carbono, e os hidrogênios ficam subentendidos.`,
      { smiles: target.smiles, formula: rng.pick(['structural', 'condensed', 'plana'] as const) },
    );
  };
  const toCondensed = () => {
    const target = rng.pick(pool);
    const others = lookalikes(rng, target, pool, 2);
    return pick(
      rng,
      'Qual fórmula condensada corresponde a esta fórmula de bastão?',
      { smiles: target.smiles, name: target.name, formula: 'condensed' },
      others.map((o) => ({ smiles: o.smiles, name: o.name, formula: 'condensed' as const })),
      `Escreva cada carbono com seus hidrogênios (CH₃, CH₂, CH…) e mantenha as ligações: é o ${target.name}.`,
      { smiles: target.smiles },
    );
  };
  const isomers = () => {
    const groups = new Map<string, Named[]>();
    for (const p of ALKANES) {
      const f = mol(p.smiles).formula();
      groups.set(f, [...(groups.get(f) ?? []), p]);
    }
    const candidates = [...groups.values()].filter((g) => g.length >= 2);
    if (rng.next() < 0.5) {
      const [a, b] = rng.sample(rng.pick(candidates), 2);
      const formula = subscript(mol(a.smiles).formula());
      return orderedChoice(
        'Estas duas estruturas têm a mesma fórmula molecular?',
        ['Sim', 'Não'],
        'Sim',
        `As duas são ${formula}: ${a.name} e ${b.name}. Mesma fórmula, estruturas diferentes: são isômeros.`,
        { smiles: `${a.smiles}.${b.smiles}` },
      );
    }
    const a = rng.pick(ALKANES.slice(2));
    const b = rng.pick(ALKANES.filter((x) => mol(x.smiles).formula() !== mol(a.smiles).formula()));
    return orderedChoice(
      'Estas duas estruturas têm a mesma fórmula molecular?',
      ['Sim', 'Não'],
      'Não',
      `Conte os carbonos: ${a.name} é ${subscript(mol(a.smiles).formula())} e ${b.name} é ${subscript(mol(b.smiles).formula())}.`,
      { smiles: `${a.smiles}.${b.smiles}` },
    );
  };
  return lessonSet(rng, [toSkeletal, toCondensed, toSkeletal, isomers, toCondensed, toSkeletal, toCondensed, isomers]);
}

const CLASS_PLURAL: Record<CarbonClass, string> = {
  primário: 'primários',
  secundário: 'secundários',
  terciário: 'terciários',
  quaternário: 'quaternários',
};
const CLASS_COUNT: Record<CarbonClass, number> = { primário: 1, secundário: 2, terciário: 3, quaternário: 4 };

export function carbonClasses(rng: Rng): Exercise[] {
  const branched = [...ALKANES.slice(6), { smiles: 'CC(C)(C)C(C)CC', name: '2,2,3-trimetilpentano' }];
  const tapClass = () => {
    const item = rng.pick(branched);
    const m = mol(item.smiles);
    const byClass = carbonsByClass(m);
    const options = (Object.keys(byClass) as CarbonClass[]).filter((k) => byClass[k].length);
    const cls = rng.pick(options);
    return tap(
      `Toque em todos os carbonos ${CLASS_PLURAL[cls]}.`,
      { smiles: item.smiles, name: item.name },
      byClass[cls],
      `Carbono ${cls} está ligado a ${plural(CLASS_COUNT[cls], 'outro carbono', 'outros carbonos')}. Nesta cadeia há ${byClass[cls].length}.`,
      carbons(m),
    );
  };
  const countClass = () => {
    const item = rng.pick(branched);
    const m = mol(item.smiles);
    const byClass = carbonsByClass(m);
    const cls = rng.pick(Object.keys(byClass) as CarbonClass[]);
    const n = byClass[cls].length;
    return orderedChoice(
      `Quantos carbonos ${CLASS_PLURAL[cls]} há nesta cadeia?`,
      numberOptions(rng, n),
      String(n),
      `Procure carbonos ligados a exatamente ${plural(CLASS_COUNT[cls], 'carbono', 'carbonos')}: nesta cadeia há ${n}.`,
      { smiles: item.smiles, name: item.name },
    );
  };
  const definition = () => {
    const cls = rng.pick(['primário', 'secundário', 'terciário', 'quaternário'] as const);
    return choice(
      rng,
      `Um carbono ligado a ${plural(CLASS_COUNT[cls], 'outro carbono', 'outros carbonos')} é chamado de…`,
      cap(cls),
      ['Primário', 'Secundário', 'Terciário', 'Quaternário'],
      'A classificação conta só os carbonos vizinhos: 1 primário, 2 secundário, 3 terciário, 4 quaternário.',
    );
  };
  return lessonSet(rng, [tapClass, countClass, tapClass, definition, tapClass, countClass, tapClass, countClass]);
}

// ---------------------------------------------------------------------------
// Unidade 2 — cadeias carbônicas

export function openClosedBranched(rng: Rng): Exercise[] {
  const openClosed = () => {
    const item = rng.pick(CHAINS);
    const fechada = classifyChain(mol(item.smiles)).fechada;
    return orderedChoice(
      'Quanto à disposição dos carbonos, esta cadeia é:',
      ['Aberta', 'Fechada'],
      fechada ? 'Fechada' : 'Aberta',
      fechada
        ? 'Os carbonos formam um anel, então a cadeia é fechada (cíclica).'
        : 'Os carbonos não formam anel: a cadeia tem pontas livres, então é aberta (acíclica).',
      { smiles: item.smiles, name: item.name },
    );
  };
  // Textbooks disagree on whether heteroatoms count as branches, so stick to hydrocarbons.
  const open = CHAINS.filter((c) => !classifyChain(mol(c.smiles)).fechada && hydrocarbonClass(mol(c.smiles)));
  const normalBranched = () => {
    const item = rng.pick(open);
    const ram = classifyChain(mol(item.smiles)).ramificada;
    return orderedChoice(
      'Esta cadeia aberta é normal ou ramificada?',
      ['Normal', 'Ramificada'],
      ram ? 'Ramificada' : 'Normal',
      ram
        ? 'Há um carbono terciário ou quaternário: a cadeia tem mais de duas pontas, então é ramificada.'
        : 'Só existem duas pontas, sem carbono terciário ou quaternário: a cadeia é normal (reta).',
      { smiles: item.smiles, name: item.name },
    );
  };
  const branchPoint = () => {
    const item = rng.pick(open.filter((c) => classifyChain(mol(c.smiles)).ramificada));
    const m = mol(item.smiles);
    const points = carbons(m).filter((c) => carbonNeighbors(m, c) >= 3);
    return tap(
      'Toque no carbono onde a cadeia se ramifica.',
      { smiles: item.smiles, name: item.name },
      points,
      'A ramificação nasce em carbonos terciários ou quaternários, ligados a 3 ou 4 outros carbonos.',
      carbons(m),
    );
  };
  return lessonSet(rng, [openClosed, normalBranched, branchPoint, openClosed, normalBranched, branchPoint, openClosed, normalBranched]);
}

export function saturation(rng: Rng): Exercise[] {
  const pool = CHAINS;
  const satQ = () => {
    const item = rng.pick(pool);
    const ins = classifyChain(mol(item.smiles)).insaturada;
    return orderedChoice(
      'Esta cadeia é saturada ou insaturada?',
      ['Saturada', 'Insaturada'],
      ins ? 'Insaturada' : 'Saturada',
      ins
        ? 'Existe ligação dupla ou tripla entre carbonos: a cadeia é insaturada.'
        : 'Só há ligações simples entre os carbonos: a cadeia é saturada.',
      { smiles: item.smiles, name: item.name },
    );
  };
  const tapUnsat = () => {
    const item = rng.pick(pool.filter((c) => classifyChain(mol(c.smiles)).insaturada && !classifyChain(mol(c.smiles)).aromatica));
    const m = mol(item.smiles);
    const atoms = new Set<number>();
    for (const b of m.bonds) {
      if (b.order > 1 && m.atoms[b.a].element === 'C' && m.atoms[b.b].element === 'C') {
        atoms.add(b.a);
        atoms.add(b.b);
      }
    }
    return tap(
      'Toque nos dois carbonos da insaturação.',
      { smiles: item.smiles, name: item.name },
      [...atoms],
      'A insaturação é a ligação dupla ou tripla entre carbonos; ela envolve os dois carbonos que ela une.',
      carbons(m),
    );
  };
  const carbonyl = () =>
    orderedChoice(
      'A propanona tem uma ligação dupla C=O. A cadeia carbônica dela é:',
      ['Saturada', 'Insaturada'],
      'Saturada',
      'A dupla C=O não é entre carbonos. Para a cadeia ser insaturada, a dupla ou tripla precisa ligar dois carbonos.',
      { smiles: 'CC(C)=O', name: 'propanona' },
    );
  return lessonSet(rng, [satQ, tapUnsat, satQ, carbonyl, satQ, tapUnsat, satQ, tapUnsat]);
}

export function heteroChains(rng: Rng): Exercise[] {
  const pool = [...CHAINS, ...FUNCTION_EXAMPLES].filter((f) => !f.smiles.includes('.') && carbons(mol(f.smiles)).length >= 2);
  const heteroQ = () => {
    const item = rng.pick(pool.filter((p) => mol(p.smiles).atoms.some((a) => a.element !== 'C')));
    const het = classifyChain(mol(item.smiles)).heterogenea;
    return orderedChoice(
      'Esta cadeia é homogênea ou heterogênea?',
      ['Homogênea', 'Heterogênea'],
      het ? 'Heterogênea' : 'Homogênea',
      het
        ? 'Há um heteroátomo (O, N, S…) entre dois carbonos, dentro da cadeia: ela é heterogênea.'
        : 'Os heteroátomos, se houver, ficam na ponta (como no –OH): entre carbonos só há carbonos, então é homogênea.',
      { smiles: item.smiles, name: item.name },
    );
  };
  const tapHetero = () => {
    const item = rng.pick(pool.filter((p) => classifyChain(mol(p.smiles)).heterogenea));
    const m = mol(item.smiles);
    const het = m.atoms
      .filter((a) => a.element !== 'C' && m.neighbors(a.index).filter((n) => m.atoms[n].element === 'C').length >= 2)
      .map((a) => a.index);
    return tap(
      'Toque no heteroátomo que está entre dois carbonos.',
      { smiles: item.smiles, name: item.name },
      het,
      'Heteroátomo é todo átomo diferente de carbono que fica entre dois carbonos da cadeia.',
      m.atoms.map((a) => a.index),
    );
  };
  return lessonSet(rng, [heteroQ, tapHetero, heteroQ, heteroQ, tapHetero, heteroQ, tapHetero, heteroQ]);
}

// ---------------------------------------------------------------------------
// Unidade 3 — hidrocarbonetos

const HC_LABEL: Record<string, string> = {
  alcano: 'Alcano',
  alceno: 'Alceno',
  alcino: 'Alcino',
  alcadieno: 'Alcadieno',
  cicloalcano: 'Cicloalcano',
  cicloalceno: 'Cicloalceno',
  aromático: 'Aromático',
};
const HC_WHY: Record<string, string> = {
  alcano: 'Cadeia aberta só com ligações simples: alcano (infixo -an-).',
  alceno: 'Cadeia aberta com uma ligação dupla: alceno (infixo -en-).',
  alcino: 'Cadeia aberta com uma ligação tripla: alcino (infixo -in-).',
  alcadieno: 'Cadeia aberta com duas ligações duplas: alcadieno (infixo -dien-).',
  cicloalcano: 'Cadeia fechada só com ligações simples: cicloalcano.',
  cicloalceno: 'Cadeia fechada com uma ligação dupla: cicloalceno.',
  aromático: 'Tem anel benzênico, com duplas alternadas: hidrocarboneto aromático.',
};

export function hydrocarbonClasses(rng: Rng): Exercise[] {
  const classify = () => {
    const item = rng.pick(HYDROCARBONS);
    const cls = hydrocarbonClass(mol(item.smiles))!;
    return choice(
      rng,
      'A que classe pertence este hidrocarboneto?',
      HC_LABEL[cls],
      rng.sample(Object.values(HC_LABEL).filter((l) => l !== HC_LABEL[cls]), 3),
      HC_WHY[cls],
      { smiles: item.smiles, name: item.name },
    );
  };
  const whichIs = () => {
    const cls = rng.pick(['alcano', 'alceno', 'alcino', 'aromático'] as const);
    const pools: Record<string, Named[]> = { alcano: ALKANES, alceno: ALKENES, alcino: ALKYNES, aromático: AROMATIC };
    const target = rng.pick(pools[cls]);
    const others = rng.sample(
      HYDROCARBONS.filter((h) => hydrocarbonClass(mol(h.smiles)) !== cls),
      2,
    );
    return pick(
      rng,
      `Qual destas estruturas é um ${HC_LABEL[cls].toLowerCase()}?`,
      { smiles: target.smiles, name: target.name },
      others.map((o) => ({ smiles: o.smiles, name: o.name })),
      HC_WHY[cls],
    );
  };
  return lessonSet(rng, [classify, classify, whichIs, classify, whichIs, classify, classify, whichIs]);
}

const PREFIXES = ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];

export function hydrocarbonNames(rng: Rng): Exercise[] {
  const pools = [ALKANES, ALKENES, ALKYNES, CYCLIC];
  const nameRule = (item: Named) => {
    const m = mol(item.smiles);
    const cls = hydrocarbonClass(m);
    const main = item.name.replace(/^[\d,]+-|^cis-|^trans-/, '');
    if (cls === 'alcano' && !/metil|etil/.test(item.name)) {
      return `${carbons(m).length} carbonos dão o prefixo "${PREFIXES[carbons(m).length]}-", só simples dão "-an-" e hidrocarboneto termina em "-o": ${main}.`;
    }
    if (/metil|etil/.test(item.name)) {
      return 'Ache a cadeia mais longa, numere pela ponta mais próxima da ramificação e cite os grupos (metil, etil) com suas posições: ' + item.name + '.';
    }
    return `Prefixo pelo número de carbonos, infixo pela ligação (-an-, -en-, -in-) e a posição da insaturação pelo menor número: ${item.name}.`;
  };
  const nameToStructure = () => {
    const pool = rng.pick(pools);
    const target = rng.pick(pool);
    const others = lookalikes(rng, target, pool, 2);
    return pick(rng, `Qual estrutura é o ${target.name}?`, { smiles: target.smiles }, others.map((o) => ({ smiles: o.smiles })), nameRule(target));
  };
  const structureToName = () => {
    const pool = rng.pick(pools);
    const target = rng.pick(pool);
    const others = lookalikes(rng, target, pool, 3);
    return choice(
      rng,
      'Qual é o nome IUPAC deste hidrocarboneto?',
      target.name,
      others.map((o) => o.name),
      nameRule(target),
      { smiles: target.smiles },
    );
  };
  return lessonSet(rng, [structureToName, nameToStructure, structureToName, nameToStructure]);
}

// ---------------------------------------------------------------------------
// Unidade 4 — funções orgânicas

const OXYGENATED: FunctionId[] = ['álcool', 'fenol', 'enol', 'aldeído', 'cetona', 'ácido carboxílico', 'éster', 'éter'];
const NITROGENATED: FunctionId[] = ['amina', 'amida', 'nitrila', 'nitrocomposto', 'haleto orgânico'];

function functionLesson(rng: Rng, family: FunctionId[]): Exercise[] {
  const examples = FUNCTION_EXAMPLES.filter((f) => {
    const fs = functionSet(mol(f.smiles));
    return fs.length === 1 && family.includes(fs[0]);
  });
  const highlighted = () => {
    const item = rng.pick(examples);
    const group = functionalGroups(mol(item.smiles))[0];
    return choice(
      rng,
      'Qual função orgânica está destacada?',
      cap(group.id),
      rng.sample(family.filter((f) => f !== group.id), 3).map(cap),
      `${FUNCTION_INFO[group.id].hint} Grupo ${FUNCTION_INFO[group.id].group}: ${group.id}.`,
      { smiles: item.smiles, name: item.name, highlight: group.atoms },
    );
  };
  const whichIs = () => {
    const target = rng.pick(examples);
    const fn = functionSet(mol(target.smiles))[0];
    const others = rng.sample(
      FUNCTION_EXAMPLES.filter((f) => !f.smiles.includes('.') && !functionSet(mol(f.smiles)).includes(fn)),
      2,
    );
    return pick(
      rng,
      `Qual destas substâncias é um(a) ${fn}?`,
      { smiles: target.smiles, name: target.name },
      others.map((o) => ({ smiles: o.smiles, name: o.name })),
      `${FUNCTION_INFO[fn].hint} É o caso do ${target.name}.`,
    );
  };
  return lessonSet(rng, [highlighted, whichIs, highlighted, highlighted, whichIs, highlighted, whichIs, highlighted]);
}

export const oxygenFunctions = (rng: Rng) => functionLesson(rng, OXYGENATED);
export const nitrogenFunctions = (rng: Rng) => functionLesson(rng, NITROGENATED);

export function everydayFunctions(rng: Rng): Exercise[] {
  const ALL: FunctionId[] = [...OXYGENATED, ...NITROGENATED];
  const entries = EVERYDAY.map((id) => MOLECULE_BY_ID[id]).filter(Boolean);
  const which = () => {
    const entry = rng.pick(entries);
    const fs = functionSet(mol(entry.smiles)).sort();
    const correct = cap(joinPt(fs));
    const distractors = new Set<string>();
    for (let tries = 0; distractors.size < 3 && tries < 40; tries++) {
      const swapped = [...fs];
      const k = rng.int(swapped.length);
      const replacement = rng.pick(ALL.filter((f) => !fs.includes(f)));
      if (rng.next() < 0.5 && swapped.length > 1) swapped.splice(k, 1);
      else swapped[k] = replacement;
      const text = cap(joinPt([...new Set(swapped)].sort()));
      if (text !== correct) distractors.add(text);
    }
    return choice(
      rng,
      'Quais funções orgânicas aparecem nesta estrutura?',
      correct,
      [...distractors],
      functionalGroups(mol(entry.smiles))
        .map((g) => `${cap(g.id)} (${FUNCTION_INFO[g.id].group})`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join('; ') + '.',
      {
        smiles: entry.smiles,
        name: entry.name,
        caption: entry.name,
        source: entry.note ? `(${lowerFirst(entry.note).replace(/\.$/, '')})` : undefined,
      },
    );
  };
  const spot = () => {
    const entry = rng.pick(entries);
    const groups = functionalGroups(mol(entry.smiles));
    const group = rng.pick(groups);
    return choice(
      rng,
      'Qual função orgânica está destacada?',
      cap(group.id),
      rng.sample(ALL.filter((f) => f !== group.id), 3).map(cap),
      FUNCTION_INFO[group.id].hint,
      { smiles: entry.smiles, name: entry.name, highlight: group.atoms, caption: entry.name },
    );
  };
  return lessonSet(rng, [which, spot, which, spot, which, spot, which, which]);
}

// ---------------------------------------------------------------------------
// Unidade 5 — isomeria

export function geometricIsomerism(rng: Rng): Exercise[] {
  const cisTrans = () => {
    const item = rng.pick(GEOMETRIC);
    return orderedChoice(
      'Este isômero é cis ou trans?',
      ['cis', 'trans'],
      item.cis ? 'cis' : 'trans',
      item.cis
        ? `Os grupos principais ficam do mesmo lado da ligação dupla: isômero cis (${item.name}).`
        : `Os grupos principais ficam em lados opostos da ligação dupla: isômero trans (${item.name}).`,
      { smiles: item.smiles, name: item.name },
    );
  };
  const hasIsomers = () => {
    const item = rng.pick(MAYBE_GEOMETRIC);
    const yes = geometricDoubleBonds(mol(item.smiles)).length > 0;
    return orderedChoice(
      'Esta substância apresenta isomeria geométrica (cis-trans)?',
      ['Sim', 'Não'],
      yes ? 'Sim' : 'Não',
      yes
        ? 'Cada carbono da dupla tem dois ligantes diferentes, então existem as formas cis e trans.'
        : 'Um dos carbonos da dupla tem dois ligantes iguais (como dois H ou dois CH₃), então não há cis e trans.',
      { smiles: item.smiles, name: item.name },
    );
  };
  return lessonSet(rng, [cisTrans, hasIsomers, cisTrans, hasIsomers, cisTrans, cisTrans, hasIsomers, cisTrans]);
}

export function chirality(rng: Rng): Exercise[] {
  const withChiral = CHIRAL.filter((c) => chiralCarbons(mol(c.smiles)).length > 0);
  const tapChiral = () => {
    const item = rng.pick(withChiral);
    const m = mol(item.smiles);
    const chiral = chiralCarbons(m);
    return tap(
      chiral.length > 1 ? 'Toque em todos os carbonos quirais.' : 'Toque no carbono quiral.',
      { smiles: item.smiles, name: item.name },
      chiral,
      `Carbono quiral (assimétrico) tem quatro ligantes diferentes entre si. No(a) ${item.name} há ${chiral.length}.`,
      carbons(m),
    );
  };
  const countChiral = () => {
    const item = rng.pick(CHIRAL);
    const n = chiralCarbons(mol(item.smiles)).length;
    return orderedChoice(
      'Quantos carbonos quirais há nesta estrutura?',
      ['0', '1', '2', '3'],
      String(n),
      n
        ? `${plural(n, 'carbono tem', 'carbonos têm')} quatro ligantes diferentes. Cada um gera atividade óptica.`
        : 'Nenhum carbono tem quatro ligantes diferentes: sempre há dois grupos iguais (como dois CH₃ ou dois H).',
      { smiles: item.smiles, name: item.name },
    );
  };
  const definition = () =>
    choice(
      rng,
      'Para um carbono ser quiral, ele precisa:',
      'Ter quatro ligantes diferentes',
      ['Fazer uma ligação dupla', 'Estar em um anel', 'Ter quatro hidrogênios'],
      'O carbono quiral é sp³ e tem quatro grupos diferentes. Isso faz a molécula e sua imagem no espelho serem diferentes (enantiômeros).',
    );
  return lessonSet(rng, [tapChiral, countChiral, tapChiral, definition, tapChiral, countChiral, tapChiral, countChiral]);
}
