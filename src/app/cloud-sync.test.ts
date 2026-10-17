import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type PutResult, type Remote, type SyncApi, readMeta, startSync } from './cloud-sync.ts';
import { exportAll } from './persist.ts';
import { settingsStore, updateSettings } from './settings.ts';
import { progressStore } from './store.ts';

/** localStorage for the node test environment. */
class MemoryStorage {
  private items = new Map<string, string>();
  getItem = (k: string) => this.items.get(k) ?? null;
  setItem = (k: string, v: string) => void this.items.set(k, String(v));
  removeItem = (k: string) => void this.items.delete(k);
  clear = () => this.items.clear();
}

/** A server that behaves like /api/state. */
function fakeServer(initial: Remote = { rev: 0, data: null }) {
  let saved = initial;
  const puts: Array<{ baseRev: number; data: unknown }> = [];
  const api: SyncApi = {
    get: async () => saved,
    async put(baseRev, data): Promise<PutResult> {
      puts.push({ baseRev, data });
      if (baseRev !== saved.rev) return { ok: false, status: 409, current: saved };
      saved = { rev: saved.rev + 1, data: JSON.parse(JSON.stringify(data)) };
      return { ok: true, rev: saved.rev };
    },
  };
  return { api, puts, saved: () => saved, setSaved: (r: Remote) => (saved = r) };
}

const xpOf = (data: unknown) => (data as { data: Record<string, { xp: number }> }).data['chemrster:progress:v1'].xp;
const withXp = (xp: number) => {
  const doc = exportAll() as { data: Record<string, unknown> };
  return { ...doc, data: { ...doc.data, 'chemrster:progress:v1': { ...progressStore.get(), xp } } };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.useFakeTimers();
  progressStore.set({ xp: 0, completed: {}, streak: { count: 0, last: null }, days: {}, log: [] });
  updateSettings({ apiKey: '', name: '' });
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('account sync', () => {
  it('saves this device’s data to a new account (data from before accounts)', async () => {
    progressStore.set((p) => ({ ...p, xp: 40 }));
    const server = fakeServer();
    const sync = startSync('user_a', server.api);
    await sync.ready;
    expect(server.saved().rev).toBe(1);
    expect(xpOf(server.saved().data)).toBe(40);
    expect(readMeta()).toEqual({ owner: 'user_a', rev: 1, dirty: false });
    sync.stop();
  });

  it('loads the account’s copy on sign-in', async () => {
    progressStore.set((p) => ({ ...p, xp: 5 }));
    const server = fakeServer({ rev: 3, data: withXp(120) });
    const sync = startSync('user_a', server.api);
    await sync.ready;
    expect(progressStore.get().xp).toBe(120);
    expect(server.puts).toHaveLength(0);
    expect(readMeta()).toEqual({ owner: 'user_a', rev: 3, dirty: false });
    sync.stop();
  });

  it('clears another account’s data before anything is shown', async () => {
    localStorage.setItem('chemrster:sync:v1', JSON.stringify({ owner: 'user_a', rev: 4, dirty: false }));
    progressStore.set((p) => ({ ...p, xp: 999 }));
    updateSettings({ apiKey: 'sk-ant-of-a', name: 'Ana' });
    const server = fakeServer();
    const sync = startSync('user_b', server.api);
    // Synchronously, before the server answers.
    expect(progressStore.get().xp).toBe(0);
    expect(settingsStore.get().apiKey).toBe('');
    await sync.ready;
    expect(server.puts).toHaveLength(0);
    expect(readMeta().owner).toBe('user_b');
    sync.stop();
  });

  it('saves changes a moment after they happen', async () => {
    const server = fakeServer();
    const sync = startSync('user_a', server.api);
    await sync.ready;
    progressStore.set((p) => ({ ...p, xp: 10 }));
    progressStore.set((p) => ({ ...p, xp: 20 }));
    expect(readMeta().dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.puts).toHaveLength(2); // the first save on sign-in, then one for both changes
    expect(xpOf(server.saved().data)).toBe(20);
    expect(readMeta()).toMatchObject({ rev: 2, dirty: false });
    sync.stop();
  });

  it('takes the newer copy when another device saved in between', async () => {
    const server = fakeServer();
    const sync = startSync('user_a', server.api);
    await sync.ready;
    server.setSaved({ rev: 7, data: withXp(300) });
    progressStore.set((p) => ({ ...p, xp: 1 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(progressStore.get().xp).toBe(300);
    expect(readMeta()).toEqual({ owner: 'user_a', rev: 7, dirty: false });
    sync.stop();
  });

  it('keeps changes on the device while offline and saves them later', async () => {
    const server = fakeServer();
    let down = false;
    const api: SyncApi = {
      get: () => (down ? Promise.reject(new Error('offline')) : server.api.get()),
      put: (b, d, k) => (down ? Promise.reject(new Error('offline')) : server.api.put(b, d, k)),
    };
    const sync = startSync('user_a', api);
    await sync.ready;
    down = true;
    progressStore.set((p) => ({ ...p, xp: 55 }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(readMeta().dirty).toBe(true);
    down = false;
    await vi.advanceTimersByTimeAsync(31_000);
    expect(xpOf(server.saved().data)).toBe(55);
    expect(readMeta().dirty).toBe(false);
    sync.stop();
  });

  it('stops saving once stopped', async () => {
    const server = fakeServer();
    const sync = startSync('user_a', server.api);
    await sync.ready;
    sync.stop();
    progressStore.set((p) => ({ ...p, xp: 9 }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.puts).toHaveLength(1);
  });
});
