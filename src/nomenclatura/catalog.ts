/**
 * Every compound the game asks about: the acids, bases and salts of ENEM chemistry, each with
 * its formula, the parts of its IUPAC name, how hard it is, its other names, and (for many)
 * where it shows up. Formulas of bases and salts are built from their ions, so a formula and its
 * name cannot drift.
 */
import { type IonSpec, compound as neutral, counts } from './formula.ts';
import { type Cation, type Category, type Parts, type Radical, type SuffixId, ROMAN, cationOf, compose, radicalOf, word } from './pieces.ts';

/** 1: the classics; 2: Roman numerals, hipo-/per-, hydrogen salts; 3: the rest of the textbook. */
export type Tier = 1 | 2 | 3;

export const TIER_LABEL: Record<Tier, string> = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' };

export interface Anion {
  /** Its name, which is also its id: "sulfato", "hidrogenocarbonato". */
  name: string;
  formula: string;
  /** Size of the charge (no sign). */
  charge: number;
  prefixo?: string;
  radical: string;
  sufixo: Extract<SuffixId, 'eto' | 'ato' | 'ito'>;
  /** Other prefixes that also name it: (orto)fosfato, (meta)silicato. */
  alsoPrefix?: readonly string[];
  /** The name people use instead: bicarbonato. */
  common?: string;
}

export interface Compound {
  /** The formula, which is unique. */
  id: string;
  category: Category;
  formula: string;
  tier: Tier;
  /** The parts of each accepted IUPAC name; the first is the name the game shows. */
  answers: readonly Parts[];
  /** The accepted IUPAC names, written out: "ácido fosfórico", "ácido ortofosfórico". */
  names: readonly string[];
  /** The IUPAC name: "sulfato de ferro(III)". */
  name: string;
  /** Traditional names: "sulfato férrico", "bicarbonato de sódio". */
  traditional: readonly string[];
  /** Everyday and trade names: "soda cáustica", "barrilha". */
  common: readonly string[];
  /** Where it shows up: the kitchen, the lab, the exam. */
  fact?: string;
  /** Bases and salts. */
  cation?: { piece: Cation; charge: number };
  /** Salts. */
  anion?: Anion;
}

type AnionDef = [formula: string, charge: number, prefixo: string | undefined, radical: string, sufixo: Anion['sufixo'], extra?: Pick<Anion, 'alsoPrefix' | 'common'>];

const ANION_DEFS: AnionDef[] = [
  ['F', 1, undefined, 'fluor', 'eto'],
  ['Cl', 1, undefined, 'clor', 'eto'],
  ['Br', 1, undefined, 'brom', 'eto'],
  ['I', 1, undefined, 'iod', 'eto'],
  ['S', 2, undefined, 'sulf', 'eto'],
  ['HS', 1, 'hidrogeno', 'sulf', 'eto', { common: 'bissulfeto' }],
  ['CN', 1, undefined, 'cian', 'eto'],
  ['ClO', 1, 'hipo', 'clor', 'ito'],
  ['ClO2', 1, undefined, 'clor', 'ito'],
  ['ClO3', 1, undefined, 'clor', 'ato'],
  ['ClO4', 1, 'per', 'clor', 'ato'],
  ['BrO', 1, 'hipo', 'brom', 'ito'],
  ['BrO3', 1, undefined, 'brom', 'ato'],
  ['IO3', 1, undefined, 'iod', 'ato'],
  ['IO4', 1, 'per', 'iod', 'ato'],
  ['SO3', 2, undefined, 'sulf', 'ito'],
  ['HSO3', 1, 'hidrogeno', 'sulf', 'ito', { common: 'bissulfito' }],
  ['SO4', 2, undefined, 'sulf', 'ato'],
  ['HSO4', 1, 'hidrogeno', 'sulf', 'ato', { common: 'bissulfato' }],
  ['S2O3', 2, 'tio', 'sulf', 'ato'],
  ['NO2', 1, undefined, 'nitr', 'ito'],
  ['NO3', 1, undefined, 'nitr', 'ato'],
  ['PO4', 3, undefined, 'fosf', 'ato', { alsoPrefix: ['orto'] }],
  ['HPO4', 2, 'hidrogeno', 'fosf', 'ato'],
  ['H2PO4', 1, 'di-hidrogeno', 'fosf', 'ato'],
  ['PO3', 1, 'meta', 'fosf', 'ato'],
  ['P2O7', 4, 'piro', 'fosf', 'ato'],
  ['CO3', 2, undefined, 'carbon', 'ato'],
  ['HCO3', 1, 'hidrogeno', 'carbon', 'ato', { common: 'bicarbonato' }],
  ['SiO3', 2, undefined, 'silic', 'ato', { alsoPrefix: ['meta'] }],
  ['CrO4', 2, undefined, 'crom', 'ato'],
  ['Cr2O7', 2, 'di', 'crom', 'ato'],
  ['MnO4', 2, undefined, 'mangan', 'ato'],
  ['MnO4', 1, 'per', 'mangan', 'ato'],
  ['CNO', 1, undefined, 'cian', 'ato'],
  ['SCN', 1, 'tio', 'cian', 'ato'],
];

