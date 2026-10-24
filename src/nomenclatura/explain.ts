/**
 * Why a compound has its name, in the steps a teacher would write on the board: what kind of
 * compound it is, the charge or oxidation number that picks the suffix or numeral (or, for an
 * organic compound, the chain, its bonds and the function), and the rule that turns them into the
 * name. Lines use **bold** for the key terms.
 */
import { type Compound, parentAcid, radicalFor } from './catalog.ts';
import { balance, counts, ionText, pretty } from './formula.ts';
import { GROUPS, type OrgFunction, type OrgParts, STEMS, numberable, prefixText, render } from './organic.ts';
import { ROMAN } from './pieces.ts';

interface Step {
  nox: number;
  prefixo?: string;
  sufixo: 'oso' | 'ico';
}

/** The oxyacids of each element, by oxidation number: the pattern hipo…oso, …oso, …ico, per…ico. */
const SERIES: Record<string, readonly Step[]> = {
  clor: [
    { nox: 1, prefixo: 'hipo', sufixo: 'oso' },
    { nox: 3, sufixo: 'oso' },
    { nox: 5, sufixo: 'ico' },
    { nox: 7, prefixo: 'per', sufixo: 'ico' },
  ],
  sulf: [
    { nox: 4, sufixo: 'oso' },
    { nox: 6, sufixo: 'ico' },
  ],
  nitr: [
    { nox: 3, sufixo: 'oso' },
    { nox: 5, sufixo: 'ico' },
  ],
  fosf: [
    { nox: 1, prefixo: 'hipo', sufixo: 'oso' },
    { nox: 3, sufixo: 'oso' },
    { nox: 5, sufixo: 'ico' },
  ],
  mangan: [
    { nox: 6, sufixo: 'ico' },
    { nox: 7, prefixo: 'per', sufixo: 'ico' },
  ],
};
SERIES.brom = SERIES.clor;
SERIES.iod = SERIES.clor;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const stepText = (s: Step) => `${signed(s.nox)} ${s.prefixo ? `${s.prefixo}…` : '…'}${s.sufixo}`;
const times = (n: number, what: string) => (n === 1 ? what : `${n}·${what}`);

function acidSteps(c: Compound): string[] {
  const answer = c.answers[0];
  const r = radicalFor(answer.radical!);
  const atoms = counts(c.formula);
  const h = atoms.H ?? 0;
  const o = atoms.O ?? 0;
  const lines = [`Começa com H e libera H⁺ na água: é um **ácido**.`];

  if (answer.sufixo === 'idrico') {
    lines.push(`Não tem oxigênio: é um **hidrácido** → ácido + nome do elemento + **-ídrico**.`);
    if (r.id === 'cian') lines.push(`O grupo CN se comporta como um halogênio: HCN → ácido **cian**ídrico.`);
    lines.push(`→ **${c.name}**.`);
    return lines;
  }

  lines.push(`Tem oxigênio: é um **oxiácido**, e o sufixo depende do Nox do elemento central.`);
  if (r.id === 'cian') {
    if (answer.prefixo === 'tio') lines.push(`Troque o O do HCNO (ácido ciânico) por S: **tio**ciânico.`);
    else lines.push(`É o par oxigenado do HCN (ácido cianídrico): o ânion CNO⁻ se chama cianato, e o ácido, **ciânico**.`);
    lines.push(`→ **${c.name}**.`);
    return lines;
  }
  if (answer.prefixo === 'tio') {
    lines.push(`**tio-** quer dizer que um O foi trocado por S: H₂SO₄ (sulfúrico) → H₂S₂O₃ (**tio**ssulfúrico).`);
    lines.push(`→ **${c.name}**.`);
    return lines;
  }

  const x = atoms[r.symbol] ?? 1;
  const nox = (2 * o - h) / x;
  lines.push(`Nox do ${r.element}: ${times(h, '(+1)')} + ${x === 1 ? 'x' : `${x}x`} + ${times(o, '(−2)')} = 0 → x = **${signed(nox)}**.`);

  const series = SERIES[r.id];
  if (series) {
    const shown = series.map((s) => (s.nox === nox ? `**${stepText(s)}**` : stepText(s))).join(' · ');
    lines.push(`Série do ${r.element}: ${shown}.`);
  } else {
    lines.push(`É o oxiácido comum do ${r.element}, então leva a terminação **-ico**.`);
  }

  switch (answer.prefixo) {
    case 'meta':
      lines.push(
        r.id === 'fosf'
          ? `**meta-** = orto − 1 H₂O: H₃PO₄ − H₂O = HPO₃ (o Nox continua ${signed(nox)}).`
          : `**meta-** = orto − 1 H₂O: H₄SiO₄ − H₂O = H₂SiO₃.`,
      );
      break;
    case 'piro':
      lines.push(`**piro-** = 2 orto − 1 H₂O: 2 H₃PO₄ − H₂O = H₄P₂O₇ (o Nox continua ${signed(nox)}).`);
      break;
    case 'orto':
      lines.push(`**orto-** é o ácido mais hidratado da família: H₂SiO₃ + H₂O = H₄SiO₄.`);
      break;
    case 'di':
      lines.push(`**di-** = dois átomos de cromo: 2 H₂CrO₄ − H₂O = H₂Cr₂O₇ (o Nox continua ${signed(nox)}).`);
      break;
  }
  lines.push(`→ **${c.name}**.`);
  return lines;
}

