/**
 * Unit 7 — polymers, fats and soaps, proteins and sugars. Repeat units, soaps,
 * peptides and disaccharides are built by the reaction engine from their monomers.
 */
import { FUNCTION_INFO, type FunctionId, functionSet, functionalGroups } from '../chem/analysis.ts';
import { Draft } from '../chem/graph.ts';
import * as rx from '../chem/reactions.ts';
import {
  cap,
  choice,
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
  scheme,
  tap,
  the,
  unknown,
  written,
} from './kit.ts';
import { AMINO_ACIDS, FATTY_ACIDS, GENERIC, MONOSACCHARIDES, POLYMERS, type PolymerInfo, SUGAR_RINGS } from './pools.ts';
import type { Rng } from './random.ts';
import type { Exercise, MolSpec } from './types.ts';

const spec = (smiles: string, extra: Partial<MolSpec> = {}): MolSpec => ({ smiles, ...extra });

// ---------------------------------------------------------------------------
// Polímeros

const repeatCache = new Map<string, string>();
export function repeatUnit(p: PolymerInfo): string {
  let r = repeatCache.get(p.id);
  if (!r) {
    const [a, b] = p.monomers.map((m) => m.smiles);
    r = p.kind === 'adição' ? rx.additionPolymer(a) : rx.condensationPolymer(a, b);
    repeatCache.set(p.id, r);
  }
  return r;
}

/**
 * Addition polymers read best condensed (–CH₂–CHCl–), condensation ones as skeletal; a
 * benzene ring written out as HC=CH is too heavy, so polystyrene stays skeletal too.
 */
export function polymerFormula(repeat: string, kind: PolymerInfo['kind']): MolSpec['formula'] {
  return kind === 'adição' && !mol(repeat).rings.length ? 'condensed' : 'skeletal';
}

export function polymerSpec(p: PolymerInfo, extra: Partial<MolSpec> = {}): MolSpec {
  const smiles = repeatUnit(p);
  return { smiles, polymer: true, formula: polymerFormula(smiles, p.kind), ...extra };
}

/** "polietileno (PE)" inside a sentence; `displayName` capitalised for options. */
const polyName = (p: PolymerInfo) => (p.short ? `${p.name} (${p.short})` : p.name);
const displayName = (p: PolymerInfo) => cap(polyName(p));
const ADDITION = POLYMERS.filter((p) => p.kind === 'adição');
const CONDENSATION = POLYMERS.filter((p) => p.kind === 'condensação');

/** The tempting wrong repeat unit: ends added to the C=C carbons but the double bond kept. */
function keptDouble(monomer: string): string | undefined {
  const [bond] = rx.carbonMultipleBonds(monomer, 2);
  const m = mol(monomer);
  if (!bond || m.atoms[bond.a].hydrogens === 0 || m.atoms[bond.b].hydrogens === 0) return undefined;
  const d = new Draft(m);
  d.attach(bond.a, '*');
  d.attach(bond.b, '*');
  return d.smiles();
}