export const ANIONS: readonly Anion[] = ANION_DEFS.map(([formula, charge, prefixo, radical, sufixo, extra]) => ({
  name: word(prefixo, radical, sufixo),
  formula,
  charge,
  prefixo,
  radical,
  sufixo,
  ...extra,
}));

const ANION_BY_NAME = new Map(ANIONS.map((a) => [a.name, a]));

export function anionOf(name: string): Anion {
  const a = ANION_BY_NAME.get(name);
  if (!a) throw new Error(`Ânion desconhecido: ${name}`);
  return a;
}

const isPolyatomic = (formula: string) => Object.values(counts(formula)).reduce((s, n) => s + n, 0) > 1;

/** The parts of an anion's name, and the variants with its other prefixes. */
const anionParts = (a: Anion): Parts[] =>
  [a.prefixo, ...(a.alsoPrefix ?? [])].map((prefixo) => ({ prefixo, radical: a.radical, sufixo: a.sufixo }));

/** Drops the keys whose value is undefined. */
const clean = (p: Parts): Parts => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Parts;

type AcidDef = [formula: string, prefixo: string | undefined, radical: string, sufixo: 'idrico' | 'oso' | 'ico', tier: Tier, extra?: { also?: string[]; fact?: string }];

const ACID_DEFS: AcidDef[] = [
  ['HF', undefined, 'fluor', 'idrico', 1, { fact: 'Corrói o vidro: é usado para gravar vidros e cristais.' }],
  ['HCl', undefined, 'clor', 'idrico', 1, { fact: 'Está no suco gástrico; impuro, é vendido como ácido muriático.' }],
  ['HBr', undefined, 'brom', 'idrico', 1],
  ['HI', undefined, 'iod', 'idrico', 1],
  ['H2S', undefined, 'sulf', 'idrico', 1, { fact: 'O gás com cheiro de ovo podre.' }],
  ['H2SO3', undefined, 'sulf', 'oso', 1, { fact: 'Forma-se quando o SO₂ da queima de combustíveis encontra a água da chuva.' }],
  ['H2SO4', undefined, 'sulf', 'ico', 1, { fact: 'O produto químico mais fabricado do mundo; está na bateria do carro e na chuva ácida.' }],
  ['HNO2', undefined, 'nitr', 'oso', 1],
  ['HNO3', undefined, 'nitr', 'ico', 1, { fact: 'Matéria-prima de fertilizantes e explosivos; também aparece na chuva ácida.' }],
  ['H3PO4', undefined, 'fosf', 'ico', 1, { also: ['orto'], fact: 'O acidulante dos refrigerantes de cola (INS 338).' }],
  ['H2CO3', undefined, 'carbon', 'ico', 1, { fact: 'O gás do refrigerante: CO₂ + H₂O ⇌ H₂CO₃. É instável e logo se decompõe.' }],
  ['HCN', undefined, 'cian', 'idrico', 2, { fact: 'O gás cianídrico é extremamente tóxico: bloqueia a respiração celular.' }],
  ['HClO', 'hipo', 'clor', 'oso', 2, { fact: 'Forma-se quando o cloro desinfeta a água: Cl₂ + H₂O → HCl + HClO.' }],
  ['HClO2', undefined, 'clor', 'oso', 2],
  ['HClO3', undefined, 'clor', 'ico', 2],
  ['HClO4', 'per', 'clor', 'ico', 2],
  ['H3PO3', undefined, 'fosf', 'oso', 2],
  ['H3BO3', undefined, 'bor', 'ico', 2, { fact: 'Diluído em água, é a água boricada, um antisséptico suave.' }],
  ['H2SiO3', undefined, 'silic', 'ico', 2, { also: ['meta'] }],
  ['HBrO', 'hipo', 'brom', 'oso', 3],
  ['HBrO3', undefined, 'brom', 'ico', 3],
  ['HIO', 'hipo', 'iod', 'oso', 3],
  ['HIO3', undefined, 'iod', 'ico', 3],
  ['HIO4', 'per', 'iod', 'ico', 3],
  ['H2S2O3', 'tio', 'sulf', 'ico', 3],
  ['H3PO2', 'hipo', 'fosf', 'oso', 3],
  ['HPO3', 'meta', 'fosf', 'ico', 3],
  ['H4P2O7', 'piro', 'fosf', 'ico', 3],
  ['H4SiO4', 'orto', 'silic', 'ico', 3],
  ['H2CrO4', undefined, 'crom', 'ico', 3],
  ['H2Cr2O7', 'di', 'crom', 'ico', 3],
  ['H2MnO4', undefined, 'mangan', 'ico', 3],
  ['HMnO4', 'per', 'mangan', 'ico', 3],
  ['HCNO', undefined, 'cian', 'ico', 3],
  ['HSCN', 'tio', 'cian', 'ico', 3],
];

