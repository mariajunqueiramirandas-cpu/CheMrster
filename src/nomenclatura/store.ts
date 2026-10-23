/** The daily challenges played, kept on the device (localStorage, which the Android app backs with SQLite). */
import { persisted, usePersisted } from '../app/persist.ts';
import type { Compound } from './catalog.ts';
import { type Check, check } from './check.ts';
import { DAILY_SIZE } from './daily.ts';
import type { Answer, DayPlay, Days } from './play.ts';

export interface Save {
  days: Days;
  /** The how-it-works sheet opens by itself until it has been seen once. */
  helpSeen: boolean;
}

const EMPTY: Save = { days: {}, helpSeen: false };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const isAnswer = (v: unknown): v is Answer =>
  isRecord(v) && typeof v.id === 'string' && typeof v.typed === 'string' && typeof v.correct === 'boolean';

/** Whatever was stored, as a valid save: unknown or broken entries are dropped. */
export function revive(stored: unknown): Save {
  if (!isRecord(stored)) return EMPTY;
  const days: Days = {};
  if (isRecord(stored.days)) {
    for (const [key, value] of Object.entries(stored.days)) {
      if (!/^\d+$/.test(key) || !Array.isArray(value)) continue;
      const day: DayPlay = [];
      // Answers count in order; anything after a broken one is dropped with it.
      for (const a of value.slice(0, DAILY_SIZE)) {
        if (!isAnswer(a)) break;
        day.push({ id: a.id, typed: a.typed, correct: a.correct });
      }
      if (day.length) days[key] = day;
    }
  }
  return { days, helpSeen: stored.helpSeen === true };
}

export const saveStore = persisted<Save>('chemrster:nomenclatura:v2', revive);

export const useSave = () => usePersisted(saveStore);

/**
 * Answers question `index` of challenge `n` with what was typed. A right or wrong name is kept;
 * an empty one, or another name of the compound, is not (the player tries again). Questions are
 * answered in order, once each.
 */
export function answerDaily(n: number, index: number, compound: Compound, typed: string): Check {
  const day = saveStore.get().days[n] ?? [];
  // Already answered, or out of order: nothing to record.
  if (index !== day.length || index >= DAILY_SIZE) return { kind: 'empty' };
  const result = check(compound, typed);
  if (result.kind === 'right' || result.kind === 'wrong') {
    const answer: Answer = { id: compound.id, typed: typed.trim(), correct: result.kind === 'right' };
    saveStore.set((s) => ({ ...s, days: { ...s.days, [n]: [...day, answer] } }));
  }
  return result;
}

export function markHelpSeen() {
  if (!saveStore.get().helpSeen) saveStore.set((s) => ({ ...s, helpSeen: true }));
}
