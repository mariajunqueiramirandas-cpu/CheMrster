/**
 * The organic chemistry track, from "what is a carbon chain" to proteins and plastics.
 * Each lesson sits on an element tile; its atomic number is its place in the path.
 */
import * as g from './generators.ts';
import * as life from './life-generators.ts';
import * as rxn from './reaction-generators.ts';
import { THEORY } from './theory/index.ts';
import type { Lesson, Unit } from './types.ts';

const lesson = (
  number: number,
  symbol: string,
  id: string,
  title: string,
  summary: string,
  generate?: Lesson['generate'],
): Lesson => ({ id, element: { number, symbol }, title, summary, generate, theory: THEORY[id] });

export const COURSE: Unit[] = [
  {
    id: 'carbono',
    title: 'O carbono e suas fórmulas',
    description: 'Por que o carbono forma tantas substâncias e como ler cada tipo de fórmula.',
    lessons: [
      lesson(1, 'H', 'tetravalencia', 'Quatro ligações', 'O carbono é tetravalente e os H ficam ocultos no bastão.', g.tetravalence),
      lesson(2, 'He', 'tres-formulas', 'Três jeitos de desenhar', 'Estrutural, condensada e de bastão: a mesma molécula.', g.threeFormulas),
      lesson(3, 'Li', 'classes-de-carbono', 'Primário a quaternário', 'Classifique carbonos pelos vizinhos.', g.carbonClasses),
    ],
  },
  {
    id: 'cadeias',
    title: 'Cadeias carbônicas',
    description: 'Aberta ou fechada, normal ou ramificada, saturada ou não, homogênea ou não.',
    lessons: [
      lesson(4, 'Be', 'aberta-fechada', 'Aberta, fechada, ramificada', 'Leia a forma do esqueleto.', g.openClosedBranched),
      lesson(5, 'B', 'saturacao', 'Saturada ou insaturada', 'Ache as duplas e triplas entre carbonos.', g.saturation),
      lesson(6, 'C', 'heteroatomos', 'Homogênea ou heterogênea', 'Encontre o heteroátomo no meio da cadeia.', g.heteroChains),
    ],
  },
  {
    id: 'hidrocarbonetos',
    title: 'Hidrocarbonetos',
    description: 'Só carbono e hidrogênio: as classes e os nomes oficiais.',
    lessons: [
      lesson(7, 'N', 'classes-hc', 'Alcanos, alcenos, alcinos', 'Classifique pela ligação e pelo anel.', g.hydrocarbonClasses),
      lesson(8, 'O', 'nomenclatura-hc', 'Dando nome', 'Prefixo, infixo e sufixo da IUPAC.', g.hydrocarbonNames),
    ],
  },
  {
    id: 'funcoes',
    title: 'Funções orgânicas',
    description: 'Os grupos funcionais que o ENEM mais cobra, em moléculas do dia a dia.',
    lessons: [
      lesson(9, 'F', 'oxigenadas', 'Funções oxigenadas', 'Álcool, fenol, aldeído, cetona, ácido, éster e éter.', g.oxygenFunctions),
      lesson(10, 'Ne', 'nitrogenadas', 'Nitrogenadas e haletos', 'Amina, amida, nitrila, nitro e haletos.', g.nitrogenFunctions),
      lesson(11, 'Na', 'cotidiano', 'Funções no cotidiano', 'Aspirina, vanilina, capsaicina e outras do ENEM.', g.everydayFunctions),
    ],
  },
  {
    id: 'isomeria',
    title: 'Isomeria',
    description: 'Mesma fórmula, outra estrutura: cis-trans e carbono quiral.',
    lessons: [
      lesson(12, 'Mg', 'geometrica', 'Cis ou trans', 'Lados da ligação dupla.', g.geometricIsomerism),
      lesson(13, 'Al', 'quiral', 'Carbono quiral', 'Quatro ligantes diferentes.', g.chirality),
    ],
  },
  {
    id: 'reacoes',
    title: 'Reações orgânicas',
    description: 'Adição, substituição, oxidação, combustão e esterificação.',
    lessons: [
      lesson(14, 'Si', 'adicao', 'Adição', 'Hidrogenação, halogenação e a regra de Markovnikov.', rxn.addition),
      lesson(15, 'P', 'substituicao', 'Substituição', 'Halogenação de alcanos e reações do benzeno.', rxn.substitution),
      lesson(16, 'S', 'oxidacao', 'Oxidação e combustão', 'Do álcool ao ácido, e o balanço da queima.', rxn.oxidation),
      lesson(17, 'Cl', 'esterificacao', 'Ésteres', 'Esterificação, nomes, aromas e hidrólise.', rxn.esterification),
    ],
  },
  {
    id: 'polimeros',
    title: 'Polímeros e biomoléculas',
    description: 'Plásticos, gorduras, sabões, proteínas e açúcares.',
    lessons: [
      lesson(18, 'Ar', 'polimeros', 'Polímeros', 'Adição e condensação: do eteno ao PET.', life.polymers),
      lesson(19, 'K', 'lipidios', 'Gorduras e sabões', 'Saponificação, biodiesel e como o sabão limpa.', life.fats),
      lesson(20, 'Ca', 'proteinas', 'Proteínas e açúcares', 'Ligação peptídica e glicosídica.', life.biomolecules),
    ],
  },
];

export const LESSONS = COURSE.flatMap((u) => u.lessons);
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const unitOf = (lessonId: string) => COURSE.find((u) => u.lessons.some((l) => l.id === lessonId))!;