type BaseDef = [cation: string, charge: number, tier: Tier, extra?: { common?: string[]; fact?: string }];

const BASE_DEFS: BaseDef[] = [
  ['sodio', 1, 1, { common: ['soda cáustica'], fact: 'A soda cáustica: desentope pias e transforma gordura em sabão.' }],
  ['potassio', 1, 1, { common: ['potassa cáustica'] }],
  ['litio', 1, 1],
  ['calcio', 2, 1, { common: ['cal hidratada', 'cal extinta'], fact: 'A cal hidratada das obras e da caiação; dissolvida, é a água de cal.' }],
  ['magnesio', 2, 1, { fact: 'Em suspensão na água, é o leite de magnésia, um antiácido.' }],
  ['bario', 2, 1],
  ['aluminio', 3, 1, { fact: 'É antiácido e se forma no tratamento de água, em flocos que arrastam a sujeira.' }],
  ['amonio', 1, 1, { fact: 'É a amônia (NH₃) dissolvida em água: a base fraca dos produtos de limpeza.' }],
  ['zinco', 2, 2],
  ['estroncio', 2, 2],
  ['prata', 1, 2],
  ['ferro', 2, 2],
  ['ferro', 3, 2, { fact: 'Um precipitado castanho-avermelhado, parente da ferrugem (óxido de ferro(III) hidratado).' }],
  ['cobre', 2, 2, { fact: 'O precipitado azul que aparece ao juntar uma base a uma solução de sulfato de cobre(II).' }],
  ['cobre', 1, 3],
  ['chumbo', 2, 3],
  ['chumbo', 4, 3],
  ['estanho', 2, 3],
  ['estanho', 4, 3],
  ['niquel', 2, 3],
  ['niquel', 3, 3],
  ['cobalto', 2, 3],
  ['cobalto', 3, 3],
  ['ouro', 1, 3],
  ['ouro', 3, 3],
];

type SaltDef = [cation: string, charge: number, anion: string, tier: Tier, extra?: { common?: string[]; fact?: string }];

