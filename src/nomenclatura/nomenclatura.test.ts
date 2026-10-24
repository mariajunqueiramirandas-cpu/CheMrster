import { describe, expect, it } from 'vitest';
import { type FunctionId, functionSet } from '../chem/analysis.ts';
import { moleculeFromSmiles } from '../nanquim/index.ts';
import { ANIONS, COMPOUNDS, compoundById, ofCategory, parentAcid } from './catalog.ts';
import { check, normalize } from './check.ts';
import { DAILY_SIZE, daily, dailySize, msToNext, practicePick, puzzleDate, puzzleNumber } from './daily.ts';
import { explain } from './explain.ts';
import { counts, ionText, pretty, runs } from './formula.ts';
import { type OrgFunction, partCarbons } from './organic.ts';
import { CATEGORIES, word } from './pieces.ts';
import { type DayPlay, type Days, questionsOf, stats } from './play.ts';
import { answerDaily, revive, saveStore } from './store.ts';

const byId = (id: string) => {
  const c = compoundById(id);
  if (!c) throw new Error(`missing ${id}`);
  return c;
};

describe('names', () => {
  it('spells words the way Portuguese writes them', () => {
    expect(word('hipo', 'clor', 'oso')).toBe('hipocloroso');
    expect(word(undefined, 'sulf', 'ico')).toBe('sulfúrico');
    expect(word(undefined, 'sulf', 'oso')).toBe('sulfuroso');
    expect(word(undefined, 'sulf', 'idrico')).toBe('sulfídrico');
    expect(word('tio', 'sulf', 'ato')).toBe('tiossulfato');
    expect(word('hidrogeno', 'sulf', 'ato')).toBe('hidrogenossulfato');
    expect(word('orto', 'silic', 'ico')).toBe('ortossilícico');
    expect(word('di-hidrogeno', 'fosf', 'ato')).toBe('di-hidrogenofosfato');
    expect(word('per', 'mangan', 'ato')).toBe('permanganato');
    expect(word(undefined, 'carbon', 'ico')).toBe('carbônico');
  });

  it.each([
    ['HCl', 'ácido clorídrico'],
    ['H2SO4', 'ácido sulfúrico'],
    ['HClO', 'ácido hipocloroso'],
    ['HClO4', 'ácido perclórico'],
    ['H3PO4', 'ácido fosfórico'],
    ['H4P2O7', 'ácido pirofosfórico'],
    ['H2Cr2O7', 'ácido dicrômico'],
    ['HSCN', 'ácido tiociânico'],
    ['NaOH', 'hidróxido de sódio'],
    ['Fe(OH)3', 'hidróxido de ferro(III)'],
    ['NH4OH', 'hidróxido de amônio'],
    ['NaCl', 'cloreto de sódio'],
    ['Fe2(SO4)3', 'sulfato de ferro(III)'],
    ['NaHCO3', 'hidrogenocarbonato de sódio'],
    ['KMnO4', 'permanganato de potássio'],
    ['K2MnO4', 'manganato de potássio'],
    ['Na2S2O3', 'tiossulfato de sódio'],
    ['NH4H2PO4', 'di-hidrogenofosfato de amônio'],
    ['(NH4)2SO4', 'sulfato de amônio'],
    ['Ca3(PO4)2', 'fosfato de cálcio'],
    ['Ca(H2PO4)2', 'di-hidrogenofosfato de cálcio'],
    ['CuCl', 'cloreto de cobre(I)'],
    ['Fe(SCN)3', 'tiocianato de ferro(III)'],
    ['NH4CNO', 'cianato de amônio'],
  ])('%s is %s', (formula, name) => {
    expect(byId(formula).name).toBe(name);
  });

  it('gives traditional and everyday names', () => {
    expect(byId('Fe2(SO4)3').traditional).toContain('sulfato férrico');
    expect(byId('NaHCO3').traditional).toContain('bicarbonato de sódio');
    expect(byId('Cu(OH)2').traditional).toContain('hidróxido cúprico');
    expect(byId('NaOH').common).toContain('soda cáustica');
    expect(byId('H3PO4').names).toEqual(['ácido fosfórico', 'ácido ortofosfórico']);
  });

  it('traces anions back to their acids', () => {
    const name = (n: string) => parentAcid(ANIONS.find((a) => a.name === n)!);
    expect(name('hipoclorito')).toBe('ácido hipocloroso');
    expect(name('sulfeto')).toBe('ácido sulfídrico');
    expect(name('hidrogenocarbonato')).toBe('ácido carbônico');
    expect(name('dicromato')).toBe('ácido dicrômico');
  });
});

