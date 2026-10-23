/**
 * The daily challenge: one acid, one base and one salt, the same for everyone on a calendar
 * day. Puzzle #1 is 23 October 2026. The week ramps up like a newspaper crossword: easy on
 * Monday and Tuesday, medium midweek, hard at the weekend.
 */
import { createRng } from '../course/random.ts';
import { type Compound, type Tier, ofCategory } from './catalog.ts';
import { CATEGORIES, type Category } from './pieces.ts';

const LAUNCH = Date.UTC(2026, 9, 23);
const DAY = 86_400_000;
const LAUNCH_WEEKDAY = new Date(LAUNCH).getUTCDay();

/** Days since launch of a local calendar date, so DST and time zones never skip or repeat a puzzle. */
const dayIndex = (d: Date) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - LAUNCH) / DAY);

/** Today's puzzle number on this device's calendar. */
export const puzzleNumber = (now = new Date()) => Math.max(1, dayIndex(now) + 1);

/** The local calendar day of a puzzle. */
export function puzzleDate(n: number): Date {
  const utc = new Date(LAUNCH + (n - 1) * DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Until local midnight, when the next puzzle opens. */
export function msToNext(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** By weekday, Sunday first. */
export const WEEKDAY_TIER: readonly Tier[] = [3, 1, 1, 2, 2, 2, 3];

const weekdayOf = (n: number) => (LAUNCH_WEEKDAY + n - 1) % 7;

export const tierOf = (n: number): Tier => WEEKDAY_TIER[weekdayOf(n)];

/** How many puzzles before `n` had the same tier. */
function rank(n: number, tier: Tier): number {
  const before = n - 1;
  let k = Math.floor(before / 7) * WEEKDAY_TIER.filter((t) => t === tier).length;
  for (let i = 0; i < before % 7; i++) if (WEEKDAY_TIER[(LAUNCH_WEEKDAY + i) % 7] === tier) k++;
  return k;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cycleOrder = (pool: readonly Compound[], key: string, cycle: number) => createRng(hash(`${key}:${cycle}`)).shuffle(pool);

/**
 * The k-th compound of a pool: a new shuffle each time the pool runs out, so nothing repeats
 * until everything has come up, and never twice in a row across cycles.
 */
function nth(pool: readonly Compound[], key: string, k: number): Compound {
  const cycle = Math.floor(k / pool.length);
  const order = cycleOrder(pool, key, cycle);
  if (cycle > 0 && pool.length > 1 && order[0] === cycleOrder(pool, key, cycle - 1)[pool.length - 1]) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order[k % pool.length];
}

export type Daily = Record<Category, Compound>;

/** Puzzle `n`'s acid, base and salt. */
export function daily(n: number): Daily {
  const tier = tierOf(n);
  const k = rank(n, tier);
  return Object.fromEntries(CATEGORIES.map((cat) => [cat, nth(ofCategory(cat, tier), `${cat}:${tier}`, k)])) as Daily;
}

/** A practice compound: any category or tier when not given, never one of the last few seen. */
export function practicePick(seed: number, category?: Category, tier?: Tier, avoid: readonly string[] = []): Compound {
  const pool = CATEGORIES.filter((c) => !category || c === category).flatMap((c) => ofCategory(c, tier));
  const fresh = pool.filter((c) => !avoid.includes(c.id));
  return createRng(seed).pick(fresh.length ? fresh : pool);
}