export function polymers(rng: Rng): Exercise[] {
  const fromMonomer = () => {
    const p = rng.pick(ADDITION);
    const monomer = p.monomers[0];
    const correct = repeatUnit(p);
    const wrong = distinctFrom(correct, [keptDouble(monomer.smiles), ...rng.shuffle(ADDITION.filter((q) => q !== p)).map(repeatUnit)], 2);
    return pick(
      rng,
      'Qual polímero se forma pela adição de muitas moléculas deste monômero?',
      polymerSpec(p),
      wrong.map((s) => ({ smiles: s, polymer: true, formula: polymerFormula(s, 'adição') })),
      `A ligação dupla ${of(monomer.name)} se abre e cada molécula se liga às vizinhas pelos dois carbonos que eram da dupla. Nenhum átomo sai: forma-se ${the(polyName(p))}.`,
      spec(monomer.smiles, { name: monomer.name, caption: cap(monomer.name) }),
    );
  };

  const toMonomer = () => {
    const p = rng.pick(ADDITION);
    const monomer = p.monomers[0];
    const wrong = distinctFrom(monomer.smiles, [rx.hydrogenate(monomer.smiles), ...rng.shuffle(ADDITION.filter((q) => q !== p)).map((q) => q.monomers[0].smiles)], 2);
    return pick(
      rng,
      'Qual é o monômero deste polímero de adição?',
      spec(monomer.smiles, { name: monomer.name }),
      wrong.map((s) => spec(s)),
      `Os dois carbonos da cadeia principal, unidos por ligação simples no polímero, estavam unidos por uma dupla no monômero: ${the(monomer.name)}.`,
      polymerSpec(p),
    );
  };

  const nameOfPolymer = () => {
    const p = rng.pick(POLYMERS);
    const others = rng.sample(POLYMERS.filter((q) => q !== p), 3);
    return choice(
      rng,
      'Que polímero é este?',
      displayName(p),
      others.map(displayName),
      `${displayName(p)}, feito de ${joinPt(p.monomers.map((m) => m.name))}. ${p.note}`,
      polymerSpec(p),
    );
  };

  const useOf = () => {
    const p = rng.pick(POLYMERS);
    const others = rng.sample(POLYMERS.filter((q) => q !== p), 3);
    return choice(
      rng,
      `Para que é usado ${the(polyName(p))}?`,
      p.use,
      others.map((o) => o.use),
      `${p.use}. ${p.note}`,
      polymerSpec(p),
    );
  };

  const kind = () => {
    const p = rng.pick(POLYMERS);
    const link = functionalGroups(mol(repeatUnit(p))).find((g) => g.id === 'éster' || g.id === 'amida')?.id ?? (p.id === 'pla' ? 'éster' : undefined);
    return orderedChoice(
      'Este polímero é de adição ou de condensação?',
      ['Adição', 'Condensação'],
      p.kind === 'adição' ? 'Adição' : 'Condensação',
      p.kind === 'adição'
        ? `A cadeia principal só tem carbonos, em ligações simples: veio de um monômero com C=C que se abriu. ${cap(the(polyName(p)))} é um polímero de adição.`
        : `Os monômeros estão unidos por grupos ${link === 'amida' ? 'amida (–CONH–)' : 'éster (–COO–)'}, e cada ligação liberou uma molécula de água. ${cap(the(polyName(p)))} é um polímero de condensação.`,
      polymerSpec(p),
    );
  };

  const linkGroup = () => {
    const p = rng.pick(CONDENSATION.filter((q) => q.id !== 'pla'));
    const group = functionalGroups(mol(repeatUnit(p))).find((g) => g.id === 'éster' || g.id === 'amida')!;
    return choice(
      rng,
      'Que função orgânica une os monômeros neste polímero?',
      cap(group.id),
      ['Éster', 'Amida', 'Éter', 'Cetona'],
      group.id === 'éster'
        ? 'A carboxila de um monômero reagiu com a hidroxila do outro: a ligação entre eles é um éster (–COO–), e o polímero é um poliéster.'
        : 'A carboxila de um monômero reagiu com o grupo amino do outro: a ligação é uma amida (–CONH–), e o polímero é uma poliamida.',
      polymerSpec(p, { highlight: group.atoms }),
    );
  };

  const byproduct = () => {
    const p = rng.pick(CONDENSATION);
    const ex = choice(
      rng,
      `Na formação ${of(polyName(p))}, que molécula pequena sai a cada ligação entre monômeros?`,
      'Água (H₂O)',
      ['Gás carbônico (CO₂)', 'Gás hidrogênio (H₂)', 'Metanol (CH₃OH)'],
      'O –OH da carboxila sai junto com um H do –OH ou do –NH₂ do outro monômero: forma-se uma molécula de água a cada ligação. Por isso se chama polimerização por condensação.',
    );
    return {
      ...ex,
      scheme: scheme(
        p.monomers.map((m) => drawn(m.smiles, { name: m.name }, 'n')),
        [{ mol: polymerSpec(p) }, unknown()],
      ),
    };
  };

  return lessonSet(rng, [fromMonomer, nameOfPolymer, kind, toMonomer, useOf, linkGroup, byproduct, kind]);
}

// ---------------------------------------------------------------------------
// Gorduras e sabões

const SATURATED = FATTY_ACIDS.filter((f) => f.doubleBonds === 0);