describe('catalog', () => {
  it('has unique formulas and names, and every kind at every tier', () => {
    expect(new Set(COMPOUNDS.map((c) => c.id)).size).toBe(COMPOUNDS.length);
    // Two compounds with the same typed name would make one of them unanswerable.
    const typed = COMPOUNDS.flatMap((c) => c.names.map(normalize));
    expect(new Set(typed).size).toBe(typed.length);
    for (const cat of CATEGORIES) for (const tier of [1, 2, 3] as const) expect(ofCategory(cat, tier).length).toBeGreaterThanOrEqual(6);
  });

  it('builds neutral formulas from the ions', () => {
    for (const c of COMPOUNDS.filter((c) => c.cation)) {
      const atoms = counts(c.formula);
      const cationAtoms = counts(c.cation!.piece.symbol);
      const [el, per] = Object.entries(cationAtoms).find(([e]) => e !== 'H')!;
      // Ammonium's N is the only N on the cation side unless the anion brings its own.
      if (c.cation!.piece.id === 'amonio' && c.anion && 'N' in counts(c.anion.formula)) continue;
      const nCations = atoms[el] / per;
      const anionCharge = c.anion?.charge ?? 1;
      const anionFormula = c.anion?.formula ?? 'OH';
      const probe = Object.keys(counts(anionFormula)).find((e) => !(e in cationAtoms))!;
      const nAnions = atoms[probe] / counts(anionFormula)[probe];
      expect(nCations * c.cation!.charge, c.formula).toBe(nAnions * anionCharge);
    }
  });

  it('names every oxyacid by the oxidation number of its formula', () => {
    const series: Record<string, Record<number, string>> = {
      clor: { 1: 'hipo-oso', 3: '-oso', 5: '-ico', 7: 'per-ico' },
      brom: { 1: 'hipo-oso', 3: '-oso', 5: '-ico', 7: 'per-ico' },
      iod: { 1: 'hipo-oso', 3: '-oso', 5: '-ico', 7: 'per-ico' },
      sulf: { 4: '-oso', 6: '-ico' },
      nitr: { 3: '-oso', 5: '-ico' },
      fosf: { 1: 'hipo-oso', 3: '-oso', 5: '-ico' },
      mangan: { 6: '-ico', 7: 'per-ico' },
    };
    const symbol: Record<string, string> = { clor: 'Cl', brom: 'Br', iod: 'I', sulf: 'S', nitr: 'N', fosf: 'P', mangan: 'Mn' };
    for (const c of ofCategory('acido')) {
      const a = c.answers[0];
      const s = series[a.radical!];
      if (!s || a.sufixo === 'idrico' || a.prefixo === 'tio') continue;
      const atoms = counts(c.formula);
      const nox = (2 * (atoms.O ?? 0) - atoms.H) / atoms[symbol[a.radical!]];
      const prefix = a.prefixo === 'hipo' || a.prefixo === 'per' ? a.prefixo : '';
      expect(s[nox], c.formula).toBe(`${prefix}-${a.sufixo}`);
    }
  });

  it('explains every compound', () => {
    for (const c of COMPOUNDS) {
      const lines = explain(c);
      expect(lines.length, c.formula).toBeGreaterThan(2);
      expect(lines.join(' '), c.formula).toContain(c.name);
    }
    expect(explain(byId('H2SO4')).join('\n')).toContain('x = **+6**');
    expect(explain(byId('HClO')).join('\n')).toContain('**+1 hipo…oso**');
    expect(explain(byId('Fe2(SO4)3')).join('\n')).toContain('3 SO₄²⁻ dão carga −6; dividida entre 2 Fe, cada um é **Fe³⁺**');
    expect(explain(byId('NaCl')).join('\n')).toContain('**não** leva número romano');
    expect(explain(byId('H3PO4')).join('\n')).toContain('Também vale: **ácido ortofosfórico**');
  });
});

