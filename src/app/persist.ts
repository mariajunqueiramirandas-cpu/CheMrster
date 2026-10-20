/**
 * A value kept in localStorage (per device) and shared with React through a tiny external
 * store. Every persisted value registers itself so a backup can export and restore them all.
 */
import { useSyncExternalStore } from 'react';

export interface Persisted<T> {
  readonly key: string;
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** Replaces the value with a stored one (a backup), revived like a fresh load. */
  restore(stored: unknown): void;
}

export interface PersistOptions<T> {
  /** What goes into a backup; leave secrets out. Defaults to the whole value. */
  backup?: (value: T) => unknown;
  /** Merges a backup into the current value; defaults to reviving the backup alone. */
  merge?: (backup: unknown, current: T) => T;
  /** The value was replaced from outside (a restored backup, another tab). */
  onReplace?: () => void;
}

const registry = new Map<string, Persisted<unknown> & { backup: () => unknown; reset: () => void }>();

/** Every change made on this page (not ones followed from another tab), for the account sync. */
const changeListeners = new Set<(key: string) => void>();
export function onChange(listener: (key: string) => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Called when the browser refuses a write (storage full), with the key that failed. */
let writeFailed: ((key: string) => boolean) | undefined;
export function onWriteFailure(handler: (key: string) => boolean) {
  writeFailed = handler;
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    // Private mode, blocked storage or a corrupt value: start fresh in memory.
    return undefined;
  }
}

/** `revive` turns whatever was stored (possibly an older shape, or nothing) into a valid value. */
export function persisted<T>(key: string, revive: (stored: unknown) => T, options: PersistOptions<T> = {}): Persisted<T> {
  let state = revive(read(key));
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  const store: Persisted<T> = {
    key,
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      write(key, state);
      emit();
      for (const l of changeListeners) l(key);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore(stored) {
      store.set(options.merge ? options.merge(stored, state) : revive(stored));
      options.onReplace?.();
    },
  };
  registry.set(key, {
    ...(store as Persisted<unknown>),
    backup: () => (options.backup ? options.backup(state) : state),
    reset: () => {
      store.set(revive(undefined));
      options.onReplace?.();
    },
  });
  // Another tab saved: follow it. (React Native has a window without events.)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return;
      state = revive(read(key));
      options.onReplace?.();
      emit();
    });
  }
  return store;
}

function write(key: string, value: unknown) {
  const json = JSON.stringify(value);
  try {
    localStorage.setItem(key, json);
  } catch {
    // Storage full: let the app make room (old tutor history) and try once more; else keep working in memory.
    if (!writeFailed?.(key)) return;
    try {
      localStorage.setItem(key, json);
    } catch {
      // Still full.
    }
  }
}

export function usePersisted<T>(store: Persisted<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Everything the app keeps, as one JSON document. */
export function exportAll(): Record<string, unknown> {
  return {
    app: 'chemrster',
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries([...registry].map(([key, s]) => [key, s.backup()])),
  };
}

/** Restores a backup made by `exportAll`; returns how many stores were restored. */
export function importAll(doc: unknown): number {
  if (!doc || typeof doc !== 'object' || (doc as { app?: unknown }).app !== 'chemrster') {
    throw new Error('Este arquivo não é um backup do CheMrster.');
  }
  const data = (doc as { data?: Record<string, unknown> }).data ?? {};
  let restored = 0;
  for (const [key, value] of Object.entries(data)) {
    const store = registry.get(key);
    if (!store) continue;
    store.restore(value);
    restored++;
  }
  return restored;
}

/** Puts every store back to a fresh start (another account signs in on this device). */
export function resetAll() {
  for (const store of registry.values()) store.reset();
}

/** A value shared with React but not saved: what is streaming, which panel is open. */
export function memory<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next;
      for (const l of listeners) l();
    },
    use: () => useSyncExternalStore(subscribe, () => state, () => state),
  };
}

let counter = 0;
/** Short unique ids for cards, edges and messages. */
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
