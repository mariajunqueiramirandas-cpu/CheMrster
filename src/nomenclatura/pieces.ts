/**
 * The parts an inorganic name is built from, as Brazilian textbooks teach IUPAC nomenclature:
 * a prefix and a suffix around an element's root (hipo·clor·oso, hidrogeno·carbon·ato), and the
 * cation with its charge in Roman numerals (ferro(III)). The catalog writes every name from its
 * parts, so the spelling rules live in one place.
 */

export type Category = 'acido' | 'base' | 'sal' | 'organico';

export const CATEGORIES: readonly Category[] = ['acido', 'base', 'sal', 'organico'];

export const CATEGORY_LABEL: Record<Category, string> = { acido: 'Ácido', base: 'Base', sal: 'Sal', organico: 'Orgânico' };
export const CATEGORY_PLURAL: Record<Category, string> = { acido: 'Ácidos', base: 'Bases', sal: 'Sais', organico: 'Orgânicos' };

export type SuffixId = 'idrico' | 'ico' | 'oso' | 'eto' | 'ato' | 'ito';

/** A name as its parts: prefix, element root and suffix for an acid or anion; cation and Roman numeral. */
export interface Parts {
  prefixo?: string;
  radical?: string;
  sufixo?: SuffixId;
  cation?: string;
  valencia?: string;
}

export interface Radical {
  id: string;
  /** As written in the formula. */
  symbol: string;
  /** The element's name, for explanations ("do enxofre"). */
  element: string;
  /** Stem before -ídrico, -eto, -ato and -ito: sulf·ato. */
  stem: string;
  /** Stressed stem before -ico: sulfúr·ico. */
  ico: string;
  /** Stem before -oso: sulfur·oso. */
  oso: string;
}

export interface Cation {
  id: string;
  /** As written in names: "sódio". */
  label: string;
  /** As written in the formula: Fe, NH4. */
  symbol: string;
  /** Charges it forms. More than one means the name needs the Roman numeral. */
  charges: readonly number[];
  /** Traditional names by charge: ferroso (Fe²⁺), férrico (Fe³⁺). */
  traditional?: Readonly<Record<number, string>>;
  /** Written in parentheses when there is more than one: (NH₄)₂SO₄. */
  polyatomic?: boolean;
}

const radical = (id: string, symbol: string, element: string, ico: string, oso = id): Radical => ({ id, symbol, element, stem: id, ico, oso });

export const RADICALS: readonly Radical[] = [
  radical('fluor', 'F', 'flúor', 'fluór'),
  radical('clor', 'Cl', 'cloro', 'clór'),
  radical('brom', 'Br', 'bromo', 'brôm'),
  radical('iod', 'I', 'iodo', 'iód'),
  radical('sulf', 'S', 'enxofre', 'sulfúr', 'sulfur'),
  radical('nitr', 'N', 'nitrogênio', 'nítr'),
  radical('fosf', 'P', 'fósforo', 'fosfór', 'fosfor'),
  radical('carbon', 'C', 'carbono', 'carbôn'),
  radical('silic', 'Si', 'silício', 'silíc'),
  radical('bor', 'B', 'boro', 'bór'),
  radical('crom', 'Cr', 'cromo', 'crôm'),
  radical('mangan', 'Mn', 'manganês', 'mangân'),
  radical('cian', 'CN', 'cianogênio', 'ciân'),
];

const cation = (
  id: string,
  label: string,
  symbol: string,
  charges: number[],
  extra: Partial<Pick<Cation, 'traditional' | 'polyatomic'>> = {},
): Cation => ({ id, label, symbol, charges, ...extra });