describe('organic names', () => {
  it.each([
    ['C', 'metano'],
    ['CC(C)O', 'propan-2-ol'],
    ['CC(C)=O', 'propanona'],
    ['CC(C)C', 'metilpropano'],
    ['CC(C)(C)C', '2,2-dimetilpropano'],
    ['CCCC(CC)C(C)C', '3-etil-2-metil-hexano'],
    ['C=CC=C', 'buta-1,3-dieno'],
    ['C=CC(C)=C', '2-metilbuta-1,3-dieno'],
    ['C=CCO', 'prop-2-en-1-ol'],
    ['OCCO', 'etano-1,2-diol'],
    ['OCC(O)CO', 'propano-1,2,3-triol'],
    ['C1CCCCC1', 'ciclo-hexano'],
    ['Cc1ccccc1', 'metilbenzeno'],
    ['CC(=O)O', 'ácido etanoico'],
    ['OC(=O)C(=O)O', 'ácido etanodioico'],
    ['CC(O)C(=O)O', 'ácido 2-hidroxipropanoico'],
    ['CCOC(C)=O', 'etanoato de etila'],
    ['CC(C)CCOC(C)=O', 'etanoato de 3-metilbutila'],
    ['CCOCC', 'etoxietano'],
    ['CN(C)C', 'N,N-dimetilmetanamina'],
    ['CC#N', 'etanonitrila'],
    ['ClC(Cl)Cl', 'triclorometano'],
    ['FC(F)(Cl)Cl', 'diclorodifluorometano'],
  ])('%s is %s', (smiles, name) => {
    expect(byId(smiles).name).toBe(name);
  });

  it('accepts the older style and the locants a name may leave out', () => {
    expect(byId('CC(C)O').names).toEqual(['propan-2-ol', '2-propanol']);
    expect(byId('C=CC=C').names).toEqual(['buta-1,3-dieno', '1,3-butadieno']);
    expect(byId('CC(C)=O').names).toEqual(['propanona', 'propan-2-ona', '2-propanona']);
    expect(byId('CC(C)C').names).toEqual(['metilpropano', '2-metilpropano']);
    // Nobody writes 1-eteno or 1-metilbenzeno.
    expect(byId('C=C').names).toEqual(['eteno']);
    expect(byId('Cc1ccccc1').names).toEqual(['metilbenzeno']);
    expect(byId('CN').names).toEqual(['metanamina', 'metilamina']);
  });

  it('gives the molecular formula', () => {
    expect(byId('CCO').formula).toBe('C2H6O');
    expect(byId('FC(F)(Cl)Cl').formula).toBe('CCl2F2');
    expect(byId('[O-][N+](=O)c1ccccc1').formula).toBe('C6H5NO2');
  });

  it('builds every name from parts that match the structure', () => {
    const groups: Record<OrgFunction, FunctionId | undefined> = {
      hidrocarboneto: undefined,
      alcool: 'álcool',
      fenol: 'fenol',
      aldeido: 'aldeído',
      cetona: 'cetona',
      acido: 'ácido carboxílico',
      ester: 'éster',
      eter: 'éter',
      amina: 'amina',
      amida: 'amida',
      haleto: 'haleto orgânico',
      nitrila: 'nitrila',
      nitro: 'nitrocomposto',
    };
    for (const c of ofCategory('organico')) {
      const def = c.organic!;
      const mol = moleculeFromSmiles(def.smiles);
      const found = functionSet(mol);
      const fn = groups[def.fn];
      if (fn) expect(found, c.name).toContain(fn);
      else expect(found, c.name).toEqual([]);
      const p = def.parts;
      if (!p) continue;
      expect(partCarbons(p), c.name).toBe(mol.atoms.filter((a) => a.element === 'C').length);
      const cc = (order: number) =>
        mol.bonds.filter((b) => b.order === order && !b.aromatic && mol.atoms[b.a].element === 'C' && mol.atoms[b.b].element === 'C').length;
      // Etenil (CH₂=CH–) brings its own double bond.
      const vinyl = (p.subs ?? []).filter((x) => x.group === 'etenil').length;
      expect(cc(2), c.name).toBe((p.en?.length ?? 0) + vinyl);
      expect(cc(3), c.name).toBe(p.in?.length ?? 0);
    }
  });
});

