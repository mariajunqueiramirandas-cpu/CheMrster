import { describe, expect, it } from 'vitest';
import { ANIONS, COMPOUNDS, compoundById, ofCategory, parentAcid } from './catalog.ts';
import { check, normalize } from './check.ts';
import { DAILY_SIZE, daily, msToNext, practicePick, puzzleDate, puzzleNumber } from './daily.ts';
import { explain } from './explain.ts';
import { counts, ionText, pretty, runs } from './formula.ts';
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

  it('asks again for the IUPAC name when given another name of the compound', () => {
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

  it('gives everyone the same two acids, two bases and two salts, easier first', () => {
    expect(daily(10).map((c) => c.id)).toEqual(daily(10).map((c) => c.id));
    for (let n = 1; n <= 60; n++) {
      const day = daily(n);
      expect(day.map((c) => c.category)).toEqual(['acido', 'acido', 'base', 'base', 'sal', 'sal']);
      expect(new Set(day.map((c) => c.id)).size).toBe(DAILY_SIZE);
      for (let i = 0; i < DAILY_SIZE; i += 2) expect(day[i].tier).toBeLessThanOrEqual(day[i + 1].tier);
    }
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
    expect(s.answered).toBe(30);
    expect(s.correct).toBe(28);
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