export function fats(rng: Rng): Exercise[] {
  const soapOf = (acid: string) => rx.carboxylateSalt(acid, 'Na');

  const polarPart = () => {
    const acid = rng.pick(SATURATED);
    const soap = soapOf(acid.smiles);
    const m = mol(soap);
    const head = functionalGroups(m).find((g) => g.id === 'sal orgânico')!.atoms;
    const tail = m.atoms.filter((a) => a.element === 'C' && !head.includes(a.index)).map((a) => a.index);
    const polar = rng.next() < 0.5;
    return orderedChoice(
      'A parte destacada deste sabão é polar ou apolar?',
      ['Polar (hidrofílica)', 'Apolar (hidrofóbica)'],
      polar ? 'Polar (hidrofílica)' : 'Apolar (hidrofóbica)',
      polar
        ? 'O carboxilato (–COO⁻ Na⁺) tem carga: atrai as moléculas de água. É a "cabeça" hidrofílica do sabão.'
        : 'A longa cadeia de carbono e hidrogênio é apolar: mistura-se com a gordura, não com a água. É a "cauda" hidrofóbica (lipofílica).',
      spec(soap, { highlight: polar ? head : tail, caption: cap(acid.soap) }),
    );
  };

  const tapHead = () => {
    const acid = rng.pick(SATURATED.slice(0, 2));
    const soap = soapOf(acid.smiles);
    const m = mol(soap);
    const head = functionalGroups(m).find((g) => g.id === 'sal orgânico')!.atoms;
    // Only the head and the first carbons of the tail respond: a whole C12 chain of targets is too fine to tap.
    const carboxylC = head.find((a) => m.atoms[a].element === 'C')!;
    const near: number[] = [];
    for (let at = carboxylC, k = 0; k < 4; k++) {
      const nextC = m.neighbors(at).find((x) => m.atoms[x].element === 'C' && !near.includes(x) && x !== carboxylC);
      if (nextC === undefined) break;
      near.push(nextC);
      at = nextC;
    }
    return tap(
      'Toque nos átomos do grupo polar do sabão (o carboxilato, –COO⁻).',
      spec(soap),
      head,
      'O carbono da carboxila e os dois oxigênios, um deles com carga negativa, formam a cabeça polar. O resto da molécula é a cauda apolar.',
      [...head, ...near],
    );
  };

  const state = () => {
    const acid = rng.pick(FATTY_ACIDS);
    const solid = acid.doubleBonds === 0;
    return orderedChoice(
      `À temperatura ambiente, um triglicerídeo formado só pelo ${acid.name} tende a ser:`,
      ['Sólido (gordura)', 'Líquido (óleo)'],
      solid ? 'Sólido (gordura)' : 'Líquido (óleo)',
      solid
        ? 'Cadeia saturada, sem duplas: as cadeias ficam retas, se empacotam bem e se atraem mais. O ponto de fusão é alto: gordura sólida, como a manteiga e o sebo.'
        : `A cadeia tem ${plural(acid.doubleBonds, 'dupla', 'duplas')} cis, que dobram a cadeia. As moléculas se empacotam mal, o ponto de fusão cai e a substância é um óleo líquido, como os vegetais.`,
      spec(acid.smiles, { name: acid.name }),
    );
  };

  const reactionName = () => {
    const lauric = SATURATED[0].smiles;
    const variants = [
      {
        name: 'Saponificação',
        why: 'O triglicerídeo reage com uma base forte (NaOH): os ésteres se quebram e saem glicerol e sais de ácidos graxos, que são o sabão.',
        s: scheme([drawn(GENERIC.triglyceride), written('NaOH', '3')], [drawn(GENERIC.glycerol), drawn(GENERIC.soap, {}, '3')]),
      },
      {
        name: 'Transesterificação',
        why: 'Cada éster troca o glicerol pelo metanol: formam-se ésteres metílicos (o biodiesel) e sai glicerol.',
        s: scheme([drawn(GENERIC.triglyceride), written('CH₃OH', '3')], [drawn(GENERIC.methylEster, {}, '3'), drawn(GENERIC.glycerol)], { over: 'NaOH' }),
      },
      {
        name: 'Hidrogenação',
        why: 'O H₂ se adiciona à dupla C=C (catalisador de níquel) e a cadeia fica saturada. É assim que óleos viram margarina.',
        s: scheme([drawn(FATTY_ACIDS[4].smiles, { name: FATTY_ACIDS[4].name }), written('H₂')], [drawn(FATTY_ACIDS[3].smiles, { name: FATTY_ACIDS[3].name })], { over: 'Ni' }),
      },
      {
        name: 'Esterificação',
        why: 'Ácido carboxílico e álcool formam um éster e água, em meio ácido. Ácidos graxos livres também viram biodiesel assim.',
        s: scheme([drawn(lauric), written('CH₃OH')], [drawn(rx.esterify(lauric, 'CO')), written('H₂O')], { over: 'H⁺', reversible: true }),
      },
    ];
    const v = rng.pick(variants);
    const ex = choice(rng, 'Que reação está representada?', v.name, variants.map((x) => x.name), v.why);
    return { ...ex, scheme: v.s };
  };

  const biodieselByproduct = () => {
    const ex = pick(
      rng,
      'Na produção de biodiesel, o óleo reage com metanol. Além do biodiesel, que substância se forma?',
      spec(GENERIC.glycerol, { name: 'glicerol' }),
      rng.sample([spec('CO', { name: 'metanol' }), spec('CC(=O)O', { name: 'ácido etanoico' }), spec('OCCO', { name: 'etano-1,2-diol' })], 2),
      'Na transesterificação, cada éster do triglicerídeo troca o glicerol pelo metanol. Saem três ésteres metílicos, o biodiesel, e o glicerol (glicerina), usado em sabonetes e cosméticos.',
    );
    return {
      ...ex,
      scheme: scheme([drawn(GENERIC.triglyceride), written('CH₃OH', '3')], [drawn(GENERIC.methylEster, {}, '3'), unknown()], { over: 'NaOH' }),
    };
  };

  const soapPick = () => {
    const acid = rng.pick(SATURATED.slice(0, 3));
    return pick(
      rng,
      `Um triglicerídeo ${of(acid.name)} foi aquecido com NaOH. Qual é o sabão formado?`,
      spec(soapOf(acid.smiles)),
      [spec(rx.esterify(acid.smiles, 'CO')), spec(acid.smiles)],
      'A saponificação quebra os ésteres com NaOH: cada cadeia sai como sal de sódio do ácido graxo (–COO⁻ Na⁺), que é o sabão. O éster metílico seria biodiesel, e o ácido livre só sai na hidrólise ácida.',
      spec(acid.smiles, { name: acid.name, caption: cap(acid.name) }),
    );
  };

  const h2Oil = () => {
    const acid = rng.pick(FATTY_ACIDS.slice(3));
    const n = rx.h2ToSaturate(acid.smiles);
    return orderedChoice(
      `Quantos mols de H₂ saturam 1 mol ${of(acid.name)}?`,
      numberOptions(rng, n, 0),
      String(n),
      n
        ? `Cada dupla C=C consome 1 H₂, e o ${acid.name} tem ${plural(n, 'dupla', 'duplas')}. Hidrogenado, ele vira ácido esteárico, saturado.`
        : 'O ácido esteárico já é saturado: não tem dupla C=C para receber H₂.',
      spec(acid.smiles, { name: acid.name }),
    );
  };

  const hardWater = () =>
    choice(
      rng,
      'Em água dura, rica em íons Ca²⁺ e Mg²⁺, o sabão faz pouca espuma. Por quê?',
      'Forma sais de cálcio e magnésio insolúveis, que precipitam',
      ['O sabão evapora com o calor da água', 'Os íons quebram as cadeias de carbono do sabão', 'A água dura é apolar e não dissolve o sabão'],
      'Os ânions do sabão (RCOO⁻) se juntam ao Ca²⁺ e ao Mg²⁺ e formam sais insolúveis, aquela crosta branca. Detergentes sintéticos (sulfonatos) não precipitam assim.',
    );

  return lessonSet(rng, [polarPart, state, reactionName, tapHead, biodieselByproduct, soapPick, h2Oil, hardWater]);
}