describe('formulas', () => {
  it('typesets counts and charges', () => {
    expect(pretty('Fe2(SO4)3')).toBe('Fe₂(SO₄)₃');
    expect(ionText('SO4', -2)).toBe('SO₄²⁻');
    expect(ionText('Na', 1)).toBe('Na⁺');
    expect(runs('Ca(OH)2')).toEqual([
      { text: 'Ca(OH)', sub: false },
      { text: '2', sub: true },
    ]);
    expect(counts('Ca(H2PO4)2')).toEqual({ Ca: 1, H: 4, P: 2, O: 8 });
  });
});

describe('checking typed names', () => {
  it('ignores accents, capitals, hyphens, spaces and how the numeral is written', () => {
    const fe = byId('Fe2(SO4)3');
    for (const typed of ['sulfato de ferro(III)', 'Sulfato de Ferro (III)', 'sulfato de ferro III', '  sulfato  de ferro(iii) ']) {
      expect(check(fe, typed).kind, typed).toBe('right');
    }
    expect(check(byId('H2SO4'), 'acido sulfurico').kind).toBe('right');
    expect(check(byId('NaH2PO4'), 'diidrogenofosfato de sódio').kind).toBe('right');
    expect(check(byId('NaH2PO4'), 'dihidrogenofosfato de sodio').kind).toBe('right');
    expect(check(byId('H3PO4'), 'ácido ortofosfórico').kind).toBe('right');
  });

  it('marks the wrong suffix, numeral or element wrong', () => {
    const fe = byId('Fe2(SO4)3');
    expect(check(fe, 'sulfato de ferro(II)').kind).toBe('wrong');
    expect(check(fe, 'sulfito de ferro(III)').kind).toBe('wrong');
    expect(check(fe, 'sulfato de ferro').kind).toBe('wrong');
    expect(check(byId('NaCl'), 'cloreto de sódio(I)').kind).toBe('wrong');
    expect(check(byId('H2SO4'), 'sulfúrico').kind).toBe('wrong');
  });

  it('ignores how locants are separated, and the h of hexano after a prefix', () => {
    for (const typed of ['propan-2-ol', 'Propan 2 ol', '2-propanol', '2 propanol']) expect(check(byId('CC(C)O'), typed).kind, typed).toBe('right');
    for (const typed of ['2,2-dimetilpropano', '2, 2-dimetil-propano', '2 2 dimetilpropano']) {
      expect(check(byId('CC(C)(C)C'), typed).kind, typed).toBe('right');
    }
    expect(check(byId('C1CCCCC1'), 'cicloexano').kind).toBe('right');
    expect(check(byId('C1CCCCC1'), 'ciclohexano').kind).toBe('right');
    expect(check(byId('CCCC(CC)C(C)C'), '3-etil-2-metilexano').kind).toBe('right');
    expect(check(byId('CN(C)C'), 'n,n-dimetilmetanamina').kind).toBe('right');
  });

  it('marks the wrong locant or chain wrong', () => {
    expect(check(byId('CC(C)O'), 'propan-1-ol').kind).toBe('wrong');
    expect(check(byId('CC(C)O'), 'propanol').kind).toBe('wrong');
    expect(check(byId('CC(C)(C)C'), '22-dimetilpropano').kind).toBe('wrong');
    expect(check(byId('CC(C)(C)C'), 'dimetilpropano').kind).toBe('wrong');
    expect(check(byId('C=CC=C'), 'butadieno').kind).toBe('other');
  });

  it('asks again for the IUPAC name when given another name of the compound', () => {
    expect(check(byId('CC(C)=O'), 'Acetona')).toMatchObject({ kind: 'other', note: expect.stringContaining('usual') });
    expect(check(byId('CC(=O)O'), 'ácido acético')).toMatchObject({ kind: 'other' });
    expect(check(byId('Fe2(SO4)3'), 'sulfato férrico')).toMatchObject({ kind: 'other', note: expect.stringContaining('tradicional') });
    expect(check(byId('NaHCO3'), 'Bicarbonato de sodio')).toMatchObject({ kind: 'other' });
    expect(check(byId('NaOH'), 'soda cáustica')).toMatchObject({ kind: 'other', note: expect.stringContaining('popular') });
    expect(check(byId('NaOH'), '   ')).toEqual({ kind: 'empty' });
  });
});

