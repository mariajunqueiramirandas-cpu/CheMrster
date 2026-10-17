/**
 * Where accounts keep their data: each learner's saved app state (the same document as a
 * backup from *Ajustes*) with a revision number, and how many tutor requests they made each
 * day. Postgres in production; an in-memory copy for development and tests.
 */

export interface SavedState {
  rev: number;
  data: unknown;
  updatedAt: string;
}

export type PutResult = { ok: true; rev: number } | { ok: false; current: SavedState | null };

export interface Database {
  getState(userId: string): Promise<SavedState | null>;
  /** Saves only when `baseRev` is the stored revision (0 for none), so two devices never overwrite each other blindly. */
  putState(userId: string, baseRev: number, data: unknown): Promise<PutResult>;
  /** Forgets everything about a user: their state and their usage. */
  deleteUser(userId: string): Promise<void>;
  /** Counts one tutor request on `day` and returns the day's total. */
  countTutorRequest(userId: string, day: string): Promise<number>;
  tutorRequests(userId: string, day: string): Promise<number>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function memoryDatabase(): Database {
  const states = new Map<string, SavedState>();
  const usage = new Map<string, number>();
  return {
    getState: async (userId) => states.get(userId) ?? null,
    async putState(userId, baseRev, data) {
      const current = states.get(userId) ?? null;
      if ((current?.rev ?? 0) !== baseRev) return { ok: false, current };
      const rev = baseRev + 1;
      // Stored as JSON, as Postgres would, so callers never share objects with the store.
      states.set(userId, { rev, data: JSON.parse(JSON.stringify(data)), updatedAt: new Date().toISOString() });
      return { ok: true, rev };
    },
    async deleteUser(userId) {
      states.delete(userId);
      for (const key of usage.keys()) if (key.startsWith(`${userId}\n`)) usage.delete(key);
    },
    async countTutorRequest(userId, day) {
      const key = `${userId}\n${day}`;
      const n = (usage.get(key) ?? 0) + 1;
      usage.set(key, n);
      return n;
    },
    tutorRequests: async (userId, day) => usage.get(`${userId}\n${day}`) ?? 0,
    ping: async () => {},
    close: async () => {},
  };
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS user_state (
     user_id    text PRIMARY KEY,
     rev        integer NOT NULL,
     data       jsonb NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS tutor_usage (
     user_id  text NOT NULL,
     day      date NOT NULL,
     requests integer NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, day)
   )`,
];

export async function postgresDatabase(url: string): Promise<Database> {
  const { default: pg } = await import('pg');
  // Dates come back as the YYYY-MM-DD the app wrote, not as local-midnight Date objects.
  pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  pool.on('error', (err) => console.error('Postgres:', err.message));
  for (const sql of MIGRATIONS) await pool.query(sql);

  const getState = async (userId: string): Promise<SavedState | null> => {
    const { rows } = await pool.query<{ rev: number; data: unknown; updated_at: Date }>('SELECT rev, data, updated_at FROM user_state WHERE user_id = $1', [userId]);
    return rows[0] ? { rev: rows[0].rev, data: rows[0].data, updatedAt: rows[0].updated_at.toISOString() } : null;
  };

  return {
    getState,
    async putState(userId, baseRev, data) {
      const json = JSON.stringify(data);
      const { rows } =
        baseRev === 0
          ? await pool.query<{ rev: number }>('INSERT INTO user_state (user_id, rev, data) VALUES ($1, 1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING RETURNING rev', [userId, json])
          : await pool.query<{ rev: number }>(
              'UPDATE user_state SET data = $3::jsonb, rev = rev + 1, updated_at = now() WHERE user_id = $1 AND rev = $2 RETURNING rev',
              [userId, baseRev, json],
            );
      if (rows[0]) return { ok: true, rev: rows[0].rev };
      return { ok: false, current: await getState(userId) };
    },
    async deleteUser(userId) {
      await pool.query('DELETE FROM user_state WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM tutor_usage WHERE user_id = $1', [userId]);
    },
    async countTutorRequest(userId, day) {
      const { rows } = await pool.query<{ requests: number }>(
        `INSERT INTO tutor_usage (user_id, day, requests) VALUES ($1, $2, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET requests = tutor_usage.requests + 1 RETURNING requests`,
        [userId, day],
      );
      return rows[0].requests;
    },
    async tutorRequests(userId, day) {
      const { rows } = await pool.query<{ requests: number }>('SELECT requests FROM tutor_usage WHERE user_id = $1 AND day = $2', [userId, day]);
      return rows[0]?.requests ?? 0;
    },
    ping: async () => void (await pool.query('SELECT 1')),
    close: () => pool.end(),
  };
}
