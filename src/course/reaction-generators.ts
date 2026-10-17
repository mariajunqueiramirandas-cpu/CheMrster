/**
 * Unit 6 — organic reactions. Products come from the reaction engine (src/chem/reactions.ts),
 * distractors from the classic mistakes: anti-Markovnikov, the wrong ring position,
 * over-oxidation, the ester read backwards.
 */
import { Draft } from '../chem/graph.ts';
import * as rx from '../chem/reactions.ts';
import {
  cap,
  choice,
  decimal,
  distinctFrom,
  drawn,
  joinPt,
  lessonSet,
  mol,
  numberOptions,
  of,
  orderedChoice,
  pick,
  plural,
  readableFormula,
  scheme,
  subscript,
  tap,
  the,
  to,
  unknown,
  written,
} from './kit.ts';
import { nameOf } from './names.ts';
import {
  ADDITION_ALKENES,
  ALCOHOLS,
  ALKANES,
  ALKENES,
  ALKYNES,
  ARENES,
  AROMATIC,
  CYCLIC,
  ESTER_ACIDS,
  ESTER_ALCOHOLS,
  type EsterPart,
  FUELS,
  PREFIX,
  SATURATED_FOR_SUBSTITUTION,
  SCENTED_ESTERS,
  UNSATURATED,
} from './pools.ts';
import type { Rng } from './random.ts';
import type { Exercise, MolSpec } from './types.ts';

const spec = (smiles: string, extra: Partial<MolSpec> = {}): MolSpec => ({ smiles, formula: readableFormula(smiles), ...extra });
const named = (smiles: string) => {
  const n = nameOf(smiles);
  return n ? ` Forma-se ${the(n)}.` : '';
};

// ---------------------------------------------------------------------------
// Adição

type Reagent = rx.AdditionReagent;
const REAGENTS: Reagent[] = ['H2', 'Br2', 'Cl2', 'HBr', 'HCl', 'H2O'];
const CATALYST: Partial<Record<Reagent, string>> = { H2: 'Ni', H2O: 'H⁺' };
const HALOGEN: Partial<Record<Reagent, string>> = { Br2: 'Br', Cl2: 'Cl', HBr: 'Br', HCl: 'Cl' };
/** The reagent a student confuses this one with. */
const SIBLING: Record<Reagent, Reagent> = { H2: 'H2O', H2O: 'H2', Br2: 'HBr', HBr: 'Br2', Cl2: 'HCl', HCl: 'Cl2' };

function additionWhy(reagent: Reagent, alkene: string): string {
  const x = HALOGEN[reagent];
  const markov = rx.markovnikovCarbon(alkene) !== undefined;
  switch (reagent) {
    case 'H2':
      return 'Hidrogenação: cada carbono da dupla recebe um H, com catalisador (Ni, Pt ou Pd). O alceno vira alcano.';
    case 'Br2':
    case 'Cl2':
      return `Halogenação: a dupla se abre e cada carbono dela recebe um ${x}, que ficam em carbonos vizinhos.`;
    case 'HBr':
    case 'HCl':
      return markov
        ? `Regra de Markovnikov: o H entra no carbono da dupla que já tem mais hidrogênios, e o ${x} no outro.`
        : `Os dois carbonos da dupla são equivalentes: o H entra em um e o ${x} no outro.`;
    case 'H2O':
      return markov
        ? 'Hidratação em meio ácido: o H vai para o carbono da dupla com mais hidrogênios e o OH para o outro (Markovnikov). Forma-se um álcool.'
        : 'Hidratação em meio ácido: o H entra em um carbono da dupla e o OH no outro, formando um álcool.';
  }
}