export const CATIONS: readonly Cation[] = [
  cation('litio', 'lítio', 'Li', [1]),
  cation('sodio', 'sódio', 'Na', [1]),
  cation('potassio', 'potássio', 'K', [1]),
  cation('amonio', 'amônio', 'NH4', [1], { polyatomic: true }),
  cation('prata', 'prata', 'Ag', [1]),
  cation('magnesio', 'magnésio', 'Mg', [2]),
  cation('calcio', 'cálcio', 'Ca', [2]),
  cation('estroncio', 'estrôncio', 'Sr', [2]),
  cation('bario', 'bário', 'Ba', [2]),
  cation('zinco', 'zinco', 'Zn', [2]),
  cation('aluminio', 'alumínio', 'Al', [3]),
  cation('ferro', 'ferro', 'Fe', [2, 3], { traditional: { 2: 'ferroso', 3: 'férrico' } }),
  cation('cobre', 'cobre', 'Cu', [1, 2], { traditional: { 1: 'cuproso', 2: 'cúprico' } }),
  cation('chumbo', 'chumbo', 'Pb', [2, 4], { traditional: { 2: 'plumboso', 4: 'plúmbico' } }),
  cation('estanho', 'estanho', 'Sn', [2, 4], { traditional: { 2: 'estanoso', 4: 'estânico' } }),
  cation('niquel', 'níquel', 'Ni', [2, 3], { traditional: { 2: 'niqueloso', 3: 'niquélico' } }),
  cation('cobalto', 'cobalto', 'Co', [2, 3], { traditional: { 2: 'cobaltoso', 3: 'cobáltico' } }),
  cation('ouro', 'ouro', 'Au', [1, 3], { traditional: { 1: 'auroso', 3: 'áurico' } }),
];

export const ROMAN = ['', 'I', 'II', 'III', 'IV'] as const;

const RADICAL_BY_ID = new Map(RADICALS.map((r) => [r.id, r]));
const CATION_BY_ID = new Map(CATIONS.map((c) => [c.id, c]));

export const radicalOf = (id: string) => RADICAL_BY_ID.get(id);
export const cationOf = (id: string) => CATION_BY_ID.get(id);

const SUFFIX_TEXT: Record<SuffixId, (r: Radical) => string> = {
  idrico: (r) => `${r.stem}ídrico`,
  ico: (r) => `${r.ico}ico`,
  oso: (r) => `${r.oso}oso`,
  eto: (r) => `${r.stem}eto`,
  ato: (r) => `${r.stem}ato`,
  ito: (r) => `${r.stem}ito`,
};

/** Prefix + body, doubling s and r after a vowel as Portuguese does: tio + sulfato = tiossulfato. */
function join(prefix: string, body: string): string {
  if (/[aeiou]$/.test(prefix) && /^[sr]/.test(body)) return prefix + body[0] + body;
  return prefix + body;
}

/** One word from its parts: (hipo, clor, oso) → hipocloroso; (hidrogeno, carbon, ato) → hidrogenocarbonato. */
export function word(prefix: string | undefined, radicalId: string, suffix: SuffixId): string {
  const r = radicalOf(radicalId);
  if (!r) throw new Error(`Radical desconhecido: ${radicalId}`);
  const body = SUFFIX_TEXT[suffix](r);
  return prefix ? join(prefix, body) : body;
}

const cationText = (p: Parts) => {
  const c = p.cation ? cationOf(p.cation) : undefined;
  if (!c) throw new Error(`Cátion desconhecido: ${p.cation}`);
  return p.valencia ? `${c.label}(${p.valencia})` : c.label;
};

const anionText = (p: Parts) => word(p.prefixo, p.radical!, p.sufixo!);

/** The name the parts spell: "ácido hipocloroso", "hidróxido de ferro(III)", "hidrogenocarbonato de sódio". Organic names are written by organic.ts. */
export function compose(category: Exclude<Category, 'organico'>, p: Parts): string {
  switch (category) {
    case 'acido':
      return `ácido ${anionText(p)}`;
    case 'base':
      return `hidróxido de ${cationText(p)}`;
    case 'sal':
      return `${anionText(p)} de ${cationText(p)}`;
  }
}