describe('daily', () => {
  it('numbers challenges by the local calendar day from launch', () => {
    expect(puzzleNumber(new Date(2026, 9, 23, 0, 1))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 23, 23, 59))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 24, 0, 0))).toBe(2);
    expect(puzzleNumber(new Date(2027, 0, 1))).toBe(71);
    expect(puzzleNumber(new Date(2020, 0, 1))).toBe(1);
    expect(puzzleDate(71).getMonth()).toBe(0);
    expect(msToNext(new Date(2026, 9, 23, 23, 59, 0))).toBe(60_000);
  });

  it('gives everyone the same two of each kind, easier first, organic compounds from challenge #3', () => {
    expect(daily(10).map((c) => c.id)).toEqual(daily(10).map((c) => c.id));
    for (let n = 1; n <= 60; n++) {
      const day = daily(n);
      const kinds = ['acido', 'acido', 'base', 'base', 'sal', 'sal', ...(n >= 3 ? ['organico', 'organico'] : [])];
      expect(day.map((c) => c.category)).toEqual(kinds);
      expect(day.length).toBe(dailySize(n));
      expect(new Set(day.map((c) => c.id)).size).toBe(day.length);
      for (let i = 0; i < day.length; i += 2) expect(day[i].tier).toBeLessThanOrEqual(day[i + 1].tier);
    }
    expect(dailySize(2)).toBe(6);
    expect(dailySize(3)).toBe(DAILY_SIZE);
  });

  it('keeps the days before the organic compounds as they were played', () => {
    expect(daily(1).map((c) => c.id)).toEqual(['HNO3', 'HIO4', 'Cu(OH)2', 'Pb(OH)4', 'CaCl2', 'Pb(NO3)2']);
    expect(daily(2).map((c) => c.id)).toEqual(['HClO4', 'H3PO2', 'Ni(OH)2', 'Sn(OH)4', 'SrCO3', 'Ni(NO3)2']);
  });

  it('does not repeat a compound until its pool runs out, nor on the next day', () => {
    for (const cat of CATEGORIES) {
      const size = ofCategory(cat).length;
      const seen: string[] = [];
      for (let n = 1; seen.length < size; n++) seen.push(...daily(n).filter((c) => c.category === cat).map((c) => c.id));
      expect(new Set(seen.slice(0, size)).size).toBe(size);
    }
    for (let n = 1; n < 400; n++) {
      const today = new Set(daily(n).map((c) => c.id));
      expect(daily(n + 1).filter((c) => today.has(c.id)), `day ${n}`).toEqual([]);
    }
  });

  it('picks practice compounds by kind and tier, avoiding recent ones', () => {
    const c = practicePick(7, 'sal', 2);
    expect(c.category).toBe('sal');
    expect(c.tier).toBe(2);
    const pool = ofCategory('base', 1).map((b) => b.id);
    expect(practicePick(3, 'base', 1, pool.slice(1)).id).toBe(pool[0]);
  });
});