export function addition(rng: Rng): Exercise[] {
  const productOf = () => {
    const item = rng.pick(ADDITION_ALKENES);
    const reagent = rng.pick(REAGENTS);
    const product = rx.addition(item.smiles, reagent);
    if (!product) return undefined;
    const others = rng.shuffle(REAGENTS.filter((r) => r !== reagent && r !== SIBLING[reagent])).map((r) => rx.addition(item.smiles, r));
    const wrong = distinctFrom(
      product,
      [rx.addition(item.smiles, reagent, { antiMarkovnikov: true }), rx.addition(item.smiles, SIBLING[reagent]), ...others],
      2,
    );
    const ex = pick(rng, 'Qual é o produto desta adição?', spec(product), wrong.map((s) => spec(s)), additionWhy(reagent, item.smiles) + named(product));
    return {
      ...ex,
      scheme: scheme([drawn(item.smiles, { name: item.name }), written(rx.REAGENT_TEXT[reagent])], [unknown()], { over: CATALYST[reagent] }),
    };
  };

  const whichReagent = () => {
    const item = rng.pick(ADDITION_ALKENES);
    const x = rng.pick(['Cl', 'Br'] as const);
    const set: Reagent[] = ['H2', `${x}2`, `H${x}`, 'H2O'];
    const reagent = rng.pick(set);
    const product = rx.addition(item.smiles, reagent)!;
    const what: Record<Reagent, string> = {
      H2: 'Cada carbono da dupla ganhou um H: foi uma hidrogenação, com H₂.',
      Br2: 'Cada carbono da dupla ganhou um Br: foi uma halogenação, com Br₂.',
      Cl2: 'Cada carbono da dupla ganhou um Cl: foi uma halogenação, com Cl₂.',
      HBr: 'Um carbono da dupla ganhou H e o outro, Br: foi a adição de HBr.',
      HCl: 'Um carbono da dupla ganhou H e o outro, Cl: foi a adição de HCl.',
      H2O: 'Um carbono da dupla ganhou H e o outro, OH: foi uma hidratação (H₂O em meio ácido).',
    };
    const ex = choice(
      rng,
      `Que reagente transforma ${the(item.name)} neste produto?`,
      rx.REAGENT_TEXT[reagent],
      set.filter((r) => r !== reagent).map((r) => rx.REAGENT_TEXT[r]),
      what[reagent],
    );
    return { ...ex, scheme: scheme([drawn(item.smiles, { name: item.name }), unknown()], [drawn(product)]) };
  };

  const asymmetric = ADDITION_ALKENES.filter((a) => rx.markovnikovCarbon(a.smiles) !== undefined);
  const markovnikov = () => {
    const item = rng.pick(asymmetric);
    const reagent = rng.pick(['HBr', 'HCl', 'H2O'] as const);
    const m = mol(item.smiles);
    const [bond] = rx.carbonMultipleBonds(m, 2);
    const rich = rx.markovnikovCarbon(item.smiles)!;
    const h = m.atoms[rich].hydrogens;
    const partner = reagent === 'H2O' ? 'OH' : HALOGEN[reagent];
    return tap(
      `Na adição de ${rx.REAGENT_TEXT[reagent]} ${to(item.name)}, em qual carbono da dupla entra o hidrogênio?`,
      spec(item.smiles, { name: item.name }),
      [rich],
      `Regra de Markovnikov: o H vai para o carbono da dupla que já tem mais hidrogênios (aqui o CH${h > 1 ? subscript(String(h)) : ''}), e o ${partner} vai para o outro.`,
      [bond.a, bond.b],
    );
  };

  const h2Count = () => {
    const item = rng.pick(UNSATURATED);
    const n = rx.h2ToSaturate(item.smiles);
    const doubles = rx.carbonMultipleBonds(item.smiles, 2).length;
    const triples = rx.carbonMultipleBonds(item.smiles, 3).length;
    const parts = [
      doubles ? `${plural(doubles, 'dupla', 'duplas')} (${doubles} H₂)` : '',
      triples ? `${plural(triples, 'tripla', 'triplas')} (${2 * triples} H₂)` : '',
    ].filter(Boolean);
    return orderedChoice(
      'Quantos mols de H₂ saturam todas as ligações C=C e C≡C de 1 mol desta substância?',
      numberOptions(rng, n, 1),
      String(n),
      `Cada dupla C=C consome 1 H₂ e cada tripla C≡C consome 2. Aqui há ${joinPt(parts)}: ${n} H₂ ao todo.`,
      spec(item.smiles, { name: item.name }),
    );
  };

  const bromineTest = () => {
    const target = rng.pick([...ALKENES, ...ALKYNES.slice(1), CYCLIC[5]]);
    const others = rng.sample([...ALKANES.slice(1, 9), ...CYCLIC.slice(2, 5), AROMATIC[0], AROMATIC[1]], 2);
    return pick(
      rng,
      'Qual destas substâncias descora rapidamente a solução castanho-avermelhada de bromo (Br₂)?',
      spec(target.smiles, { name: target.name }),
      others.map((o) => spec(o.smiles, { name: o.name })),
      'O Br₂ se adiciona à ligação dupla ou tripla e a cor some: é o teste de insaturação. Alcanos e cicloalcanos não fazem adição, e o anel benzênico, muito estável, também não descora o bromo sem catalisador.',
    );
  };

  const margarine = () =>
    choice(
      rng,
      'Na fabricação da margarina, óleos vegetais reagem com H₂ (catalisador de níquel). O que muda nas moléculas?',
      'Duplas C=C das cadeias viram simples e o óleo fica sólido',
      ['Ligações simples viram duplas e o óleo fica mais líquido', 'Os ésteres se quebram e formam sabão', 'O glicerol sai e sobram só os ácidos graxos'],
      'É uma hidrogenação: o H₂ se adiciona às duplas C=C. As cadeias ficam mais retas e se empacotam melhor, então o ponto de fusão sobe e a gordura fica sólida. A hidrogenação parcial pode gerar gorduras trans.',
    );

  return lessonSet(rng, [productOf, whichReagent, markovnikov, productOf, h2Count, bromineTest, productOf, margarine]);
}

