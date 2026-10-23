/**
 * The pieces an inorganic name is built from, as Brazilian textbooks teach IUPAC nomenclature:
 * a prefix and a suffix around an element's root (hipo·clor·oso, hidrogeno·carbon·ato), and the
 * cation with its charge in Roman numerals (ferro(III)). The game's keyboard is these pieces, and
 * a guess is one piece (or none, where the slot is optional) per slot.
 */

export type Category = 'acido' | 'base' | 'sal';
export type Slot = 'prefixo' | 'radical' | 'sufixo' | 'cation' | 'valencia';

/** One piece id per slot; a missing slot is "no piece" (no prefix, no Roman numeral). */
export type Guess = Partial<Record<Slot, string>>;

export const CATEGORIES: readonly Category[] = ['acido', 'base', 'sal'];

export const CATEGORY_LABEL: Record<Category, string> = { acido: 'Ácido', base: 'Base', sal: 'Sal' };
export const CATEGORY_PLURAL: Record<Category, string> = { acido: 'Ácidos', base: 'Bases', sal: 'Sais' };
/** Lemon, soap and salt shaker: sour, slippery, salty. Used in the shared result. */
export const CATEGORY_EMOJI: Record<Category, string> = { acido: '🍋', base: '🧼', sal: '🧂' };

/** The slots of each kind of name, in reading order. */
export const SLOTS: Record<Category, readonly Slot[]> = {
  acido: ['prefixo', 'radical', 'sufixo'],
  base: ['cation', 'valencia'],
  sal: ['prefixo', 'radical', 'sufixo', 'cation', 'valencia'],
};

/** Slots that can stay empty: most names have no prefix, and fixed-charge cations no numeral. */
export const OPTIONAL: readonly Slot[] = ['prefixo', 'valencia'];

export const SLOT_LABEL: Record<Slot, string> = {
  prefixo: 'Prefixo',
  radical: 'Radical',
  sufixo: 'Sufixo',
  cation: 'Cátion',
  valencia: 'Carga',
};

export interface Piece {
  id: string;
  slot: Slot;
  /** As printed on the key: "hipo-", "clor", "-ato", "ferro", "III". */
  label: string;
  /** Pieces of one family are "close" to each other: -ito for -ato, per- for hipo-, II for III. */
  family?: string;
}

export interface Prefix extends Piece {
  slot: 'prefixo';
  /** The keyboards it appears on. */
  in: readonly Category[];
}

