/**
 * Keeps a signed-in learner's data in their account: the same document as a backup from
 * *Ajustes* (progress, board, maps, tutor conversations, preferences without the API key),
 * saved on the server with a revision number.
 *
 * The device keeps working from localStorage, so the app stays instant and works offline;
 * changes are saved a moment after they happen and when the page is hidden. A save names the
 * revision it was based on: if another device saved in between, the server's copy wins and is
 * loaded here. On sign-in, the account's copy replaces what the device had, unless the account
 * has nothing yet and the device's data belongs to nobody (from before accounts), which is
 * then saved to the account. Another account's data on this device is cleared first.
 */
import './board-store.ts';
import './canvas-store.ts';
import './settings.ts';
import './store.ts';
import './tutor-store.ts';
import { authFetch } from './account.ts';
import { exportAll, importAll, memory, onChange, resetAll } from './persist.ts';
import { toast } from './toast.ts';

export interface Remote {
  rev: number;
  data: unknown;
}

export type PutResult = { ok: true; rev: number } | { ok: false; status: number; current?: Remote };

export interface SyncApi {
  get(): Promise<Remote>;
  put(baseRev: number, data: unknown, keepalive: boolean): Promise<PutResult>;
}

export interface SyncMeta {
  /** The account this device's data belongs to; null for data from before accounts. */
  owner: string | null;
  /** The server revision the device's data was last saved as, or loaded from. */
  rev: number;
  /** Changed since then. */
  dirty: boolean;
}

export type SyncState = 'loading' | 'saving' | 'saved' | 'offline' | 'error';
const status = memory<SyncState>('loading');
export const useSyncState = status.use;

const META_KEY = 'chemrster:sync:v1';
const SAVE_DELAY = 1500;
const RETRY_DELAY = 30_000;
/** Browsers drop keepalive requests over 64 KB. */
const KEEPALIVE_LIMIT = 60_000;

let memoryMeta: SyncMeta = { owner: null, rev: 0, dirty: false };
export function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Partial<SyncMeta>;
      return { owner: typeof m.owner === 'string' ? m.owner : null, rev: Number.isInteger(m.rev) ? (m.rev as number) : 0, dirty: m.dirty === true };
    }
    return { owner: null, rev: 0, dirty: false };
  } catch {
    return memoryMeta;
  }
}
function writeMeta(meta: SyncMeta) {
  memoryMeta = meta;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Kept in memory for this page.
  }
}

export const httpApi: SyncApi = {
  async get() {
    const res = await authFetch('/api/state', { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Remote;
  },
  async put(baseRev, data, keepalive) {
    const body = JSON.stringify({ baseRev, data });
    const res = await authFetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT,
    });
    if (res.ok) return { ok: true, rev: ((await res.json()) as { rev: number }).rev };
    const current = res.status === 409 ? ((await res.json()) as { current?: Remote }).current : undefined;
    return { ok: false, status: res.status, current };
  },
};

export interface Sync {
  /** Settles once the device holds this account's data (or the server could not be reached). */
  ready: Promise<void>;
  /** Saves now if anything changed. */
  flush(): Promise<void>;
  stop(): void;
}

let active: Sync | undefined;

export function startSync(userId: string, api: SyncApi = httpApi): Sync {
  active?.stop();
  let stopped = false;
  let applying = false;
  let changes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> | undefined;
  let again = false;
  let warnedSize = false;

  const quietly = (fn: () => void) => {
    applying = true;
    try {
      fn();
    } finally {
      applying = false;
    }
  };

  const apply = (remote: Remote) => {
    quietly(() => {
      try {
        if (remote.data) importAll(remote.data);
      } catch (err) {
        console.error('Sync: dados da conta ilegíveis', err);
      }
    });
    writeMeta({ owner: userId, rev: remote.rev, dirty: false });
  };

  const later = (ms: number, fn: () => void) => {
    clearTimeout(timer);
    if (!stopped) timer = setTimeout(fn, ms);
  };

  const save = (keepalive = false): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (saving) {
      again = true;
      return saving;
    }
    const meta = readMeta();
    // Another tab signed in with another account: this one is no longer in charge.
    if (meta.owner !== userId) return Promise.resolve();
    const seen = changes;
    status.set('saving');
    saving = api
      .put(meta.rev, exportAll(), keepalive)
      .then((r) => {
        if (r.ok) {
          writeMeta({ owner: userId, rev: r.rev, dirty: changes !== seen });
          status.set('saved');
        } else if (r.status === 409 && r.current) {
          apply(r.current);
          status.set('saved');
          toast('Seus dados foram atualizados com o que você fez em outro aparelho.');
        } else if (r.status === 413) {
          status.set('error');
          if (!warnedSize) {
            warnedSize = true;
            toast('Seus dados ficaram grandes demais para salvar na conta. Apague conversas antigas com o tutor em Ajustes.');
          }
        } else if (r.status === 401) {
          status.set('error');
        } else {
          status.set('offline');
          later(RETRY_DELAY, () => void save());
        }
      })
      .catch(() => {
        status.set('offline');
        later(RETRY_DELAY, () => void save());
      })
      .finally(() => {
        saving = undefined;
        if (again && !stopped) {
          again = false;
          void save();
        }
      });
    return saving;
  };

  /** Loads the account's copy if it is newer; saves the device's if it has changes. */
  const refresh = async () => {
    let remote: Remote;
    try {
      remote = await api.get();
    } catch {
      status.set('offline');
      later(RETRY_DELAY, () => void refresh());
      return;
    }
    if (stopped) return;
    const meta = readMeta();
    if (meta.owner !== userId) return;
    if (remote.rev > meta.rev) {
      // Changes made here since the last save are lost to the newer copy; say so.
      if (meta.dirty && meta.rev > 0) toast('Seus dados foram atualizados com o que você fez em outro aparelho.');
      apply(remote);
      status.set('saved');
    } else {
      // The server has an older copy than this device (its data was restored): save over it.
      if (remote.rev < meta.rev) writeMeta({ ...meta, rev: remote.rev, dirty: true });
      if (readMeta().dirty) await save();
      else status.set('saved');
    }
  };

  // Claim the device's data before anything else shows it.
  const meta = readMeta();
  if (meta.owner !== userId) {
    if (meta.owner) quietly(resetAll);
    writeMeta({ owner: userId, rev: 0, dirty: meta.owner === null });
  }

  const offChange = onChange(() => {
    if (applying || stopped) return;
    changes++;
    const m = readMeta();
    if (!m.dirty && m.owner === userId) writeMeta({ ...m, dirty: true });
    later(SAVE_DELAY, () => void save());
  });

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      if (readMeta().dirty) {
        clearTimeout(timer);
        void save(true);
      }
    } else void refresh();
  };
  const onOnline = () => void refresh();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
  }

  const sync: Sync = {
    ready: refresh(),
    flush: () => (readMeta().dirty ? save() : Promise.resolve()),
    stop() {
      if (active === sync) active = undefined;
      stopped = true;
      clearTimeout(timer);
      offChange();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('online', onOnline);
      }
    },
  };
  active = sync;
  return sync;
}

/** Deletes the account's saved copy and this device's data (Ajustes → Apagar meus dados); reload afterwards. */
export async function deleteAccountData(): Promise<boolean> {
  active?.stop();
  const res = await authFetch('/api/state', { method: 'DELETE' }).catch(() => undefined);
  if (!res?.ok) return false;
  const { owner } = readMeta();
  resetAll();
  writeMeta({ owner, rev: 0, dirty: false });
  return true;
}
