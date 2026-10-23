/**
 * Why a compound has its name, in the steps a teacher would write on the board: what kind of
 * compound it is, the charge or oxidation number that picks the suffix or numeral, and the
 * rule that turns them into the name. Lines use **bold** for the key terms.
 */
import { type Compound, parentAcid, radicalFor } from './catalog.ts';
import { balance, counts, ionText, pretty } from './formula.ts';
import { ROMAN, compose } from './pieces.ts';

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

const STEPS = { acido: acidSteps, base: baseSteps, sal: saltSteps };

export function explain(c: Compound): string[] {
  const lines = STEPS[c.category](c);
  // Fosfato is also ortofosfato, silicato also metassilicato.
  const others = c.answers.slice(1).map((g) => `**${compose(c.category, g)}**`);
  if (others.length) lines.push(`Também vale: ${others.join(', ')}.`);
  return lines;
}