const SALT_DEFS: SaltDef[] = [
  // Tier 1: the classics.
  ['sodio', 1, 'cloreto', 1, { common: ['sal de cozinha'], fact: 'O sal de cozinha; a 0,9% em água, é o soro fisiológico.' }],
  ['potassio', 1, 'cloreto', 1, { fact: 'Substitui parte do cloreto de sódio no sal light.' }],
  ['litio', 1, 'cloreto', 1, { fact: 'Dá aos fogos de artifício uma chama vermelha.' }],
  ['sodio', 1, 'fluoreto', 1, { fact: 'Fonte de flúor de cremes dentais e enxaguantes: fortalece o esmalte dos dentes.' }],
  ['potassio', 1, 'fluoreto', 1],
  ['potassio', 1, 'brometo', 1],
  ['potassio', 1, 'iodeto', 1, { fact: 'Comprimidos dele protegem a tireoide do iodo radioativo em acidentes nucleares.' }],
  ['calcio', 2, 'cloreto', 1, { fact: 'Absorve a umidade do ar: é o "tira-mofo" dos armários.' }],
  ['magnesio', 2, 'cloreto', 1],
  ['bario', 2, 'cloreto', 1],
  ['aluminio', 3, 'cloreto', 1],
  ['zinco', 2, 'cloreto', 1],
  ['sodio', 1, 'sulfeto', 1],
  ['sodio', 1, 'sulfato', 1],
  ['potassio', 1, 'sulfato', 1],
  ['magnesio', 2, 'sulfato', 1, { common: ['sal amargo', 'sal de Epsom'] }],
  ['calcio', 2, 'sulfato', 1, { fact: 'Hidratado, é o gesso das obras e das imobilizações.' }],
  ['bario', 2, 'sulfato', 1, { fact: 'Contraste de raio X: tão insolúvel que não intoxica. Em 2003, um lote contaminado com carbonato de bário, que se dissolve no estômago, causou mortes no Brasil.' }],
  ['zinco', 2, 'sulfato', 1],
  ['sodio', 1, 'sulfito', 1, { fact: 'Conservante de alimentos e bebidas (INS 221).' }],
  ['sodio', 1, 'nitrito', 1, { fact: 'Conservante de embutidos (INS 250): mantém a carne rosada.' }],
  ['sodio', 1, 'nitrato', 1, { common: ['salitre do Chile'] }],
  ['potassio', 1, 'nitrato', 1, { common: ['salitre'], fact: 'O salitre, ingrediente da pólvora negra.' }],
  ['calcio', 2, 'nitrato', 1],
  ['bario', 2, 'nitrato', 1, { fact: 'Dá aos fogos de artifício uma chama verde.' }],
  ['prata', 1, 'nitrato', 1],
  ['prata', 1, 'cloreto', 1, { fact: 'Um precipitado branco que escurece à luz: a base da fotografia em filme.' }],
  ['amonio', 1, 'cloreto', 1, { fact: 'Eletrólito das pilhas secas comuns (pilha de Leclanché).' }],
  ['amonio', 1, 'nitrato', 1, { fact: 'Fertilizante nitrogenado; mal armazenado, causou a explosão do porto de Beirute em 2020.' }],
  ['sodio', 1, 'carbonato', 1, { common: ['barrilha'], fact: 'A barrilha, matéria-prima do vidro e corretor de pH de piscinas.' }],
  ['potassio', 1, 'carbonato', 1],
  ['calcio', 2, 'carbonato', 1, { fact: 'Calcário, mármore, casca de ovo e conchas.' }],
  ['magnesio', 2, 'carbonato', 1, { fact: 'O "pó de magnésio" que ginastas e escaladores passam nas mãos.' }],
  ['litio', 1, 'carbonato', 1, { fact: 'Medicamento usado no tratamento do transtorno bipolar.' }],
  ['sodio', 1, 'fosfato', 1],

  // Tier 2: Roman numerals, hipo-/per-, hydrogen salts, parentheses.
  ['sodio', 1, 'hipoclorito', 2, { fact: 'Em solução, é a água sanitária.' }],
  ['calcio', 2, 'hipoclorito', 2, { fact: 'O "cloro" em pó das piscinas.' }],
  ['sodio', 1, 'hidrogenocarbonato', 2, { fact: 'O bicarbonato: fermento químico e antiácido; libera CO₂ com ácidos.' }],
  ['potassio', 1, 'hidrogenocarbonato', 2],
  ['amonio', 1, 'hidrogenocarbonato', 2, { fact: 'Fermento de biscoitos: no forno vira só gases (NH₃, CO₂ e vapor de água).' }],
  ['sodio', 1, 'hidrogenossulfato', 2, { fact: 'O redutor de pH das piscinas.' }],
  ['calcio', 2, 'fosfato', 2, { fact: 'O mineral dos ossos e dentes, em forma simplificada.' }],
  ['aluminio', 3, 'sulfato', 2, { fact: 'Clássico do ENEM: flocula a sujeira no tratamento de água.' }],
  ['aluminio', 3, 'nitrato', 2],
  ['aluminio', 3, 'fosfato', 2],
  ['amonio', 1, 'sulfato', 2, { fact: 'Fertilizante que fornece nitrogênio e enxofre.' }],
  ['amonio', 1, 'perclorato', 2, { fact: 'O oxidante do combustível sólido de foguetes.' }],
  ['calcio', 2, 'fluoreto', 2, { common: ['fluorita'] }],
  ['potassio', 1, 'clorato', 2, { fact: 'Oxidante da cabeça dos palitos de fósforo.' }],
  ['potassio', 1, 'iodato', 2, { fact: 'É ele que o Brasil adiciona ao sal de cozinha para prevenir o bócio.' }],
  ['potassio', 1, 'permanganato', 2, { fact: 'Violeta intenso: antisséptico e oxidante de laboratório.' }],
  ['potassio', 1, 'dicromato', 2, { fact: 'O laranja dos bafômetros antigos, que fica verde na presença de álcool.' }],
  ['potassio', 1, 'cromato', 2],
  ['potassio', 1, 'nitrito', 2],
  ['potassio', 1, 'sulfeto', 2],
  ['sodio', 1, 'cianeto', 2, { fact: 'Usado para extrair ouro na mineração; muito tóxico.' }],
  ['potassio', 1, 'cianeto', 2],
  ['sodio', 1, 'silicato', 2, { common: ['vidro líquido'] }],
  ['ferro', 2, 'cloreto', 2],
  ['ferro', 3, 'cloreto', 2, { fact: 'Vendido como "percloreto de ferro" para corroer placas de circuito, mas o nome certo é este.' }],
  ['ferro', 2, 'sulfato', 2, { fact: 'Suplemento de ferro contra a anemia.' }],
  ['ferro', 3, 'sulfato', 2],
  ['ferro', 3, 'nitrato', 2],
  ['ferro', 2, 'sulfeto', 2],
  ['cobre', 2, 'sulfato', 2, { fact: 'Cristais azuis; algicida de piscinas e ingrediente da calda bordalesa.' }],
  ['cobre', 2, 'cloreto', 2],
  ['cobre', 1, 'cloreto', 2],
  ['cobre', 2, 'nitrato', 2],
  ['chumbo', 2, 'nitrato', 2],
  ['chumbo', 2, 'iodeto', 2, { fact: 'O precipitado amarelo da "chuva de ouro" dos laboratórios.' }],
  ['chumbo', 2, 'sulfato', 2, { fact: 'Forma-se nas placas da bateria de carro quando ela descarrega.' }],
  ['estanho', 2, 'fluoreto', 2, { fact: 'Uma das fontes de flúor dos cremes dentais.' }],
  ['estanho', 2, 'cloreto', 2],
  ['prata', 1, 'brometo', 2, { fact: 'O sal sensível à luz dos filmes fotográficos.' }],
  ['prata', 1, 'iodeto', 2, { fact: 'Espalhado nas nuvens para provocar chuva.' }],
  ['prata', 1, 'sulfeto', 2, { fact: 'A camada escura que se forma na prata com o tempo.' }],
  ['zinco', 2, 'sulfeto', 2, { fact: 'Brilha no escuro: é usado em tintas fosforescentes.' }],
  ['zinco', 2, 'nitrato', 2],
  ['zinco', 2, 'carbonato', 2],
  ['bario', 2, 'carbonato', 2, { fact: 'Venenoso: dissolve-se no ácido do estômago e libera íons bário.' }],
  ['estroncio', 2, 'nitrato', 2, { fact: 'O vermelho intenso dos fogos de artifício.' }],
  ['estroncio', 2, 'carbonato', 2],
  ['calcio', 2, 'sulfito', 2],

  // Tier 3: the rest of the textbook.
  ['sodio', 1, 'tiossulfato', 3, { fact: 'Fixador fotográfico; também neutraliza o cloro da água de aquários.' }],
  ['sodio', 1, 'hidrogenofosfato', 3],
  ['sodio', 1, 'di-hidrogenofosfato', 3],
  ['amonio', 1, 'di-hidrogenofosfato', 3, { common: ['MAP'], fact: 'Fertilizante (MAP): fornece nitrogênio e fósforo.' }],
  ['amonio', 1, 'hidrogenofosfato', 3, { common: ['DAP'], fact: 'Fertilizante (DAP): fornece nitrogênio e fósforo.' }],
  ['calcio', 2, 'di-hidrogenofosfato', 3, { fact: 'O principal componente do superfosfato, um fertilizante.' }],
  ['amonio', 1, 'fosfato', 3],
  ['sodio', 1, 'hidrogenossulfito', 3],
  ['sodio', 1, 'hidrogenossulfeto', 3],
  ['calcio', 2, 'hidrogenocarbonato', 3, { fact: 'Deixa a água "dura" e forma estalactites ao perder CO₂.' }],
  ['magnesio', 2, 'hidrogenocarbonato', 3],
  ['potassio', 1, 'tiocianato', 3],
  ['ferro', 3, 'tiocianato', 3, { fact: 'Vermelho-sangue: o teste clássico para identificar íons Fe³⁺.' }],
  ['potassio', 1, 'manganato', 3, { fact: 'Verde: forma-se quando o permanganato é reduzido em meio básico.' }],
  ['sodio', 1, 'pirofosfato', 3],
  ['sodio', 1, 'metafosfato', 3],
  ['sodio', 1, 'clorito', 3, { fact: 'Gera dióxido de cloro para desinfetar água.' }],
  ['sodio', 1, 'perclorato', 3],
  ['potassio', 1, 'perclorato', 3],
  ['sodio', 1, 'hipobromito', 3],
  ['sodio', 1, 'bromato', 3],
  ['potassio', 1, 'bromato', 3, { fact: 'Já foi usado para fazer o pão crescer; hoje é proibido no Brasil.' }],
  ['sodio', 1, 'iodato', 3],
  ['sodio', 1, 'periodato', 3],
  ['sodio', 1, 'cromato', 3],
  ['sodio', 1, 'dicromato', 3],
  ['prata', 1, 'cromato', 3, { fact: 'Vermelho-tijolo: indica o fim de titulações de cloreto.' }],
  ['bario', 2, 'cromato', 3],
  ['prata', 1, 'fosfato', 3],
  ['zinco', 2, 'fosfato', 3],
  ['magnesio', 2, 'fosfato', 3],
  ['calcio', 2, 'silicato', 3],
  ['amonio', 1, 'cianato', 3, { fact: 'Wöhler aqueceu este sal em 1828 e obteve ureia: o começo da química orgânica.' }],
  ['sodio', 1, 'cianato', 3],
  ['amonio', 1, 'nitrito', 3],
  ['amonio', 1, 'carbonato', 3],
  ['aluminio', 3, 'sulfeto', 3],
  ['ferro', 3, 'fosfato', 3],
  ['ferro', 2, 'fosfato', 3],
  ['ferro', 2, 'carbonato', 3, { common: ['siderita'] }],
  ['ferro', 3, 'brometo', 3],
  ['ferro', 2, 'brometo', 3],
  ['cobre', 2, 'sulfeto', 3],
  ['cobre', 1, 'sulfeto', 3],
  ['cobre', 1, 'iodeto', 3],
  ['chumbo', 2, 'sulfeto', 3, { common: ['galena'], fact: 'A galena, principal minério de chumbo.' }],
  ['chumbo', 2, 'carbonato', 3],
  ['chumbo', 4, 'cloreto', 3],
  ['chumbo', 4, 'fluoreto', 3],
  ['estanho', 4, 'cloreto', 3],
  ['estanho', 2, 'sulfato', 3],
  ['estanho', 4, 'sulfato', 3],
  ['estanho', 2, 'sulfeto', 3],
  ['estanho', 4, 'sulfeto', 3, { fact: 'Escamas douradas, já usadas como pigmento: o "ouro-musivo".' }],
  ['niquel', 2, 'sulfato', 3, { fact: 'Usado na niquelação, que reveste metais com níquel.' }],
  ['niquel', 2, 'cloreto', 3],
  ['niquel', 2, 'nitrato', 3],
  ['cobalto', 2, 'cloreto', 3, { fact: 'Azul quando seco, rosa quando úmido: indica umidade no "galinho do tempo".' }],
  ['cobalto', 2, 'sulfato', 3],
  ['cobalto', 3, 'fluoreto', 3],
  ['ouro', 3, 'cloreto', 3],
  ['ouro', 1, 'cloreto', 3],
];