// ---------------------------------------------------------------------------
// Proteínas e açúcares

const SMALL_AA = AMINO_ACIDS.filter((a) => ['Gly', 'Ala', 'Ser', 'Val', 'Leu', 'Phe'].includes(a.code));
const ASPARTAME = { smiles: 'COC(=O)C(Cc1ccccc1)NC(=O)C(N)CC(=O)O', name: 'aspartame' };
const SIZE = ['', '', '', 'triose', 'tetrose', 'pentose', 'hexose'];

/** Disaccharides drawn without stereo: one glucose's C1 bonded to the other sugar's oxygen. */
export const DISACCHARIDES = [
  {
    name: 'maltose (glicose + glicose)',
    smiles: rx.condense(SUGAR_RINGS.glucose.smiles, SUGAR_RINGS.glucose.anomericO, SUGAR_RINGS.glucose.anomericC, SUGAR_RINGS.glucose.smiles, SUGAR_RINGS.glucose.o4),
  },
  {
    name: 'sacarose (glicose + frutose)',
    smiles: rx.condense(SUGAR_RINGS.glucose.smiles, SUGAR_RINGS.glucose.anomericO, SUGAR_RINGS.glucose.anomericC, SUGAR_RINGS.fructose.smiles, SUGAR_RINGS.fructose.anomericO),
  },
];

