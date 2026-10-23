import { describe, expect, it } from 'vitest';
import { ANIONS, COMPOUNDS, compoundById, ofCategory, parentAcid } from './catalog.ts';
import { daily, msToNext, practicePick, puzzleDate, puzzleNumber, tierOf } from './daily.ts';
import { explain } from './explain.ts';
import { counts, ionText, pretty, runs } from './formula.ts';
import { MAX_TRIES, grade, keyStates, problem, roundState, verdict } from './grade.ts';
import { CATEGORIES, type Guess, SLOTS, compose, keyboard, word } from './pieces.ts';
import { type Days, roundsOf, shareText, stats } from './play.ts';
import { playGuess, revive, saveStore } from './store.ts';

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

  it('previews drafts with gaps', () => {
    expect(compose('acido', {})).toBe('ácido …');
    expect(compose('sal', { cation: 'ferro', valencia: 'II' })).toBe('… de ferro(II)');
    expect(compose('base', { cation: 'sodio' })).toBe('hidróxido de sódio');
  });

  it('gives traditional and everyday names', () => {
    expect(byId('Fe2(SO4)3').aka).toContain('sulfato férrico');
    expect(byId('NaHCO3').aka).toContain('bicarbonato de sódio');
    expect(byId('Cu(OH)2').aka).toContain('hidróxido cúprico');
    expect(byId('NaOH').aka).toContain('soda cáustica');
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
  it('has unique formulas and enough of every category and tier for the daily rotation', () => {
    expect(new Set(COMPOUNDS.map((c) => c.id)).size).toBe(COMPOUNDS.length);
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

  it('accepts every answer it lists', () => {
    for (const c of COMPOUNDS) for (const a of c.answers) expect(grade(c, a).solved, c.formula).toBe(true);
  });

  it('only asks for pieces the keyboard has', () => {
    for (const c of COMPOUNDS) {
      const keys = new Set(keyboard(c.category).flatMap((g) => g.pieces.map((p) => `${p.slot}:${p.id}`)));
      for (const a of c.answers) for (const [slot, id] of Object.entries(a)) expect(keys.has(`${slot}:${id}`), `${c.formula} ${slot}:${id}`).toBe(true);
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

describe('grading', () => {
  const fe = byId('Fe2(SO4)3');

  it('marks close pieces of the same family', () => {
    expect(verdict('sufixo', 'ito', 'ato')).toBe('close');
    expect(verdict('sufixo', 'eto', 'ato')).toBe('wrong');
    expect(verdict('prefixo', 'per', 'hipo')).toBe('close');
    expect(verdict('prefixo', undefined, 'hipo')).toBe('wrong');
    expect(verdict('valencia', 'II', 'III')).toBe('close');
    expect(verdict('valencia', undefined, undefined)).toBe('right');
  });

  it('grades a guess slot by slot', () => {
    const g = grade(fe, { radical: 'sulf', sufixo: 'ito', cation: 'ferro', valencia: 'II' });
    expect(g.solved).toBe(false);
    expect(g.verdicts).toEqual({ prefixo: 'right', radical: 'right', sufixo: 'close', cation: 'right', valencia: 'close' });
  });

  it('accepts either prefix where both are right', () => {
    expect(grade(byId('H3PO4'), { prefixo: 'orto', radical: 'fosf', sufixo: 'ico' }).solved).toBe(true);
    expect(grade(byId('H3PO4'), { radical: 'fosf', sufixo: 'ico' }).solved).toBe(true);
  });

  it('refuses incomplete and repeated guesses', () => {
    expect(problem('sal', { radical: 'sulf' }, [])).toBe('Falta o sufixo e o cátion');
    const g: Guess = { radical: 'sulf', sufixo: 'ato', cation: 'ferro' };
    expect(problem('sal', g, [])).toBeNull();
    expect(problem('sal', { ...g }, [g])).toBe('Você já tentou esse nome');
  });

  it('colours the keyboard with the best verdict seen', () => {
    const keys = keyStates(fe, [
      { radical: 'sulf', sufixo: 'ito', cation: 'ferro', valencia: 'II' },
      { radical: 'sulf', sufixo: 'ato', cation: 'cobre', valencia: 'II' },
    ]);
    expect(keys.get('sufixo:ito')).toBe('close');
    expect(keys.get('sufixo:ato')).toBe('right');
    expect(keys.get('cation:cobre')).toBe('wrong');
    expect(keys.get('valencia:II')).toBe('close');
  });

  it('ends a round on a win or after the last try', () => {
    const wrong: Guess = { radical: 'clor', sufixo: 'eto', cation: 'sodio' };
    const tries = Array.from({ length: MAX_TRIES }, () => wrong);
    expect(roundState(fe, tries).lost).toBe(true);
    expect(roundState(fe, [wrong, fe.answers[0]]).won).toBe(true);
  });
});

describe('daily', () => {
  it('numbers puzzles by the local calendar day from launch', () => {
    expect(puzzleNumber(new Date(2026, 9, 23, 0, 1))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 23, 23, 59))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 24, 0, 0))).toBe(2);
    expect(puzzleNumber(new Date(2027, 0, 1))).toBe(71);
    expect(puzzleNumber(new Date(2020, 0, 1))).toBe(1);
    expect(puzzleDate(71).getMonth()).toBe(0);
    expect(msToNext(new Date(2026, 9, 23, 23, 59, 0))).toBe(60_000);
  });

  it('ramps the week from easy to hard', () => {
    // 23 Oct 2026 is a Friday.
    expect([1, 2, 3, 4, 5, 6, 7].map(tierOf)).toEqual([2, 3, 3, 1, 1, 2, 2]);
  });

  it('gives everyone the same acid, base and salt, at the day’s tier', () => {
    expect(daily(10)).toEqual(daily(10));
    for (let n = 1; n <= 60; n++) for (const cat of CATEGORIES) {
      expect(daily(n)[cat].category).toBe(cat);
      expect(daily(n)[cat].tier).toBe(tierOf(n));
    }
  });

  it('does not repeat a compound until its pool runs out', () => {
    for (const cat of CATEGORIES) {
      const seen: string[] = [];
      for (let n = 1; n <= 400; n++) if (tierOf(n) === 1) seen.push(daily(n)[cat].id);
      const size = ofCategory(cat, 1).length;
      expect(new Set(seen.slice(0, size)).size).toBe(size);
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    }
  });

  it('picks practice compounds by category and tier, avoiding recent ones', () => {
    const c = practicePick(7, 'sal', 2);
    expect(c.category).toBe('sal');
    expect(c.tier).toBe(2);
    const pool = ofCategory('base', 1).map((b) => b.id);
    expect(practicePick(3, 'base', 1, pool.slice(1)).id).toBe(pool[0]);
  });
});

describe('play', () => {
  const winning = (n: number, tries = 1) => {
    const day = daily(n);
    return Object.fromEntries(
      CATEGORIES.map((cat) => {
        const c = day[cat];
        const wrong: Guess = Object.fromEntries(SLOTS[cat].filter((s) => s !== 'prefixo' && s !== 'valencia').map((s) => [s, s === 'sufixo' ? (cat === 'acido' ? 'idrico' : 'eto') : s === 'cation' ? 'ouro' : 'cian'])) as Guess;
        const misses = Array.from({ length: tries - 1 }, () => wrong);
        return [cat, { id: c.id, guesses: [...misses, c.answers[0]] }];
      }),
    );
  };

  it('counts streaks of complete days', () => {
    const days: Days = { 3: winning(3), 4: winning(4, 2), 5: winning(5), 8: winning(8), 9: winning(9) };
    const s = stats(days, 10);
    expect(s.streak).toBe(2);
    expect(s.best).toBe(3);
    expect(s.played).toBe(5);
    expect(s.wins).toBe(15);
    expect(s.tries[0]).toBe(12);
    expect(s.byCategory.sal).toEqual({ rounds: 5, wins: 5 });
    // Today still open: yesterday's streak stands; finishing today extends it.
    expect(stats({ ...days, 10: { acido: winning(10).acido } }, 10).streak).toBe(2);
    expect(stats({ ...days, 10: winning(10) }, 10).streak).toBe(3);
    expect(stats(days, 11).streak).toBe(0);
  });

  it('shares squares, never the answers', () => {
    const text = shareText(4, winning(4, 2), 3);
    const lines = text.split('\n');
    expect(lines[0]).toBe('CheMrster #4 · 3/3 · 🔥3');
    expect(lines[1]).toMatch(/^🍋 2\/6 [⬛🟨🟩]+ 🟩+$/u);
    expect(text).not.toContain(daily(4).sal.name);
    expect(shareText(4, undefined, 0).split('\n')[3]).toBe('🧂 –/6');
    expect(shareText(4, winning(4), 0, 'contrast')).toContain('🟧');
  });

  it('keeps the compound a round was played with', () => {
    const rounds = roundsOf(5, { base: { id: 'KOH', guesses: [] } });
    expect(rounds.base.compound.id).toBe('KOH');
    expect(rounds.acido.compound.id).toBe(daily(5).acido.id);
  });
});

describe('store', () => {
  it('revives only what makes sense', () => {
    expect(revive(null)).toEqual({ days: {}, helpSeen: false });
    const s = revive({
      helpSeen: true,
      days: { 3: { acido: { id: 'HCl', guesses: [{ radical: 'clor', sufixo: 'idrico', junk: 1 }, 'x'] }, base: 'oops' }, x: {} },
    });
    expect(s).toEqual({ helpSeen: true, days: { 3: { acido: { id: 'HCl', guesses: [{ radical: 'clor', sufixo: 'idrico' }] } } } });
  });

  it('plays guesses until the round ends', () => {
    saveStore.set({ days: {}, helpSeen: false });
    const c = daily(2).sal;
    expect(playGuess(2, c, { radical: 'sulf' })).toMatch(/^Falta/);
    expect(playGuess(2, c, c.answers[0])).toBeNull();
    expect(playGuess(2, c, { radical: 'clor', sufixo: 'eto', cation: 'sodio' })).toBe('Essa rodada já terminou');
    expect(saveStore.get().days[2].sal).toEqual({ id: c.id, guesses: [c.answers[0]] });
  });
});