/** "3 SO₄²⁻ dão carga −6; dividida entre 2 Fe, cada um é Fe³⁺", then whether the name needs the numeral. */
function cationSteps(c: Compound, anion: string, anions: number, anionCharge: number): string[] {
  const { piece, charge } = c.cation!;
  const ion = ionText(piece.symbol, charge);
  const cations = (anions * anionCharge) / charge;
  const symbol = pretty(piece.symbol);
  const sum = `${anions} ${anion} ${anions === 1 ? 'dá' : 'dão'} carga ${signed(-anions * anionCharge)}`;
  const each = cations === 1 ? `o ${symbol} é` : `dividida entre ${cations} ${symbol}, cada um é`;
  const count = `${pretty(c.formula)}: ${sum}; ${each} **${ion}**.`;
  if (piece.charges.length === 1) return [`${count} O ${piece.label} só forma ${ion}, então **não** leva número romano.`];
  const all = piece.charges.map((q) => ionText(piece.symbol, q)).join(' ou ');
  const lines = [`${count} O ${piece.label} pode ser ${all}, então a carga vai em romano: **${piece.label}(${ROMAN[charge]})**.`];
  const trad = piece.traditional?.[charge];
  if (trad) lines.push(`No nome tradicional, -oso é a carga menor e -ico a maior: **${trad}**.`);
  return lines;
}

function baseSteps(c: Compound): string[] {
  return [
    `Cátion + hidroxila (OH⁻): é uma **base** → **hidróxido de** + nome do cátion.`,
    ...cationSteps(c, 'OH⁻', c.cation!.charge, 1),
    `→ **${c.name}**.`,
  ];
}

const SUFFIX_RULE = { eto: '-ídrico → **-eto**', ito: '-oso → **-ito**', ato: '-ico → **-ato**' } as const;

function saltSteps(c: Compound): string[] {
  const a = c.anion!;
  const { charge } = c.cation!;
  const anion = ionText(a.formula, -a.charge);
  const lines = [`Cátion + ânion de um ácido: é um **sal** → nome do ânion + **de** + nome do cátion.`];

  const acid = parentAcid(a);
  if (a.prefixo === 'hidrogeno' || a.prefixo === 'di-hidrogeno') {
    const kept = a.prefixo === 'hidrogeno' ? '1 H' : '2 H';
    lines.push(`${anion} vem do ${acid} e ainda guarda ${kept}: **${a.prefixo}**${a.name.slice(a.prefixo.length)}${a.common ? ` (o popular ${a.common})` : ''}.`);
  } else {
    lines.push(`${anion} vem do ${acid}: ${SUFFIX_RULE[a.sufixo]} (${a.name}).`);
  }

  lines.push(...cationSteps(c, anion, balance(charge, a.charge).anions, a.charge));
  lines.push(`→ **${c.name}**.`);
  return lines;
}

/** What the function is, and what it puts in the name. */
const FUNCTION_STEP: Record<OrgFunction, string> = {
  hidrocarboneto: 'Só carbono e hidrogênio: é um **hidrocarboneto** → o nome termina em **-o**.',
  alcool: 'OH ligado a carbono saturado: é um **álcool** → sufixo **-ol**.',
  fenol: 'OH ligado direto ao anel aromático: é um **fenol**.',
  aldeido: 'Carbonila na ponta da cadeia (–CHO): é um **aldeído** → sufixo **-al**.',
  cetona: 'Carbonila entre dois carbonos (C–CO–C): é uma **cetona** → sufixo **-ona**.',
  acido: 'Carboxila (–COOH): é um **ácido carboxílico** → **ácido** + cadeia + **-oico**.',
  ester: 'Grupo –COO– entre dois carbonos: é um **éster** → lado do C=O com **-oato**, **de**, e o grupo ligado ao O com **-ila**.',
  eter: 'Oxigênio entre dois carbonos: é um **éter** → o lado menor vira o prefixo **-oxi** do lado maior.',
  amina: 'Nitrogênio ligado a carbono, como na amônia: é uma **amina** → sufixo **-amina**.',
  amida: 'Carbonila ligada ao nitrogênio (–CONH₂): é uma **amida** → sufixo **-amida**.',
  haleto: 'Halogênio ligado ao carbono: é um **haleto orgânico** → o halogênio entra como prefixo (fluoro, cloro, bromo, iodo).',
  nitrila: 'Grupo –C≡N: é uma **nitrila** → sufixo **-nitrila**, e o C do CN conta na cadeia.',
  nitro: 'Grupo –NO₂ preso ao carbono: é um **nitrocomposto** → prefixo **nitro**.',
};

const COUNT = ['', 'Uma', 'Duas', 'Três', 'Quatro'];