// ---------------------------------------------------------------------------
// Substituição

const GROUP_TEXT: Record<rx.ArylGroup, string> = { NO2: '–NO₂', Cl: '–Cl', Br: '–Br', CH3: '–CH₃', SO3H: '–SO₃H' };

function directorWhy(sub: string, dir: 'orto-para' | 'meta'): string {
  if (dir === 'meta') {
    return `No ${sub}, o átomo ligado ao anel tem ligação dupla, tripla ou carga positiva. Grupos assim (–NO₂, –COOH, –CHO, –CN, –SO₃H) são meta-dirigentes e desativam o anel.`;
  }
  if (sub === '–Cl' || sub === '–Br') return `Halogênios como o ${sub} são orto-para-dirigentes, embora desativem um pouco o anel.`;
  return `O ${sub} só faz ligações simples com o anel e tem elétrons para doar: é orto-para-dirigente e ativa o anel.`;
}

export function substitution(rng: Rng): Exercise[] {
  const countMono = () => {
    const item = rng.pick(SATURATED_FOR_SUBSTITUTION);
    const n = rx.monohalogenation(item.smiles, 'Cl').length;
    return orderedChoice(
      'Quantos derivados monoclorados diferentes podem se formar na cloração (Cl₂, luz) deste hidrocarboneto?',
      numberOptions(rng, n, 1),
      String(n),
      `Hidrogênios em carbonos equivalentes por simetria dão o mesmo produto. Aqui há ${plural(n, 'tipo', 'tipos')} de carbono com H, então ${plural(n, 'produto', 'produtos')} (sem contar isômeros ópticos).`,
      spec(item.smiles, { name: item.name }),
    );
  };

  const brominable = SATURATED_FOR_SUBSTITUTION.filter((s) => rx.mainBromination(s.smiles) && rx.monohalogenation(s.smiles, 'Br').length >= 2);
  const mainBromo = () => {
    const item = rng.pick(brominable);
    const main = rx.mainBromination(item.smiles)!;
    const others = rx.monohalogenation(item.smiles, 'Br').filter((p) => p.carbons[0] !== main.carbons[0]);
    const d = new Draft(item.smiles);
    d.attach(main.carbons[0], 'Br');
    d.attach(others[0].carbons[0], 'Br');
    const wrong = distinctFrom(main.smiles, [...rng.shuffle(others.map((o) => o.smiles)), d.smiles()], 2);
    const ex = pick(
      rng,
      'Qual é o produto principal desta bromação?',
      spec(main.smiles),
      wrong.map((s) => spec(s)),
      `O bromo é seletivo: troca de preferência o H do carbono mais ligado a outros carbonos (terciário > secundário > primário). Aqui o Br entra no carbono ${main.carbonClass}.${named(main.smiles)}`,
    );
    return {
      ...ex,
      scheme: scheme([drawn(item.smiles, { name: item.name }), written('Br₂')], [unknown(), written('HBr')], { over: 'luz' }),
    };
  };

  const director = () => {
    const item = rng.pick(ARENES);
    const dir = rx.director(item.smiles)!;
    const pos = rx.ringPositions(item.smiles)!;
    const group = mol(item.smiles).atoms.filter((a) => !pos.ring.includes(a.index)).map((a) => a.index);
    return orderedChoice(
      'O grupo destacado orienta uma nova substituição no anel para quais posições?',
      ['Orto e para', 'Meta'],
      dir === 'meta' ? 'Meta' : 'Orto e para',
      directorWhy(item.sub, dir),
      spec(item.smiles, { name: item.name, highlight: group }),
    );
  };

  const reactive = ARENES.filter((a) => a.groups.length);
  const reactionWord = (g: rx.ArylGroup) => rx.ARYL_REACTION[g].name.toLowerCase();

  const tapPositions = () => {
    const item = rng.pick(reactive);
    const group = rng.pick(item.groups);
    const dir = rx.director(item.smiles)!;
    const pos = rx.ringPositions(item.smiles)!;
    const answer = dir === 'meta' ? pos.meta : [...pos.orto, ...pos.para];
    return tap(
      `Na ${reactionWord(group)} ${of(item.name)}, em quais carbonos do anel o ${GROUP_TEXT[group]} pode entrar? Toque em todos.`,
      spec(item.smiles, { name: item.name }),
      answer,
      dir === 'meta'
        ? `O ${item.sub} é meta-dirigente: o novo grupo entra nas duas posições meta, separadas do ${item.sub} por um carbono.`
        : `O ${item.sub} é orto-para-dirigente: o novo grupo entra nas posições orto (vizinhas ao grupo) e para (oposta).`,
      [...pos.orto, ...pos.meta, ...pos.para],
    );
  };

  const ringProduct = () => {
    const item = rng.pick(reactive);
    const group = rng.pick(item.groups);
    const dir = rx.director(item.smiles)!;
    const position: rx.RingPosition = dir === 'meta' ? 'meta' : rng.pick(['orto', 'para'] as const);
    const correct = rx.aromaticSubstitution(item.smiles, group, position);
    const wrongPositions: rx.RingPosition[] = dir === 'meta' ? ['orto', 'para'] : ['meta'];
    const wrong = distinctFrom(
      correct,
      [...wrongPositions.map((p) => rx.aromaticSubstitution(item.smiles, group, p)), rx.ipsoSubstitution(item.smiles, group)],
      2,
    );
    const info = rx.ARYL_REACTION[group];
    const ex = pick(
      rng,
      dir === 'meta' ? 'Qual é o produto principal desta reação?' : 'Qual destes é um dos produtos principais desta reação?',
      spec(correct),
      wrong.map((s) => spec(s)),
      dir === 'meta'
        ? `O ${item.sub} é meta-dirigente: o ${GROUP_TEXT[group]} entra na posição meta.`
        : `O ${item.sub} é orto-para-dirigente: o ${GROUP_TEXT[group]} entra em orto ou em para (aqui, ${position}). Em meta quase não entra, e o ${item.sub} não é trocado.`,
    );
    return {
      ...ex,
      scheme: scheme([drawn(item.smiles, { name: item.name }), written(info.over)], [unknown(), written(info.byproduct)], { over: info.under }),
    };
  };

  const reactionName = () => {
    const group = rng.pick(['NO2', 'Cl', 'Br', 'CH3', 'SO3H'] as const);
    const info = rx.ARYL_REACTION[group];
    const product = rx.aromaticSubstitution('c1ccccc1', group);
    const ex = choice(
      rng,
      'Que reação transforma o benzeno neste produto?',
      info.name,
      ['Nitração', 'Halogenação', 'Alquilação de Friedel-Crafts', 'Sulfonação'],
      `${info.name}: um H do anel é trocado por ${GROUP_TEXT[group]}, usando ${info.over} com ${info.under}. Sai ${info.byproduct}.`,
    );
    return { ...ex, scheme: scheme([drawn('c1ccccc1', { name: 'benzeno' }), unknown()], [drawn(product)]) };
  };

  return lessonSet(rng, [countMono, director, ringProduct, mainBromo, tapPositions, reactionName, countMono, ringProduct]);
}

