/**
 * The organic chemistry track, from "what is a carbon chain" to stereochemistry.
 * Each lesson sits on an element tile; its atomic number is its place in the path.
 */
import * as g from './generators.ts';
import type { Lesson, Unit } from './types.ts';

const lesson = (
  number: number,
  symbol: string,
  id: string,
  title: string,
  summary: string,
  generate?: Lesson['generate'],
): Lesson => ({ id, element: { number, symbol }, title, summary, generate });

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
    description: 'Adição, substituição, oxidação e combustão.',
    lessons: [
      lesson(14, 'Si', 'adicao', 'Adição', 'Hidrogenação e halogenação de alcenos.'),
      lesson(15, 'P', 'substituicao', 'Substituição', 'Halogenação de alcanos e aromáticos.'),
      lesson(16, 'S', 'oxidacao', 'Oxidação', 'Do álcool ao ácido.'),
    ],
  },
  {
    id: 'polimeros',
    title: 'Polímeros e biomoléculas',
    description: 'Plásticos, sabões, gorduras e proteínas.',
    lessons: [
      lesson(17, 'Cl', 'polimeros', 'Polímeros', 'Adição e condensação.'),
      lesson(18, 'Ar', 'lipidios', 'Gorduras e sabões', 'Saponificação e biodiesel.'),
      lesson(19, 'K', 'proteinas', 'Proteínas e açúcares', 'Ligação peptídica e glicosídica.'),
    ],
  },
];

export const LESSONS = COURSE.flatMap((u) => u.lessons);
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const unitOf = (lessonId: string) => COURSE.find((u) => u.lessons.some((l) => l.id === lessonId))!;
