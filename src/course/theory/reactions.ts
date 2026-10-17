/** Theory cards for units 6–7: organic reactions, polymers and biomolecules. */
import * as rx from '../../chem/reactions.ts';
import { POLYMERS, SUGAR_RINGS } from '../pools.ts';
import type { MolSpec, Term, TheoryCard } from '../types.ts';

const m = (smiles: string, extra: Partial<MolSpec> = {}, coef?: string): Term => ({ mol: { smiles, ...extra }, coef });
const t = (text: string, coef?: string): Term => ({ text, coef });

const polymer = (id: string, formula: MolSpec['formula']): MolSpec => {
  const p = POLYMERS.find((x) => x.id === id)!;
  const [a, b] = p.monomers.map((x) => x.smiles);
  return { smiles: p.kind === 'adição' ? rx.additionPolymer(a) : rx.condensationPolymer(a, b), polymer: true, formula };
};

const GLY_ALA = rx.peptide(['NCC(=O)O', 'CC(N)C(=O)O']);
const PEPTIDE_BOND = rx.peptideBonds(GLY_ALA).flatMap((b) => [b.c, b.o, b.n]);
const g = SUGAR_RINGS.glucose;
const MALTOSE = rx.condense(g.smiles, g.anomericO, g.anomericC, g.smiles, g.o4);