// ---------------------------------------------------------------------------
// Oxidação e combustão

/** The same skeleton with the C=O moved to a neighbouring carbon: aldehyde ↔ ketone mix-ups. */
function movedCarbonyl(smiles: string): string[] {
  const m = mol(smiles);
  const out: string[] = [];
  for (const o of m.atoms) {
    if (o.element !== 'O' || m.degree(o.index) !== 1 || m.bonds[m.adjacency[o.index][0]].order !== 2) continue;
    const c = m.neighbors(o.index)[0];
    if (m.neighbors(c).some((x) => m.atoms[x].element === 'O' && x !== o.index)) continue; // acids stay acids
    for (const n of m.neighbors(c)) {
      if (m.atoms[n].element !== 'C' || m.atoms[n].hydrogens < 2 || m.atoms[n].aromatic) continue;
      const d = new Draft(m);
      d.remove(o.index);
      d.attach(n, 'O', 2);
      out.push(d.smiles());
    }
  }
  return out;
}

const OXIDANT = { branda: 'K₂Cr₂O₇ / H⁺', energica: 'KMnO₄ / H⁺' };

export function oxidation(rng: Rng): Exercise[] {
  const kindOf = (smiles: string) => rx.alcohols(smiles)[0];
  const oxidizable = ALCOHOLS.filter((a) => kindOf(a.smiles).kind !== 'terciário');
  const tertiary = ALCOHOLS.filter((a) => kindOf(a.smiles).kind === 'terciário');

  const oxidationProduct = () => {
    const item = rng.pick(oxidizable);
    const { kind } = kindOf(item.smiles);
    const strength = kind === 'primário' ? rng.pick(['branda', 'energica'] as const) : 'energica';
    const product = rx.oxidizeAlcohol(item.smiles, strength)!;
    const other = kind === 'primário' ? rx.oxidizeAlcohol(item.smiles, strength === 'branda' ? 'energica' : 'branda') : undefined;
    const wrong = distinctFrom(
      product,
      [other, ...movedCarbonyl(product), ...movedCarbonyl(rx.oxidizeAlcohol(item.smiles, 'branda')!), rx.dehydration(item.smiles), rx.symmetricEther(item.smiles)],
      2,
    );
    const prompt =
      kind === 'secundário'
        ? 'Qual é o produto da oxidação deste álcool?'
        : strength === 'branda'
          ? 'Oxidação parcial: o produto é retirado do meio assim que se forma. O que se obtém?'
          : 'Com oxidante em excesso, qual é o produto final?';
    const why =
      kind === 'secundário'
        ? 'Álcool secundário oxida a cetona, e a oxidação para aí.'
        : strength === 'branda'
          ? 'Álcool primário oxida primeiro a aldeído. Retirado do meio, o aldeído não chega a ácido.'
          : 'Álcool primário oxida a aldeído e, com excesso de oxidante, a ácido carboxílico.';
    const ex = pick(rng, prompt, spec(product), wrong.map((s) => spec(s)), why + named(product));
    return {
      ...ex,
      scheme: scheme([drawn(item.smiles, { name: item.name })], [unknown()], { over: '[O]', under: OXIDANT[strength] }),
    };
  };

  const whatHappens = () => {
    const item = rng.pick(ALCOHOLS.filter((a) => a.smiles !== 'CO'));
    const { kind, oxygen, carbon } = kindOf(item.smiles);
    const answer = { primário: 'Vira ácido carboxílico', secundário: 'Vira cetona', terciário: 'Não se oxida' }[kind];
    const h = mol(item.smiles).atoms[carbon].hydrogens;
    const why = {
      primário: `O carbono do –OH tem ${h} H: o álcool é primário, oxida a aldeído e, com excesso de oxidante, a ácido carboxílico.`,
      secundário: 'O carbono do –OH tem 1 H: o álcool é secundário e oxida a cetona, e para aí.',
      terciário: 'O carbono do –OH não tem H para perder: álcool terciário não se oxida nessas condições.',
    }[kind];
    return choice(
      rng,
      'O que acontece com este álcool quando tratado com excesso de KMnO₄ em meio ácido?',
      answer,
      ['Vira ácido carboxílico', 'Vira cetona', 'Vira aldeído e para aí', 'Não se oxida'],
      why,
      spec(item.smiles, { name: item.name, highlight: [oxygen, carbon] }),
    );
  };

  const tertiaryPick = () => {
    const target = rng.pick(tertiary);
    const others = rng.sample(oxidizable, 2);
    return pick(
      rng,
      'Qual destes álcoois não é oxidado por KMnO₄ em meio ácido?',
      spec(target.smiles, { name: target.name }),
      others.map((o) => spec(o.smiles, { name: o.name })),
      `${cap(the(target.name))} é terciário: o carbono do –OH não tem hidrogênio para perder, então não se oxida. Álcoois primários e secundários se oxidam.`,
    );
  };

  const combustionO2 = () => {
    const item = rng.pick(FUELS);
    const { o2, co2, h2o } = rx.combustion(item.smiles);
    const o = mol(item.smiles).atoms.filter((a) => a.element === 'O').length;
    const start = Math.max(0.5, o2 - 0.5 * rng.int(4));
    const options = [0, 1, 2, 3].map((k) => decimal(start + 0.5 * k));
    const right = 2 * co2 + h2o;
    const ex = orderedChoice(
      `Quantos mols de O₂ a combustão completa de 1 mol de ${item.name} consome?`,
      options,
      decimal(o2),
      `Acerte C e H primeiro: ${co2} CO₂ e ${h2o} H₂O. Do lado dos produtos há ${right} átomos de O; ${
        o ? `${the(item.name)} já traz ${o}, então ${right - o} vêm do O₂` : 'todos vêm do O₂'
      }: ${right - o} ÷ 2 = ${decimal(o2)} O₂.`,
    );
    return {
      ...ex,
      scheme: scheme([drawn(item.smiles, { name: item.name }), written('O₂', '?')], [written('CO₂', String(co2)), written('H₂O', String(h2o))]),
    };
  };

  const incomplete = () =>
    rng.next() < 0.5
      ? choice(
          rng,
          'Com pouco oxigênio, a combustão de um combustível orgânico é incompleta. O que pode se formar, além de água?',
          'Monóxido de carbono (CO) e fuligem (C)',
          ['Só gás carbônico (CO₂)', 'Gás hidrogênio (H₂)', 'Ozônio (O₃)'],
          'Faltando O₂, parte do carbono não chega a CO₂: sai como CO, um gás tóxico, ou como carbono puro, a fuligem preta.',
        )
      : choice(
          rng,
          'Por que é perigoso usar um aquecedor a gás num banheiro fechado?',
          'O O₂ acaba, a combustão fica incompleta e forma CO, gás tóxico',
          ['A combustão completa produz um gás tóxico, o CO₂', 'O gás do botijão é tóxico mesmo sem queimar', 'O calor decompõe a água do banheiro'],
          'Sem renovação de ar, o oxigênio diminui e a combustão fica incompleta. O monóxido de carbono (CO) se liga à hemoglobina e impede o transporte de O₂ no sangue.',
        );

  const breathalyzer = () => {
    const ex = pick(
      rng,
      'No bafômetro, o dicromato de potássio (laranja) oxida o etanol do hálito e vira Cr³⁺ (verde). Qual é o primeiro produto orgânico dessa oxidação?',
      spec('CC=O', { name: 'etanal' }),
      [spec('C=C', { name: 'eteno' }), spec('CCOCC', { name: 'etoxietano' })],
      'O etanol é um álcool primário: oxida primeiro a etanal (aldeído), que pode continuar até ácido etanoico. A mudança de cor do cromo denuncia o álcool.',
    );
    return { ...ex, scheme: scheme([drawn('CCO', { name: 'etanol' })], [unknown()], { over: '[O]', under: 'K₂Cr₂O₇ / H⁺' }) };
  };

  return lessonSet(rng, [oxidationProduct, whatHappens, combustionO2, breathalyzer, tertiaryPick, combustionO2, incomplete, oxidationProduct]);
}

