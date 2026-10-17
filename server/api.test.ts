import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LIMITS, PLUS_FEATURE, createApi, dayIn } from './api.ts';
import type { Authenticate } from './auth.ts';
import { memoryDatabase } from './db.ts';

const realFetch = globalThis.fetch;

/** Signs in whoever sends `authorization: Bearer <user>`; `plus-*` users have the Pro feature. */
const fakeAuth: Authenticate = async (req) => {
  const user = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
  return user ? { userId: user, hasFeature: (f) => f === PLUS_FEATURE && user.startsWith('plus-') } : null;
};

async function serve(opts: { auth?: Authenticate; anthropicKey?: string; free?: number } = {}) {
  const db = memoryDatabase();
  const api = createApi({
    db,
    auth: 'auth' in opts ? opts.auth : fakeAuth,
    publishableKey: 'pk_test_x',
    anthropicKey: opts.anthropicKey ?? 'sk-secret',
    limits: { ...DEFAULT_LIMITS, free: opts.free ?? 2, plus: 5 },
    maxStateBytes: 4096,
  });
  const server = createServer((req, res) => api(req, res, () => ((res.statusCode = 404), res.end('next'))));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (path: string, init: RequestInit & { user?: string } = {}) =>
    realFetch(`${base}${path}`, { ...init, headers: { ...(init.user ? { authorization: `Bearer ${init.user}` } : {}), ...(init.headers as Record<string, string>) } });
  return { base, db, call, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const doc = (xp: number) => ({ app: 'chemrster', data: { 'chemrster:progress:v1': { xp } } });
const put = (baseRev: number, data: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseRev, data }) });
const message = (model = 'claude-haiku-5-5', max_tokens = 1000) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ model, max_tokens, messages: [] }),
});

afterEach(() => vi.unstubAllGlobals());

describe('config and health', () => {
  it('hands the browser the publishable key only when accounts are on', async () => {
    const on = await serve();
    expect(await (await on.call('/api/config')).json()).toEqual({ clerkPublishableKey: 'pk_test_x' });
    expect(await (await on.call('/api/health')).json()).toEqual({ ok: true });
    await on.close();
    const off = await serve({ auth: undefined });
    expect(await (await off.call('/api/config')).json()).toEqual({ clerkPublishableKey: null });
    expect((await off.call('/api/state')).status).toBe(404);
    await off.close();
  });

  it('leaves everything outside /api to the static files', async () => {
    const s = await serve();
    expect(await (await s.call('/index.html')).text()).toBe('next');
    await s.close();
  });
});