export interface Radical extends Piece {
  slot: 'radical';
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

export type SuffixId = 'idrico' | 'ico' | 'oso' | 'eto' | 'ato' | 'ito';

export interface Suffix extends Piece {
  slot: 'sufixo';
  id: SuffixId;
  in: Category;
}

export interface Cation extends Piece {
  slot: 'cation';
  /** As written in the formula: Fe, NH4. */
  symbol: string;
  /** Charges it forms. More than one means the name needs the Roman numeral. */
  charges: readonly number[];
  /** Traditional names by charge: ferroso (Fe²⁺), férrico (Fe³⁺). */
  traditional?: Readonly<Record<number, string>>;
  /** Written in parentheses when there is more than one: (NH₄)₂SO₄. */
  polyatomic?: boolean;
}

export interface Valence extends Piece {
  slot: 'valencia';
  value: number;
}

export const PREFIXES: readonly Prefix[] = [
  { id: 'hipo', slot: 'prefixo', label: 'hipo-', family: 'nox', in: ['acido', 'sal'] },
  { id: 'per', slot: 'prefixo', label: 'per-', family: 'nox', in: ['acido', 'sal'] },
  { id: 'orto', slot: 'prefixo', label: 'orto-', family: 'agua', in: ['acido', 'sal'] },
  { id: 'meta', slot: 'prefixo', label: 'meta-', family: 'agua', in: ['acido', 'sal'] },
  { id: 'piro', slot: 'prefixo', label: 'piro-', family: 'agua', in: ['acido', 'sal'] },
  { id: 'tio', slot: 'prefixo', label: 'tio-', in: ['acido', 'sal'] },
  { id: 'di', slot: 'prefixo', label: 'di-', in: ['acido', 'sal'] },
  { id: 'hidrogeno', slot: 'prefixo', label: 'hidrogeno-', family: 'h', in: ['sal'] },
  { id: 'di-hidrogeno', slot: 'prefixo', label: 'di-hidrogeno-', family: 'h', in: ['sal'] },
];

const radical = (id: string, symbol: string, element: string, ico: string, oso = id): Radical => ({
  id,
  slot: 'radical',
  label: id,
  symbol,
  element,
  stem: id,
  ico,
  oso,
});

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

export const SUFFIXES: readonly Suffix[] = [
  { id: 'idrico', slot: 'sufixo', label: '-ídrico', in: 'acido' },
  { id: 'oso', slot: 'sufixo', label: '-oso', family: 'oxi', in: 'acido' },
  { id: 'ico', slot: 'sufixo', label: '-ico', family: 'oxi', in: 'acido' },
  { id: 'eto', slot: 'sufixo', label: '-eto', in: 'sal' },
  { id: 'ito', slot: 'sufixo', label: '-ito', family: 'oxi', in: 'sal' },
  { id: 'ato', slot: 'sufixo', label: '-ato', family: 'oxi', in: 'sal' },
];

const cation = (
  id: string,
  label: string,
  symbol: string,
  charges: number[],
  extra: Partial<Pick<Cation, 'traditional' | 'polyatomic'>> = {},
): Cation => ({ id, slot: 'cation', label, symbol, charges, ...extra });

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

export const VALENCES: readonly Valence[] = [1, 2, 3, 4].map((value) => ({
  id: ROMAN[value],
  slot: 'valencia',
  label: ROMAN[value],
  family: 'nox',
  value,
}));

const ALL: readonly Piece[] = [...PREFIXES, ...RADICALS, ...SUFFIXES, ...CATIONS, ...VALENCES];
const BY_KEY = new Map(ALL.map((p) => [`${p.slot}:${p.id}`, p]));

export function piece(slot: Slot, id: string | undefined): Piece | undefined {
  return id === undefined ? undefined : BY_KEY.get(`${slot}:${id}`);
}

export const radicalOf = (id: string) => piece('radical', id) as Radical | undefined;
export const cationOf = (id: string) => piece('cation', id) as Cation | undefined;

/** The keys of one kind of name, grouped by slot as the keyboard lays them out. */
export function keyboard(category: Category): { slot: Slot; pieces: Piece[] }[] {
  return SLOTS[category].map((slot) => ({
    slot,
    pieces: ALL.filter(
      (p) =>
        p.slot === slot &&
        (p.slot === 'prefixo' ? (p as Prefix).in.includes(category) : p.slot === 'sufixo' ? (p as Suffix).in === category : true),
    ),
  }));
}

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

/** One word from its pieces: (hipo, clor, oso) → hipocloroso; (hidrogeno, carbon, ato) → hidrogenocarbonato. */
export function word(prefix: string | undefined, radicalId: string, suffix: SuffixId): string {
  const r = radicalOf(radicalId);
  if (!r) return '';
  const body = SUFFIX_TEXT[suffix](r);
  return prefix ? join(prefix, body) : body;
}

const cationText = (g: Guess) => {
  const c = g.cation ? cationOf(g.cation)?.label : undefined;
  if (!c) return '…';
  return g.valencia ? `${c}(${g.valencia})` : c;
};

const anionText = (g: Guess) =>
  g.radical && g.sufixo ? word(g.prefixo, g.radical, g.sufixo as SuffixId) : g.prefixo ? `${g.prefixo}…` : '…';

/**
 * The name a guess spells, as it would be written: "ácido hipocloroso", "hidróxido de ferro(III)",
 * "hidrogenocarbonato de sódio". Missing required pieces read as "…", so it also previews a draft.
 */
export function compose(category: Category, g: Guess): string {
  switch (category) {
    case 'acido':
      return `ácido ${anionText(g)}`;
    case 'base':
      return `hidróxido de ${cationText(g)}`;
    case 'sal':
      return `${anionText(g)} de ${cationText(g)}`;
  }
}