const ALL_FUNCTIONS: FunctionId[] = ['álcool', 'fenol', 'aldeído', 'cetona', 'ácido carboxílico', 'éster', 'éter', 'amina', 'amida'];

export function biomolecules(rng: Rng): Exercise[] {
  const randomPeptide = (min: number, max: number) => {
    const n = min + rng.int(max - min + 1);
    const residues = Array.from({ length: n }, () => rng.pick(SMALL_AA));
    return { smiles: rx.peptide(residues.map((r) => r.smiles)), name: residues.map((r) => r.code).join('-'), n };
  };

  const tapPeptide = () => {
    const p = randomPeptide(2, 3);
    const m = mol(p.smiles);
    const bonds = rx.peptideBonds(m);
    return tap(
      'Toque no nitrogênio de cada ligação peptídica.',
      spec(p.smiles, { name: p.name }),
      bonds.map((b) => b.n),
      `A ligação peptídica é a amida –CO–NH– que une um aminoácido ao seguinte. O –NH₂ da ponta não faz parte de nenhuma: ${p.n} aminoácidos, ${plural(p.n - 1, 'ligação', 'ligações')}.`,
      m.atoms.filter((a) => a.element === 'N' || a.element === 'O').map((a) => a.index),
    );
  };

  const countPeptide = () => {
    const p = rng.next() < 0.25 ? { ...ASPARTAME, n: 2 } : randomPeptide(2, 4);
    const n = rx.peptideBonds(p.smiles).length;
    return orderedChoice(
      'Quantas ligações peptídicas há nesta molécula?',
      numberOptions(rng, n, 1),
      String(n),
      p.name === 'aspartame'
        ? 'O aspartame, adoçante, é um dipeptídeo (ácido aspártico + fenilalanina) com a carboxila final na forma de éster metílico: uma ligação peptídica.'
        : `Com ${p.n} aminoácidos em fila há ${plural(n, 'ligação peptídica', 'ligações peptídicas')} (–CO–NH–): sempre uma a menos que o número de aminoácidos.`,
      spec(p.smiles, { name: p.name, caption: p.name === 'aspartame' ? 'Aspartame' : undefined }),
    );
  };

  const dipeptide = () => {
    const [a, b, c] = rng.sample(SMALL_AA, 3);
    const correct = rx.peptide([a.smiles, b.smiles]);
    const wrong = distinctFrom(correct, [rx.peptide([b.smiles, a.smiles]), rx.peptide([a.smiles, c.smiles]), rx.peptide([c.smiles, b.smiles])], 2);
    const ex = pick(
      rng,
      `A carboxila ${of(a.name)} reage com o grupo amino ${of(b.name)}. Qual dipeptídeo se forma?`,
      spec(correct),
      wrong.map((s) => spec(s)),
      `O carbono da carboxila ${of(a.name)} se liga ao nitrogênio ${of(b.name)}, e sai uma água. A ordem importa: ${a.code}-${b.code} é diferente de ${b.code}-${a.code}.`,
    );
    return {
      ...ex,
      scheme: scheme([drawn(a.smiles, { name: a.name }), drawn(b.smiles, { name: b.name })], [unknown(), written('H₂O')]),
    };
  };

  const aminoFunctions = () => {
    const aa = rng.pick(AMINO_ACIDS);
    const m = mol(aa.smiles);
    const fs = functionSet(m).sort();
    const correct = cap(joinPt(fs));
    const distractors = new Set<string>();
    for (let tries = 0; distractors.size < 3 && tries < 40; tries++) {
      const swapped = [...fs];
      const k = rng.int(swapped.length);
      if (rng.next() < 0.4 && swapped.length > 2) swapped.splice(k, 1);
      else swapped[k] = rng.pick(ALL_FUNCTIONS.filter((f) => !fs.includes(f)));
      const text = cap(joinPt([...new Set(swapped)].sort()));
      if (text !== correct) distractors.add(text);
    }
    // Everything beyond the α-amino and α-carboxyl groups comes from the side chain.
    const extras = functionalGroups(m);
    for (const id of ['amina', 'ácido carboxílico'] as const) extras.splice(extras.findIndex((g) => g.id === id), 1);
    return choice(
      rng,
      'Quais funções orgânicas aparecem neste aminoácido?',
      correct,
      [...distractors],
      `Todo aminoácido tem amina (–NH₂) e ácido carboxílico (–COOH). ${
        extras.length
          ? `A cadeia lateral ${of(aa.name)} traz ainda ${joinPt(extras.map((g) => `${g.id === 'ácido carboxílico' ? 'outra carboxila' : g.id === 'amina' ? 'outro grupo amino' : g.id} (${FUNCTION_INFO[g.id].group})`))}.`
          : `A cadeia lateral ${of(aa.name)} não traz outros grupos funcionais.`
      }`,
      spec(aa.smiles, { name: aa.name, caption: cap(aa.name) }),
    );
  };

  const sugarKind = () => {
    const s = rng.pick(MONOSACCHARIDES);
    const kind = rx.sugarKind(s.smiles)!;
    const m = mol(s.smiles);
    const carbonyl = functionalGroups(m).find((g) => g.id === 'aldeído' || g.id === 'cetona')!;
    return orderedChoice(
      'Este açúcar é uma aldose ou uma cetose?',
      ['Aldose', 'Cetose'],
      kind === 'aldose' ? 'Aldose' : 'Cetose',
      `${kind === 'aldose' ? 'O C=O está na ponta da cadeia (aldeído): aldose' : 'O C=O está no meio da cadeia (cetona): cetose'}. Com ${s.carbons} carbonos, ${the(s.name)} é uma ${kind === 'aldose' ? 'aldo' : 'ceto'}${SIZE[s.carbons]}. Os outros carbonos têm –OH: açúcares são poli-hidroxialdeídos ou poli-hidroxicetonas.`,
      spec(s.smiles, { name: s.name, caption: cap(s.name), highlight: carbonyl.atoms }),
    );
  };

  const tapGlycosidic = () => {
    const d = rng.pick(DISACCHARIDES);
    const m = mol(d.smiles);
    return tap(
      'Toque no oxigênio da ligação glicosídica, a ponte que une os dois açúcares.',
      spec(d.smiles, { name: d.name, caption: cap(d.name) }),
      rx.glycosidicOxygens(m),
      'A ligação glicosídica é o –O– que liga os dois anéis. Ela se forma quando dois –OH se unem e sai uma molécula de água; a digestão (hidrólise) a quebra de novo.',
      m.atoms.filter((a) => a.element === 'O').map((a) => a.index),
    );
  };

  const concept = () => {
    const variants = [
      {
        q: 'Amido, celulose e glicogênio são polímeros naturais formados pela união de muitas moléculas de:',
        a: 'Glicose',
        d: ['Frutose', 'Sacarose', 'Aminoácidos'],
        why: 'Os três são polissacarídeos de glicose ligados por ligações glicosídicas. Mudam o tipo de ligação e a forma da cadeia: o amido e o glicogênio são reserva de energia, a celulose forma a parede das células vegetais.',
      },
      {
        q: 'Na digestão das proteínas, que ligações as enzimas quebram por hidrólise?',
        a: 'Ligações peptídicas (amidas)',
        d: ['Ligações glicosídicas', 'Ligações éster', 'Ligações duplas C=C'],
        why: 'As proteases hidrolisam as ligações peptídicas (–CO–NH–), liberando os aminoácidos que o corpo usa para montar suas próprias proteínas.',
      },
      {
        q: 'Quando dois aminoácidos formam uma ligação peptídica, que outra substância se forma?',
        a: 'Água',
        d: ['Gás carbônico', 'Amônia', 'Glicose'],
        why: 'É uma condensação: o –OH da carboxila de um aminoácido e um H do grupo amino do outro saem juntos como H₂O.',
      },
    ];
    const v = rng.pick(variants);
    return choice(rng, v.q, v.a, v.d, v.why);
  };

  const alphaPick = () => {
    const aa = rng.pick(AMINO_ACIDS.slice(0, 7));
    const others = rng.sample(
      [
        spec('NCCC(=O)O', { name: 'β-alanina' }),
        spec('CC(O)C(=O)O', { name: 'ácido lático' }),
        spec('NCC(N)=O', { name: 'glicinamida' }),
        spec('NCCO', { name: '2-aminoetanol' }),
      ],
      2,
    );
    return pick(
      rng,
      'Qual destas estruturas é um α-aminoácido, como os das proteínas?',
      spec(aa.smiles, { name: aa.name }),
      others,
      `No α-aminoácido, o grupo amino (–NH₂) e a carboxila (–COOH) estão presos ao mesmo carbono, o carbono α. É o caso ${of(aa.name)}.`,
    );
  };

  return lessonSet(rng, [tapPeptide, dipeptide, aminoFunctions, sugarKind, countPeptide, tapGlycosidic, concept, alphaPick]);
}