describe('saved state', () => {
  it('needs a session', async () => {
    const s = await serve();
    expect((await s.call('/api/state')).status).toBe(401);
    expect((await s.call('/api/state', put(0, doc(1)))).status).toBe(401);
    await s.close();
  });

  it('starts empty, saves by revision and keeps accounts apart', async () => {
    const s = await serve();
    expect(await (await s.call('/api/state', { user: 'ana' })).json()).toMatchObject({ rev: 0, data: null });
    expect(await (await s.call('/api/state', { user: 'ana', ...put(0, doc(10)) })).json()).toEqual({ rev: 1 });
    expect(await (await s.call('/api/state', { user: 'ana', ...put(1, doc(20)) })).json()).toEqual({ rev: 2 });
    expect(await (await s.call('/api/state', { user: 'ana' })).json()).toMatchObject({ rev: 2, data: doc(20) });
    expect(await (await s.call('/api/state', { user: 'bia' })).json()).toMatchObject({ rev: 0, data: null });
    await s.close();
  });

  it('refuses a save based on an old revision and returns the newer copy', async () => {
    const s = await serve();
    await s.call('/api/state', { user: 'ana', ...put(0, doc(10)) });
    await s.call('/api/state', { user: 'ana', ...put(1, doc(20)) });
    const res = await s.call('/api/state', { user: 'ana', ...put(1, doc(99)) });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ current: { rev: 2, data: doc(20) } });
    // A second device's first save never overwrites what is there.
    expect((await s.call('/api/state', { user: 'ana', ...put(0, doc(1)) })).status).toBe(409);
    await s.close();
  });

  it('only stores CheMrster backups within the size limit', async () => {
    const s = await serve();
    expect((await s.call('/api/state', { user: 'ana', ...put(0, { hello: 1 }) })).status).toBe(400);
    expect((await s.call('/api/state', { user: 'ana', ...put(-1, doc(1)) })).status).toBe(400);
    expect((await s.call('/api/state', { user: 'ana', ...put(0, { ...doc(1), pad: 'x'.repeat(5000) }) })).status).toBe(413);
    await s.close();
  });

  it('refuses writes from other sites', async () => {
    const s = await serve();
    const res = await s.call('/api/state', { user: 'ana', ...put(0, doc(1)), headers: { 'content-type': 'application/json', origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    await s.close();
  });

  it('deletes a learner’s data on request', async () => {
    const s = await serve();
    await s.call('/api/state', { user: 'ana', ...put(0, doc(10)) });
    expect((await s.call('/api/state', { user: 'ana', method: 'DELETE' })).status).toBe(200);
    expect(await s.db.getState('ana')).toBeNull();
    await s.close();
  });

  it('ignores webhooks when no signing secret is set', async () => {
    const s = await serve();
    expect((await s.call('/api/webhooks/clerk', { method: 'POST', body: '{}' })).status).toBe(404);
    await s.close();
  });
});

describe('tutor allowance', () => {
  const stubUpstream = () => {
    const upstream = vi.fn(async () => new Response('event: ping\ndata: {}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) => (String(url).startsWith('https://api.anthropic.com') ? upstream() : realFetch(url, init)));
    return upstream;
  };

  it('is only for signed-in learners', async () => {
    const upstream = stubUpstream();
    const s = await serve();
    const res = await s.call('/api/anthropic/v1/messages', message());
    expect(res.status).toBe(401);
    expect(res.headers.get('x-should-retry')).toBe('false');
    expect(((await res.json()) as { error: { type: string } }).error.type).toBe('session_required');
    expect((await s.call('/api/anthropic/status')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    await s.close();
  });

  it('counts requests per day and stops at the plan’s limit', async () => {
    const upstream = stubUpstream();
    const s = await serve({ free: 2 });
    expect((await s.call('/api/anthropic/v1/messages', { user: 'ana', ...message() })).status).toBe(200);
    expect((await s.call('/api/anthropic/v1/messages', { user: 'ana', ...message() })).status).toBe(200);
    const over = await s.call('/api/anthropic/v1/messages', { user: 'ana', ...message() });
    expect(over.status).toBe(429);
    expect(over.headers.get('x-should-retry')).toBe('false');
    expect(((await over.json()) as { error: { type: string } }).error.type).toBe('quota_exceeded');
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(await (await s.call('/api/anthropic/status', { user: 'ana' })).json()).toEqual({ available: true, plan: 'free', limit: 2, used: 3 });
    // Pro learners have their own, larger allowance.
    expect(await (await s.call('/api/anthropic/status', { user: 'plus-bia' })).json()).toEqual({ available: true, plan: 'plus', limit: 5, used: 0 });
    expect((await s.call('/api/anthropic/v1/messages', { user: 'plus-bia', ...message() })).status).toBe(200);
    await s.close();
  });

  it('only lets the server key run the tutor’s models within its token cap', async () => {
    const upstream = stubUpstream();
    const s = await serve();
    expect((await s.call('/api/anthropic/v1/messages', { user: 'ana', ...message('some-other-model') })).status).toBe(400);
    expect((await s.call('/api/anthropic/v1/messages', { user: 'ana', ...message('claude-haiku-5-5', 1_000_000) })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
    // Refused requests do not use up the allowance.
    expect(await s.db.tutorRequests('ana', dayIn(DEFAULT_LIMITS.timeZone))).toBe(0);
    await s.close();
  });
});

describe('dayIn', () => {
  it('starts days at midnight in the given time zone', () => {
    const at = new Date('2026-03-10T02:30:00Z');
    expect(dayIn('UTC', at)).toBe('2026-03-10');
    expect(dayIn('America/Sao_Paulo', at)).toBe('2026-03-09');
  });
});
