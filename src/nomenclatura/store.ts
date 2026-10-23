/** The daily games, kept on the device (localStorage, which the Android app backs with SQLite). */
import { persisted, usePersisted } from '../app/persist.ts';
import type { Compound } from './catalog.ts';
import { MAX_TRIES, problem, roundState } from './grade.ts';
import { CATEGORIES, type Category, type Guess, SLOTS } from './pieces.ts';
import type { DayPlay, Days } from './play.ts';

export interface Save {
  days: Days;
  /** The how-to-play sheet opens by itself until it has been seen once. */
  helpSeen: boolean;
}

const EMPTY: Save = { days: {}, helpSeen: false };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function reviveGuess(v: unknown): Guess | null {
  if (!isRecord(v)) return null;
  const g: Guess = {};
  for (const slot of SLOTS.sal) if (typeof v[slot] === 'string') g[slot] = v[slot] as string;
  return g;
}

function reviveDay(v: unknown): DayPlay | null {
  if (!isRecord(v)) return null;
  const day: DayPlay = {};
  for (const cat of CATEGORIES) {
    const r = v[cat];
    if (!isRecord(r) || typeof r.id !== 'string' || !Array.isArray(r.guesses)) continue;
    const guesses = r.guesses.map(reviveGuess).filter((g): g is Guess => !!g).slice(0, MAX_TRIES);
    day[cat] = { id: r.id, guesses };
  }
  return day;
}

/** Whatever was stored, as a valid save: unknown or broken entries are dropped. */
export function revive(stored: unknown): Save {
  if (!isRecord(stored)) return EMPTY;
  const days: Days = {};
  if (isRecord(stored.days)) {
    for (const [key, value] of Object.entries(stored.days)) {
      const day = /^\d+$/.test(key) ? reviveDay(value) : null;
      if (day) days[key] = day;
    }
  }
  return { days, helpSeen: stored.helpSeen === true };
}

export const saveStore = persisted<Save>('chemrster:nomenclatura:v1', revive);

export const useSave = () => usePersisted(saveStore);

/**
 * Plays a guess in puzzle `n`'s round. Returns why it was refused, or null when it counted.
 * A finished round takes no more guesses.
 */
export function playGuess(n: number, compound: Compound, guess: Guess): string | null {
  const cat: Category = compound.category;
  const day = saveStore.get().days[n] ?? {};
  const round = day[cat]?.id === compound.id ? day[cat] : undefined;
  const guesses = round?.guesses ?? [];
  if (roundState(compound, guesses).done) return 'Essa rodada já terminou';
  const why = problem(cat, guess, guesses);
  if (why) return why;
  const clean = Object.fromEntries(SLOTS[cat].filter((s) => guess[s] !== undefined).map((s) => [s, guess[s]])) as Guess;
  saveStore.set((s) => ({
    ...s,
    days: { ...s.days, [n]: { ...s.days[n], [cat]: { id: compound.id, guesses: [...guesses, clean] } } },
  }));
  return null;
}

export function markHelpSeen() {
  if (!saveStore.get().helpSeen) saveStore.set((s) => ({ ...s, helpSeen: true }));
}