// ---------------------------------------------------------------------------
// Esterificação e hidrólise

const acidSmiles = (n: number) => (n === 1 ? 'OC=O' : `${'C'.repeat(n - 1)}C(=O)O`);
const alcoholSmiles = (n: number) => `${'C'.repeat(n)}O`;
const acidPart = (n: number): EsterPart => ({
  smiles: acidSmiles(n),
  n,
  name: `ácido ${PREFIX[n]}anoico`,
  part: `${PREFIX[n]}anoato`,
});
const alcoholPart = (n: number): EsterPart => ({
  smiles: alcoholSmiles(n),
  n,
  name: n <= 2 ? `${PREFIX[n]}anol` : `${PREFIX[n]}an-1-ol`,
  part: `${PREFIX[n]}ila`,
});

interface Ester {
  acid: EsterPart;
  alcohol: EsterPart;
  smiles: string;
  name: string;
  scent?: string;
}

const makeEster = (acid: EsterPart, alcohol: EsterPart, scent?: string): Ester => ({
  acid,
  alcohol,
  smiles: rx.esterify(acid.smiles, alcohol.smiles),
  name: `${acid.part} de ${alcohol.part}`,
  scent,
});

function randomEster(rng: Rng): Ester {
  if (rng.next() < 0.4) {
    const s = rng.pick(SCENTED_ESTERS);
    return makeEster(ESTER_ACIDS.find((a) => a.part === s.acid)!, ESTER_ALCOHOLS.find((a) => a.part === s.alcohol)!, s.scent);
  }
  return makeEster(rng.pick(ESTER_ACIDS), rng.pick(ESTER_ALCOHOLS));
}

