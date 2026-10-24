/**
 * The daily challenge: two acids, two bases, two salts and two organic compounds, the same for
 * everyone on a calendar day, a new set at local midnight. Challenge #1 is 23 October 2026; the
 * organic compounds join from challenge #3, so the days before keep the six they were played with.
 */
import { createRng } from '../course/random.ts';
import { type Compound, type Tier, ofCategory } from './catalog.ts';
import { CATEGORIES, type Category } from './pieces.ts';

const LAUNCH = Date.UTC(2026, 9, 23);
const DAY = 86_400_000;

/** Compounds of each kind in a day's challenge. */
export const PER_CATEGORY = 2;
/** The most compounds a day has. */
export const DAILY_SIZE = PER_CATEGORY * CATEGORIES.length;

/** The first challenge with each kind. */
const SINCE: Record<Category, number> = { acido: 1, base: 1, sal: 1, organico: 3 };

/** The kinds in challenge `n`, in the order they are asked. */
export const categoriesOf = (n: number) => CATEGORIES.filter((cat) => n >= SINCE[cat]);

/** How many compounds challenge `n` has. */
export const dailySize = (n: number) => PER_CATEGORY * categoriesOf(n).length;

/** Days since launch of a local calendar date, so DST and time zones never skip or repeat a challenge. */
const dayIndex = (d: Date) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - LAUNCH) / DAY);

/** Today's challenge number on this device's calendar. */
export const puzzleNumber = (now = new Date()) => Math.max(1, dayIndex(now) + 1);

/** The local calendar day of a challenge. */
export function puzzleDate(n: number): Date {
  const utc = new Date(LAUNCH + (n - 1) * DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Until local midnight, when the next challenge opens. */
export function msToNext(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Positions kept clear at the start of a cycle: a day's worth, so nothing comes back the next day. */
const GAP = 2 * PER_CATEGORY;
const orders = new Map<string, Compound[]>();

/**
 * One pass through a pool: a fresh shuffle each time the pool runs out, so nothing repeats until
 * everything has come up. Whatever closed the previous pass moves off the start of this one.
 */
function cycleOrder(pool: readonly Compound[], key: string, cycle: number): Compound[] {
  const id = `${key}:${cycle}`;
  const cached = orders.get(id);
  if (cached) return cached;
  let order = createRng(hash(id)).shuffle(pool);
  if (cycle > 0 && pool.length > 2 * GAP) {
    const tail = new Set(cycleOrder(pool, key, cycle - 1).slice(-GAP));
    const rest = order.filter((c) => !tail.has(c));
    rest.splice(GAP, 0, ...order.filter((c) => tail.has(c)));
    order = rest;
  }
  orders.set(id, order);
  return order;
}

const nth = (pool: readonly Compound[], key: string, k: number) => cycleOrder(pool, key, Math.floor(k / pool.length))[k % pool.length];

/** Challenge `n`: the acids, the bases, the salts, then the organic compounds, the easier of each kind first. */
export function daily(n: number): Compound[] {
  return categoriesOf(n).flatMap((cat) => {
    const pool = ofCategory(cat);
    const picks = Array.from({ length: PER_CATEGORY }, (_, i) => nth(pool, cat, (n - SINCE[cat]) * PER_CATEGORY + i));
    return picks.sort((a, b) => a.tier - b.tier);
  });
}

/** A practice compound: any kind or tier when not given, never one of the last few seen. */
export function practicePick(seed: number, category?: Category, tier?: Tier, avoid: readonly string[] = []): Compound {
  const pool = CATEGORIES.filter((c) => !category || c === category).flatMap((c) => ofCategory(c, tier));
  const fresh = pool.filter((c) => !avoid.includes(c.id));
  return createRng(seed).pick(fresh.length ? fresh : pool);
}