function acid([formula, prefixo, radical, sufixo, tier, extra]: AcidDef): Compound {
  const answers = [prefixo, ...(extra?.also ?? [])].map((p) => clean({ prefixo: p, radical, sufixo }));
  const names = answers.map((a) => compose('acido', a));
  return { id: formula, category: 'acido', formula, tier, answers, names, name: names[0], traditional: [], common: [], fact: extra?.fact };
}

const cationIon = (c: Cation, charge: number): IonSpec => ({ formula: c.symbol, charge, polyatomic: !!c.polyatomic });

/** The cation's parts: the Roman numeral only where the metal has more than one charge. */
const cationParts = (c: Cation, charge: number): Parts => clean({ cation: c.id, valencia: c.charges.length > 1 ? ROMAN[charge] : undefined });

function needCation(id: string, charge: number): Cation {
  const c = cationOf(id);
  if (!c || !c.charges.includes(charge)) throw new Error(`Cátion desconhecido: ${id}${charge}`);
  return c;
}

function base([id, charge, tier, extra]: BaseDef): Compound {
  const c = needCation(id, charge);
  const answers = [cationParts(c, charge)];
  const traditional = c.traditional?.[charge];
  const formula = neutral(cationIon(c, charge), { formula: 'OH', charge: 1, polyatomic: true });
  const names = answers.map((a) => compose('base', a));
  return {
    id: formula,
    category: 'base',
    formula,
    tier,
    answers,
    names,
    name: names[0],
    traditional: traditional ? [`hidróxido ${traditional}`] : [],
    common: extra?.common ?? [],
    fact: extra?.fact,
    cation: { piece: c, charge },
  };
}