/** Wrong (acid, alcohol) pairs a student might read off the ester: swapped, or one carbon off. */
function nearbyPairs(rng: Rng, e: Ester): Array<[EsterPart, EsterPart]> {
  const out: Array<[EsterPart, EsterPart]> = [];
  const { acid, alcohol } = e;
  if (acid.n && alcohol.n && acid.n <= 8 && alcohol.n <= 8) out.push([acidPart(alcohol.n), alcoholPart(acid.n)]);
  if (alcohol.n) for (const d of [1, -1]) if (alcohol.n + d >= 1 && alcohol.n + d <= 8) out.push([acid, alcoholPart(alcohol.n + d)]);
  if (acid.n) for (const d of [1, -1]) if (acid.n + d >= 1 && acid.n + d <= 8) out.push([acidPart(acid.n + d), alcohol]);
  for (const a of rng.shuffle(ESTER_ALCOHOLS)) if (a.part !== alcohol.part) out.push([acid, a]);
  for (const a of rng.shuffle(ESTER_ACIDS)) if (a.part !== acid.part) out.push([a, alcohol]);
  return out;
}

export function esterification(rng: Rng): Exercise[] {
  const esterProduct = () => {
    const e = randomEster(rng);
    const wrong = distinctFrom(
      e.smiles,
      nearbyPairs(rng, e).map(([a, b]) => rx.esterify(a.smiles, b.smiles)),
      2,
    );
    const ex = pick(
      rng,
      'Qual éster se forma nesta esterificação?',
      spec(e.smiles),
      wrong.map((s) => spec(s)),
      `O ácido perde o –OH e o álcool perde o H do –OH; juntos formam a água. O oxigênio que liga as duas partes do éster vem do álcool. Forma-se o ${e.name}.`,
    );
    return {
      ...ex,
      scheme: scheme([drawn(e.acid.smiles, { name: e.acid.name }), drawn(e.alcohol.smiles, { name: e.alcohol.name })], [unknown(), written('H₂O')], {
        over: 'H⁺',
        reversible: true,
      }),
    };
  };

  const esterName = () => {
    const e = randomEster(rng);
    const names = nearbyPairs(rng, e).map(([a, b]) => `${a.part} de ${b.part}`);
    return choice(
      rng,
      'Qual é o nome deste éster?',
      e.name,
      [...new Set(names)].filter((n) => n !== e.name).slice(0, 3),
      `A parte com a carbonila veio do ácido e dá a primeira palavra, terminada em "-ato" (${e.acid.name} → ${e.acid.part}). A parte presa ao oxigênio veio do álcool e termina em "-ila" (${e.alcohol.name} → ${e.alcohol.part}).`,
      spec(e.smiles, { source: e.scent ? `(${e.scent})` : undefined }),
    );
  };

  const esterOrigin = () => {
    const e = randomEster(rng);
    const pair = (a: EsterPart, b: EsterPart) => `${cap(a.name)} e ${b.name}`;
    const options = [...new Set(nearbyPairs(rng, e).map(([a, b]) => pair(a, b)))].filter((p) => p !== pair(e.acid, e.alcohol));
    return choice(
      rng,
      'Quais reagentes formam este éster numa esterificação?',
      pair(e.acid, e.alcohol),
      options.slice(0, 3),
      `Corte o éster no oxigênio da ponte: o lado com C=O vem ${of(e.acid.name)} e o outro lado, com o oxigênio, vem ${of(e.alcohol.name)}.`,
      spec(e.smiles, { caption: e.scent ? cap(e.name) : undefined, source: e.scent ? `(${e.scent})` : undefined }),
    );
  };

  const hydrolysis = () => {
    const e = randomEster(rng);
    const basic = rng.next() < 0.5;
    const salt = (a: EsterPart) => `${a.part} de sódio`;
    const acidPair = (a: EsterPart, b: EsterPart) => `${cap(a.name)} e ${b.name}`;
    const saltPair = (a: EsterPart, b: EsterPart) => `${cap(salt(a))} e ${b.name}`;
    const correct = basic ? saltPair(e.acid, e.alcohol) : acidPair(e.acid, e.alcohol);
    const swapped = nearbyPairs(rng, e)[0];
    const distractors = [
      basic ? acidPair(e.acid, e.alcohol) : saltPair(e.acid, e.alcohol),
      basic ? saltPair(swapped[0], swapped[1]) : acidPair(swapped[0], swapped[1]),
      `${cap(e.alcohol.name)} e água`,
    ];
    const ex = choice(
      rng,
      basic ? 'Quais são os produtos desta hidrólise em meio básico?' : 'Quais são os produtos desta hidrólise em meio ácido?',
      correct,
      distractors,
      basic
        ? 'Em meio básico, o ácido que se forma reage com a base: sai o sal (o ânion carboxilato com Na⁺) e o álcool. É assim que se faz sabão.'
        : 'A hidrólise é o caminho de volta da esterificação: a água quebra a ligação C–O da ponte e devolve o ácido e o álcool.',
    );
    return {
      ...ex,
      scheme: scheme([drawn(e.smiles), written(basic ? 'NaOH' : 'H₂O')], [unknown()], { over: basic ? undefined : 'H⁺' }),
    };
  };

  const labelled = () => {
    const alcohol = rng.pick([
      { smiles: 'C[18OH]', plain: 'CO', name: 'metanol', part: 'metila' },
      { smiles: 'CC[18OH]', plain: 'CCO', name: 'etanol', part: 'etila' },
    ]);
    const acidLabelled = rng.next() < 0.5;
    const acid = acidLabelled ? 'CC(=O)[18OH]' : 'CC(=O)O';
    const ex = choice(
      rng,
      acidLabelled
        ? `O oxigênio da hidroxila do ácido etanoico foi marcado com o isótopo ¹⁸O. Depois da esterificação com ${alcohol.name}, onde ele aparece?`
        : `O oxigênio ${of(alcohol.name)} foi marcado com o isótopo ¹⁸O. Depois da esterificação com ácido etanoico, onde ele aparece?`,
      acidLabelled ? 'Na água formada' : 'No éster, na ponte entre as duas partes',
      [acidLabelled ? 'No éster, na ponte entre as duas partes' : 'Na água formada', 'Na carbonila (C=O) do éster', 'Em nenhum produto: sai como O₂'],
      'O ácido perde o –OH inteiro e o álcool perde só o H do –OH. Por isso o oxigênio do álcool fica no éster, na ponte C–O–C, e a água leva o oxigênio da hidroxila do ácido.',
    );
    return {
      ...ex,
      scheme: scheme([drawn(acid), drawn(acidLabelled ? alcohol.plain : alcohol.smiles, { name: alcohol.name })], [written(`etanoato de ${alcohol.part}`), written('H₂O')], {
        over: 'H⁺',
        reversible: true,
      }),
    };
  };

  const tapBridge = () => {
    const e = randomEster(rng);
    const [site] = rx.esters(e.smiles);
    return tap(
      'Toque no oxigênio deste éster que veio do álcool.',
      spec(e.smiles, { name: e.name }),
      [site.bridge],
      'O álcool entra com o seu oxigênio e perde só o H. Esse O fica entre a carbonila e a cadeia do álcool, na ponte –C(=O)–O–C–; o O da carbonila veio do ácido.',
      [site.o, site.bridge],
    );
  };

  return lessonSet(rng, [esterProduct, esterName, esterOrigin, hydrolysis, tapBridge, labelled, esterName, esterProduct]);
}