/** "Uma ligação dupla → **-en-**, no carbono **2**." */
function bondStep(kind: 'dupla' | 'tripla', at: readonly number[], shown: boolean): string {
  const infix = `${['', '', 'di', 'tri'][at.length]}${kind === 'dupla' ? 'en' : 'in'}`;
  const plural = at.length > 1 ? `ligações ${kind}s` : `ligação ${kind}`;
  const where = shown ? `, ${at.length > 1 ? 'começando nos carbonos' : 'no carbono'} **${at.join(' e ')}**` : '';
  return `${COUNT[at.length]} ${plural} → **-${infix}-**${where}.`;
}

/** The chain and its prefix: "Cadeia principal: **3** carbonos → **prop**." */
function chainStep(fn: OrgFunction, p: OrgParts): string {
  if (p.parent === 'benzeno') return 'O anel aromático de seis carbonos é o **benzeno**, que dá o nome principal.';
  const n = p.parent;
  const carbons = `**${n}** ${n === 1 ? 'carbono' : 'carbonos'} → **${STEMS[n]}**`;
  if (p.ring) return `Cadeia fechada (anel) com ${carbons}, com **ciclo-** na frente.`;
  if (fn === 'ester') return `Lado do ácido (com o C=O): ${carbons}.`;
  if (fn === 'eter') return `Lado maior, a cadeia principal: ${carbons}.`;
  const what = fn === 'aldeido' || fn === 'acido' || fn === 'amida' || fn === 'nitrila' ? ', contando o carbono do grupo funcional' : '';
  return `Cadeia principal: ${carbons}${what}.`;
}

function organicSteps(c: Compound): string[] {
  const def = c.organic!;
  const lines = [FUNCTION_STEP[def.fn]];
  const p = def.parts;
  if (!p) {
    lines.push(def.note ?? `**${c.name}** é um nome que a IUPAC mantém, consagrado pelo uso.`);
    lines.push(`→ **${c.name}**.`);
    const others = c.names.slice(1).map((name) => `**${name}**`);
    if (others.length) lines.push(`Também vale: ${others.join(', ')}.`);
    return lines;
  }
  lines.push(chainStep(def.fn, p));
  const shown = !p.bare;
  if (p.parent !== 'benzeno') {
    if (p.en?.length) lines.push(bondStep('dupla', p.en, shown));
    if (p.in?.length) lines.push(bondStep('tripla', p.in, shown));
    if (!p.en?.length && !p.in?.length && p.parent > 1) lines.push('Só ligações simples entre carbonos → **-an-**.');
  }
  const numbered = /\d/.test(c.name);
  const located = p.suffix === 'ol' || p.suffix === 'ona' || p.suffix === 'amina';
  const first = p.suffix === 'al' || p.suffix === 'oico' || p.suffix === 'amida' || p.suffix === 'nitrila';
  if (numbered && first) {
    lines.push('O carbono do grupo funcional é sempre o **1**: numere a partir dele.');
  } else if (numbered && p.parent !== 'benzeno') {
    const near = located ? 'do grupo funcional' : p.en?.length || p.in?.length ? 'da insaturação' : 'das ramificações';
    lines.push(`Numere a cadeia pela ponta mais perto ${near}; cada número vem antes da parte que localiza.`);
  } else if (numbered) {
    lines.push('No anel, numere os grupos com os menores números possíveis.');
  }
  if (p.subs?.length) {
    const groups = [...new Set(p.subs.map((s) => s.group))]
      .sort((a, b) => a.localeCompare(b, 'pt'))
      .map((g) => `${g} (${GROUPS[g].formula})`)
      .join(', ');
    const several = p.subs.length > 1 ? ', em ordem alfabética' : '';
    const counted = p.subs.some((s) => s.at.length > 1) ? '; di-, tri- e tetra- contam os grupos iguais' : '';
    lines.push(`Prefixos: ${groups}${several}${counted} → **${prefixText(p.subs, shown)}**.`);
    if (p.subs.some((s) => s.at.includes('N'))) lines.push('**N-** diz que o grupo está no nitrogênio, não num carbono.');
  }
  if (p.alkyl) lines.push(`O grupo ligado ao O, ${GROUPS[p.alkyl].formula}, vira **${p.alkyl}a**.`);
  lines.push(`→ **${c.name}**.`);
  // Locants left out because they cannot vary, and the older style.
  const full = render(p, true, false);
  if (numberable(p) && full !== c.name) lines.push(`Não há outra posição possível, então os números podem ficar de fora (**${full}** também vale).`);
  const old = render(p, shown, true);
  if (old !== c.name) lines.push(`No estilo antigo, ainda comum, os números vão na frente: **${old}**. Também vale.`);
  if (def.also?.length) lines.push(`Também vale: ${def.also.map((n) => `**${n}**`).join(', ')}.`);
  return lines;
}

const STEPS = { acido: acidSteps, base: baseSteps, sal: saltSteps };

export function explain(c: Compound): string[] {
  if (c.category === 'organico') return organicSteps(c);
  const lines = STEPS[c.category](c);
  // Fosfato is also ortofosfato, silicato also metassilicato.
  const others = c.names.slice(1).map((name) => `**${name}**`);
  if (others.length) lines.push(`Também vale: ${others.join(', ')}.`);
  return lines;
}