function salt([id, charge, anionName, tier, extra]: SaltDef): Compound {
  const c = needCation(id, charge);
  const a = anionOf(anionName);
  const formula = neutral(cationIon(c, charge), { formula: a.formula, charge: a.charge, polyatomic: isPolyatomic(a.formula) });
  const answers = anionParts(a).map((p) => clean({ ...p, ...cationParts(c, charge) }));
  const traditional = c.traditional?.[charge];
  const plainCation = c.charges.length > 1 ? `${c.label}(${ROMAN[charge]})` : c.label;
  const names = answers.map((p) => compose('sal', p));
  return {
    id: formula,
    category: 'sal',
    formula,
    tier,
    answers,
    names,
    name: names[0],
    traditional: [...(traditional ? [`${a.name} ${traditional}`] : []), ...(a.common ? [`${a.common} de ${plainCation}`] : [])],
    common: extra?.common ?? [],
    fact: extra?.fact,
    cation: { piece: c, charge },
    anion: a,
  };
}

export const COMPOUNDS: readonly Compound[] = [...ACID_DEFS.map(acid), ...BASE_DEFS.map(base), ...SALT_DEFS.map(salt)];

const BY_ID = new Map(COMPOUNDS.map((c) => [c.id, c]));

export const compoundById = (id: string): Compound | undefined => BY_ID.get(id);

export const ofCategory = (category: Category, tier?: Tier): Compound[] =>
  COMPOUNDS.filter((c) => c.category === category && (tier === undefined || c.tier === tier));

/** The acid an anion comes from: -eto ← -ídrico, -ito ← -oso, -ato ← -ico; hydrogen prefixes drop. */
export function parentAcid(a: Anion): string {
  const sufixo = ({ eto: 'idrico', ito: 'oso', ato: 'ico' } as const)[a.sufixo];
  const prefixo = a.prefixo === 'hidrogeno' || a.prefixo === 'di-hidrogeno' ? undefined : a.prefixo;
  return `ácido ${word(prefixo, a.radical, sufixo)}`;
}

/** The element an acid or anion is named after. */
export const radicalFor = (id: string): Radical => {
  const r = radicalOf(id);
  if (!r) throw new Error(`Radical desconhecido: ${id}`);
  return r;
};