describe('play', () => {
  const played = (n: number, wrong = 0): DayPlay =>
    daily(n).map((c, i) => ({ id: c.id, typed: i < wrong ? 'não sei' : c.name, correct: i >= wrong }));

  it('counts streaks of complete days', () => {
    const days: Days = { 3: played(3), 4: played(4, 2), 5: played(5), 8: played(8), 9: played(9) };
    const s = stats(days, 10);
    expect(s.streak).toBe(2);
    expect(s.best).toBe(3);
    expect(s.played).toBe(5);
    expect(s.answered).toBe(40);
    expect(s.correct).toBe(38);
    expect(s.byCategory.acido).toEqual({ answered: 10, correct: 8 });
    // Today still open: yesterday's streak stands; finishing today extends it.
    expect(stats({ ...days, 10: played(10).slice(0, 3) }, 10).streak).toBe(2);
    expect(stats({ ...days, 10: played(10) }, 10).streak).toBe(3);
    expect(stats(days, 11).streak).toBe(0);
  });

  it('keeps the compound an answer was given for', () => {
    const questions = questionsOf(5, [{ id: 'HF', typed: 'ácido fluorídrico', correct: true }]);
    expect(questions[0].compound.id).toBe('HF');
    expect(questions[0].answer?.correct).toBe(true);
    expect(questions[1].compound.id).toBe(daily(5)[1].id);
    expect(questions[1].answer).toBeUndefined();
  });
});

describe('store', () => {
  it('revives only what makes sense', () => {
    expect(revive(null)).toEqual({ days: {}, helpSeen: false });
    const s = revive({
      helpSeen: true,
      days: {
        3: [{ id: 'HCl', typed: 'ácido clorídrico', correct: true, junk: 1 }, 'x', { id: 'HF', typed: 'a', correct: false }],
        4: 'oops',
        x: [],
      },
    });
    expect(s).toEqual({ helpSeen: true, days: { 3: [{ id: 'HCl', typed: 'ácido clorídrico', correct: true }] } });
  });

  it('keeps right and wrong answers, in order, once each', () => {
    saveStore.set({ days: {}, helpSeen: false });
    const [first, second] = daily(2);
    expect(answerDaily(2, 0, first, '')).toEqual({ kind: 'empty' });
    expect(answerDaily(2, 1, second, second.name)).toEqual({ kind: 'empty' });
    expect(answerDaily(2, 0, first, first.name)).toEqual({ kind: 'right' });
    expect(answerDaily(2, 0, first, 'outra coisa')).toEqual({ kind: 'empty' });
    expect(answerDaily(2, 1, second, 'ácido qualquer')).toEqual({ kind: 'wrong' });
    expect(saveStore.get().days[2]).toEqual([
      { id: first.id, typed: first.name, correct: true },
      { id: second.id, typed: 'ácido qualquer', correct: false },
    ]);
  });

  it('does not spend an answer on another name of the compound', () => {
    saveStore.set({ days: {}, helpSeen: false });
    const base = byId('Fe(OH)3');
    expect(answerDaily(7, 0, base, 'hidróxido férrico').kind).toBe('other');
    expect(saveStore.get().days[7]).toBeUndefined();
  });
});