export const REACTIONS: Record<string, TheoryCard[]> = {
  // ---------------------------------------------------------------------------
  // Unidade 6 — reações orgânicas

  adicao: [
    {
      title: 'A dupla se abre',
      body: [
        'Na ligação dupla, uma das ligações (a **pi**) é mais fraca que a outra. Nas reações de **adição**, ela se rompe e **cada carbono da dupla ganha um átomo novo**.',
        'Nada sai da molécula: os átomos do reagente se somam a ela.',
      ],
      scheme: { left: [m('C=C', { name: 'eteno' }), t('H₂')], right: [m('CC', { name: 'etano' })], over: 'Ni' },
    },
    {
      title: 'Quatro reagentes',
      body: [
        '**H₂** (com Ni, Pt ou Pd): **hidrogenação**, o alceno vira alcano. **Cl₂ ou Br₂**: **halogenação**, um halogênio em cada carbono da dupla.',
        '**HCl ou HBr**: forma um **haleto** de alquila. **H₂O** em meio ácido: **hidratação**, forma um **álcool**.',
      ],
      scheme: { left: [m('C=CC', { name: 'propeno' }), t('Br₂')], right: [m('CC(Br)CBr', { name: '1,2-dibromopropano' })] },
    },
    {
      title: 'Regra de Markovnikov',
      body: [
        'Quando HX ou H₂O se somam a uma dupla de carbonos diferentes, **o H vai para o carbono da dupla que já tem mais hidrogênios**. O X (ou o OH) fica com o outro.',
        'Para lembrar: quem tem mais H ganha mais H.',
      ],
      scheme: { left: [m('C=CC', { name: 'propeno' }), t('HBr')], right: [m('CC(C)Br', { name: '2-bromopropano' })] },
    },
    {
      title: 'Teste do bromo',
      body: [
        'A solução de **Br₂** é castanho-avermelhada. Se a substância tem dupla ou tripla, o bromo se adiciona e **a cor some**: é o teste de insaturação.',
        'Para saturar tudo, cada **dupla** consome 1 H₂ e cada **tripla**, 2. Na **margarina**, óleos vegetais são hidrogenados e ficam sólidos.',
      ],
      molecules: [
        { smiles: 'C=CC=C', label: 'buta-1,3-dieno: 2 duplas, 2 H₂' },
        { smiles: 'CC#CC', label: 'but-2-ino: 1 tripla, 2 H₂' },
      ],
      tip: 'O benzeno tem duplas mas é aromático e muito estável: não descora o bromo e não faz adição como os alcenos.',
    },
  ],

  substituicao: [
    {
      title: 'Trocar um H',
      body: [
        'Alcanos não têm dupla para abrir. Com **Cl₂ ou Br₂ e luz** (ou calor), **um H é trocado por um halogênio** e sai HX: é a **substituição**.',
      ],
      scheme: { left: [m('C', { name: 'metano' }), t('Cl₂')], right: [m('CCl', { name: 'clorometano' }), t('HCl')], over: 'luz' },
    },
    {
      title: 'Quantos produtos?',
      body: [
        'Hidrogênios em carbonos **equivalentes** (por simetria) dão o mesmo produto. No propano há dois tipos de carbono com H, as pontas e o meio, então a monocloração dá **dois produtos**.',
        'O H mais fácil de trocar é o do carbono mais ligado a outros carbonos: **terciário > secundário > primário**. O Br₂ segue bem essa ordem.',
      ],
      molecules: [
        { smiles: 'CCCCl', label: '1-cloropropano (H da ponta)' },
        { smiles: 'CC(C)Cl', label: '2-cloropropano (H do meio)' },
      ],
    },
    {
      title: 'O anel benzênico',
      body: [
        'O benzeno é estável demais para fazer adição: ele **troca um H do anel**. As quatro clássicas:',
        '**nitração** (HNO₃ com H₂SO₄ põe –NO₂), **halogenação** (X₂ com FeX₃ põe –X), **alquilação de Friedel-Crafts** (R–Cl com AlCl₃ põe –R) e **sulfonação** (H₂SO₄ põe –SO₃H).',
      ],
      scheme: { left: [m('c1ccccc1', { name: 'benzeno' }), t('HNO₃')], right: [m('[O-][N+](=O)c1ccccc1', { name: 'nitrobenzeno' }), t('H₂O')], over: 'H₂SO₄' },
    },
    {
      title: 'O grupo do anel manda',
      body: [
        'Se o anel já tem um grupo, ele escolhe onde o próximo entra. **Orto-para-dirigentes**: –OH, –NH₂, –OCH₃, –CH₃ e os halogênios. O novo grupo entra ao lado (**orto**) ou em frente (**para**).',
        '**Meta-dirigentes**: –NO₂, –COOH, –CHO, –CN, –SO₃H. Repare: o átomo ligado ao anel tem **dupla, tripla ou carga positiva**.',
      ],
      molecules: [
        { smiles: 'Cc1ccccc1', marks: [2, 4, 6], label: 'tolueno: orto e para' },
        { smiles: '[O-][N+](=O)c1ccccc1', marks: [5, 7], label: 'nitrobenzeno: meta' },
      ],
      tip: 'Decore só os meta-dirigentes (dupla, tripla ou carga no átomo preso ao anel); o resto é orto-para.',
    },
  ],

  oxidacao: [
    {
      title: 'Oxidar um álcool',
      body: [
        'Um oxidante, escrito **[O]** (KMnO₄ ou K₂Cr₂O₇ em meio ácido), tira um H do carbono do –OH e forma a dupla C=O.',
        'Álcool **primário** vira **aldeído** e, com oxidante em excesso, **ácido carboxílico**.',
      ],
      molecules: [
        { smiles: 'CCO', label: 'etanol (primário)' },
        { smiles: 'CC=O', label: 'etanal' },
        { smiles: 'CC(=O)O', label: 'ácido etanoico' },
      ],
    },
    {
      title: 'Secundário e terciário',
      body: [
        'Álcool **secundário** vira **cetona**, e a oxidação para aí.',
        'Álcool **terciário** não se oxida assim: o carbono do –OH não tem nenhum H para perder.',
      ],
      scheme: { left: [m('CC(C)O', { name: 'propan-2-ol' })], right: [m('CC(C)=O', { name: 'propanona' })], over: '[O]' },
      molecules: [{ smiles: 'CC(C)(C)O', highlight: [1, 4], label: 'terciário: não se oxida' }],
    },
    {
      title: 'Bafômetro e vinagre',
      body: [
        'No bafômetro químico, o **dicromato** (laranja) oxida o etanol do hálito e vira **Cr³⁺**, verde. Quanto mais verde, mais álcool.',
        'O vinho exposto ao ar azeda pelo mesmo caminho: bactérias oxidam o etanol a **ácido acético**, o do vinagre.',
      ],
      scheme: { left: [m('CCO', { name: 'etanol' })], right: [m('CC=O', { name: 'etanal' })], over: '[O]', under: 'K₂Cr₂O₇ / H⁺' },
    },
    {
      title: 'Combustão',
      body: [
        'Queimar é oxidar ao máximo. Na combustão **completa**, o carbono vira **CO₂** e o hidrogênio, **H₂O**.',
        'Para balancear, acerte o **C**, depois o **H** e por último o **O**. Com pouco O₂, a combustão é **incompleta** e forma **CO**, gás tóxico, ou **fuligem** (C).',
      ],
      scheme: { left: [m('C', { name: 'metano' }), t('O₂', '2')], right: [t('CO₂'), t('H₂O', '2')] },
      tip: 'Coeficiente fracionário vale: C₂H₆ + 7/2 O₂ → 2 CO₂ + 3 H₂O.',
    },
  ],

  esterificacao: [
    {
      title: 'Ácido + álcool',
      body: [
        'Um **ácido carboxílico** e um **álcool**, em meio ácido, formam um **éster** e **água**. É a **esterificação**, uma reação reversível (⇌).',
        'O ácido perde o **–OH** e o álcool perde só o **H** do –OH: o oxigênio da ponte do éster vem do álcool.',
      ],
      scheme: {
        left: [m('CC(=O)O', { name: 'ácido etanoico' }), m('CCO', { name: 'etanol' })],
        right: [m('CCOC(C)=O', { name: 'etanoato de etila' }), t('H₂O')],
        over: 'H⁺',
        reversible: true,
      },
    },
    {
      title: 'Dando nome',
      body: [
        'Corte o éster no oxigênio da ponte. O lado com **C=O** veio do ácido: troque "-ico" por **"-ato"**. O lado do álcool vira **"-ila"**.',
        'Ácido etanoico + etanol → **etanoato de etila**. Ácido butanoico + metanol → **butanoato de metila**.',
      ],
      molecules: [
        { smiles: 'CCOC(C)=O', highlight: [3, 4, 5], label: 'etanoato (do ácido) de etila' },
        { smiles: 'CCCC(=O)OC', highlight: [0, 1, 2, 3, 4], label: 'butanoato (do ácido) de metila' },
      ],
    },
    {
      title: 'Cheiro de fruta',
      body: [
        'Muitos aromas são ésteres, usados como **flavorizantes**: etanoato de 3-metilbutila (banana), butanoato de etila (abacaxi), butanoato de metila (maçã), etanoato de octila (laranja).',
        'O etanoato de etila é o solvente dos removedores de esmalte.',
      ],
      molecules: [
        { smiles: 'CC(=O)OCCC(C)C', label: 'banana' },
        { smiles: 'CCCC(=O)OCC', label: 'abacaxi' },
      ],
    },
    {
      title: 'O caminho de volta',
      body: [
        'Na **hidrólise** em meio ácido, a água quebra o éster e devolve o ácido e o álcool.',
        'Em meio **básico** (NaOH), em vez do ácido sai o seu **sal**, o carboxilato. É a **saponificação**, a reação que faz sabão.',
      ],
      scheme: {
        left: [m('CCOC(C)=O', { name: 'etanoato de etila' }), t('NaOH')],
        right: [m('CC(=O)[O-].[Na+]', { name: 'etanoato de sódio' }), m('CCO', { name: 'etanol' })],
      },
      tip: 'Com ¹⁸O marcado: o oxigênio do álcool vai para o éster; o do –OH do ácido vai para a água.',
    },
  ],

  // ---------------------------------------------------------------------------
  // Unidade 7 — polímeros e biomoléculas

  polimeros: [
    {
      title: 'Muitas partes',
      body: [
        '**Polímeros** são macromoléculas feitas pela repetição de uma unidade, o **mero**. As moléculas pequenas que se juntam para formá-los são os **monômeros**.',
        'O **n** depois dos colchetes diz que a unidade se repete milhares de vezes.',
      ],
      molecules: [{ ...polymer('pe', 'condensed'), label: 'polietileno: o mero entre colchetes' }],
    },
    {
      title: 'Polímeros de adição',
      body: [
        'O monômero tem uma **dupla C=C**. Ela se abre e cada molécula se liga às vizinhas, **sem perder nenhum átomo**.',
        'Exemplos: polietileno (sacolas), polipropileno (potes), PVC (canos), poliestireno (isopor), teflon (panelas) e PAN (fibras acrílicas).',
      ],
      scheme: { left: [m('C=CCl', { name: 'cloroeteno' }, 'n')], right: [{ mol: polymer('pvc', 'condensed') }] },
    },
    {
      title: 'Polímeros de condensação',
      body: [
        'Monômeros com **dois grupos funcionais cada** se unem e liberam uma molécula pequena, quase sempre **água**, a cada ligação.',
        'Ácido + diálcool forma um **poliéster**, como o **PET** das garrafas. Ácido + diamina forma uma **poliamida**, como o **náilon** e o **kevlar**.',
      ],
      scheme: {
        left: [m('OC(=O)c1ccc(cc1)C(=O)O', { name: 'ácido tereftálico' }, 'n'), m('OCCO', { name: 'etilenoglicol' }, 'n')],
        right: [{ mol: polymer('pet', 'skeletal') }, t('H₂O', '2n')],
      },
    },
    {
      title: 'Plástico e ambiente',
      body: [
        'A maioria dos plásticos vem do petróleo e leva séculos para se degradar. A **reciclagem** separa os tipos pelo símbolo: 1 PET, 2 PEAD, 3 PVC, 4 PEBD, 5 PP, 6 PS.',
        'O **PLA**, poliéster do ácido lático feito de milho ou cana, é **biodegradável**.',
      ],
      molecules: [{ ...polymer('pla', 'skeletal'), label: 'PLA, poli(ácido lático)' }],
      tip: 'Para saber o tipo: cadeia principal só de carbonos é adição; éster ou amida no meio da cadeia é condensação.',
    },
  ],

  lipidios: [
    {
      title: 'Óleos e gorduras',
      body: [
        'Óleos e gorduras são **triglicerídeos**: **triésteres** do glicerol com três **ácidos graxos**, ácidos de cadeia longa (em geral 12 a 20 carbonos).',
        'Cadeias **saturadas** se empacotam bem: **gordura sólida** (manteiga, banha). Duplas **cis** dobram a cadeia: **óleo líquido** (soja, oliva).',
      ],
      molecules: [
        { smiles: '[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O', label: 'triglicerídeo (R = cadeias longas)' },
        { smiles: 'CCCCCCCC/C=C\\CCCCCCCC(=O)O', label: 'ácido oleico: dupla cis' },
      ],
    },
    {
      title: 'Saponificação',
      body: [
        'Aquecido com uma base forte (NaOH ou KOH), o triglicerídeo tem os três ésteres quebrados: formam-se **glicerol** e três **sais de ácidos graxos**, que são o **sabão**.',
      ],
      scheme: {
        left: [m('[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O'), t('NaOH', '3')],
        right: [m('OCC(O)CO', { name: 'glicerol' }), m('*C(=O)[O-].[Na+]', { name: 'sabão' }, '3')],
      },
    },
    {
      title: 'Como o sabão limpa',
      body: [
        'O sabão tem uma **cabeça polar** (–COO⁻ Na⁺), que interage com a água, e uma **cauda apolar**, a cadeia de carbonos, que se mistura com a gordura.',
        'As caudas envolvem a gordura e as cabeças ficam para fora, formando **micelas** que a água leva embora.',
      ],
      molecules: [{ smiles: 'CCCCCCCCCCCC(=O)[O-].[Na+]', highlight: [11, 12, 13], label: 'laurato de sódio: cabeça polar destacada' }],
    },
    {
      title: 'Biodiesel',
      body: [
        'Na **transesterificação**, o triglicerídeo reage com **metanol** ou **etanol** (catalisador básico). Formam-se ésteres dos ácidos graxos, o **biodiesel**, e **glicerol** como coproduto.',
        'É um combustível renovável e quase sem enxofre.',
      ],
      scheme: {
        left: [m('[*:1]C(=O)OCC(OC([*:2])=O)COC([*:3])=O'), t('CH₃OH', '3')],
        right: [m('*C(=O)OC', { name: 'biodiesel' }, '3'), m('OCC(O)CO', { name: 'glicerol' })],
        over: 'NaOH',
      },
      tip: 'Em água dura (Ca²⁺, Mg²⁺) o sabão precipita; detergentes sintéticos não. Os de cadeia ramificada não são biodegradáveis e fazem espuma nos rios.',
    },
  ],

  proteinas: [
    {
      title: 'Aminoácidos',
      body: [
        'Proteínas são feitas de **α-aminoácidos**: um **grupo amino (–NH₂)** e uma **carboxila (–COOH)** no mesmo carbono, o **carbono α**, mais um grupo R que muda de um aminoácido para outro.',
        'As proteínas humanas usam 20 aminoácidos diferentes.',
      ],
      molecules: [
        { smiles: 'CC(N)C(=O)O', marks: [1], label: 'alanina: o carbono α marcado' },
        { smiles: 'NCC(=O)O', label: 'glicina: R = H' },
      ],
    },
    {
      title: 'Ligação peptídica',
      body: [
        'A carboxila de um aminoácido reage com o grupo amino de outro e sai **água**. Forma-se a **ligação peptídica**, uma amida **–CO–NH–**.',
        'Com n aminoácidos há **n − 1** ligações peptídicas. As proteínas são **poliamidas** naturais.',
      ],
      scheme: {
        left: [m('NCC(=O)O', { name: 'glicina' }), m('CC(N)C(=O)O', { name: 'alanina' })],
        right: [m(GLY_ALA, { name: 'Gly-Ala', highlight: PEPTIDE_BOND }), t('H₂O')],
      },
    },
    {
      title: 'Carboidratos',
      body: [
        'Açúcares são **poli-hidroxialdeídos** ou **poli-hidroxicetonas**: vários –OH e um grupo C=O.',
        'Com aldeído na ponta é uma **aldose**, como a **glicose**; com cetona no meio, uma **cetose**, como a **frutose**. As duas são C₆H₁₂O₆: são isômeras.',
      ],
      molecules: [
        { smiles: 'OCC(O)C(O)C(O)C(O)C=O', highlight: [10, 11], label: 'glicose: aldose' },
        { smiles: 'OCC(O)C(O)C(O)C(=O)CO', highlight: [8, 9], label: 'frutose: cetose' },
      ],
    },
    {
      title: 'Ligação glicosídica',
      body: [
        'Dois açúcares se unem por uma **ligação glicosídica** (–O–), liberando água. **Sacarose** = glicose + frutose; **maltose** = glicose + glicose; **lactose** = glicose + galactose.',
        '**Amido**, **glicogênio** e **celulose** são polímeros da glicose; muda o tipo de ligação e a forma da cadeia.',
      ],
      molecules: [{ smiles: MALTOSE, highlight: rx.glycosidicOxygens(MALTOSE), label: 'maltose: a ponte –O– destacada' }],
      tip: 'Digestão é hidrólise: proteínas viram aminoácidos (quebra da ligação peptídica) e o amido vira glicose (quebra da glicosídica).',
    },
  ],
};
