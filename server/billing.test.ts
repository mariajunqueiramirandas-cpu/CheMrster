import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LIMITS, createApi } from './api.ts';
import type { Authenticate } from './auth.ts';
import { type Preapproval, createBilling, planOf, validSignature } from './billing.ts';
import { memoryDatabase } from './db.ts';

const realFetch = globalThis.fetch;
const SECRET = 'whsec_test';
const ANA = 'user_ana';

const fakeAuth: Authenticate = async (req) => {
  const user = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
  return user ? { userId: user } : null;
};

/** Mercado Pago's API, in memory: preapprovals by id and authorized payments pointing at them. */
function fakeMercadoPago() {
  const preapprovals = new Map<string, Preapproval>();
  const payments = new Map<string, { preapproval_id: string }>();
  const calls: Array<{ method: string; path: string; body?: unknown; auth: string | null }> = [];
  let next = 1;
  const handler = async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://api.mercadopago.com', '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body, auth: new Headers(init.headers).get('authorization') });
    const reply = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'POST' && path === '/preapproval') {
      const id = `2c93808${next++}`;
      const p: Preapproval = { id, status: 'pending', external_reference: body.external_reference, payer_email: body.payer_email, init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`, auto_recurring: body.auto_recurring };
      preapprovals.set(id, p);
      return reply(201, p);
    }
    const pre = /^\/preapproval\/(\w+)$/.exec(path);
    if (pre) {
      const p = preapprovals.get(pre[1]);
      if (!p) return reply(404, { message: 'not found' });
      if (method === 'PUT') Object.assign(p, body);
      return reply(200, p);
    }
    const pay = /^\/authorized_payments\/(\w+)$/.exec(path);
    if (pay && payments.has(pay[1])) return reply(200, payments.get(pay[1]));
    return reply(404, { message: 'not found' });
  };
  return { preapprovals, payments, calls, handler };
}

async function serve() {
  const mp = fakeMercadoPago();
  vi.stubGlobal('fetch', (url: string | URL | Request, init?: RequestInit) =>
    String(url).startsWith('https://api.mercadopago.com') ? mp.handler(String(url), init) : realFetch(url, init),
  );
  const db = memoryDatabase();
  const billing = createBilling(db, { accessToken: 'APP_USR-test', webhookSecret: SECRET, price: 19.9, reason: 'CheMrster Pro', appUrl: 'https://chemrster.example' });
  const api = createApi({ db, auth: fakeAuth, publishableKey: 'pk_test_x', billing, limits: { ...DEFAULT_LIMITS, free: 2, plus: 5 }, maxStateBytes: 4096 });
  const server = createServer((req, res) => api(req, res, () => ((res.statusCode = 404), res.end('next'))));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (path: string, init: { method?: string; body?: unknown; user?: string; headers?: Record<string, string> } = {}) => {
    const res = await realFetch(`${base}${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: { 'content-type': 'application/json', ...(init.user ? { authorization: `Bearer ${init.user}` } : {}), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  /** A notification as Mercado Pago signs it. */
  const notify = (type: string, id: string, secret = SECRET) => {
    const ts = '1792280000';
    const v1 = createHmac('sha256', secret).update(`id:${id};request-id:req-1;ts:${ts};`).digest('hex');
    return call(`/api/webhooks/mercadopago?data.id=${id}&type=${type}`, {
      body: { type, action: 'updated', data: { id } },
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' },
    });
  };
  return { db, mp, call, notify, close: () => new Promise<void>((r) => server.close(() => r())) };
}

afterEach(() => vi.unstubAllGlobals());

describe('Mercado Pago billing', () => {
  it('tells the browser the price and starts everyone on the free plan', async () => {
    const s = await serve();
    expect((await s.call('/api/config')).body.billing).toEqual({ price: 19.9, currency: 'BRL', limits: { free: 2, plus: 5 } });
    expect((await s.call('/api/billing', { user: ANA })).body).toEqual({ enabled: true, price: 19.9, plan: 'free', subscription: null });
    expect((await s.call('/api/billing')).status).toBe(401);
    await s.close();
  });

  it('creates a pending monthly subscription in reais and sends the learner to pay it', async () => {
    const s = await serve();
    const r = await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: ' Ana@Example.com ' } });
    expect(r.status).toBe(200);
    expect(r.body.url).toMatch(/^https:\/\/www\.mercadopago\.com\.br\/subscriptions\/checkout/);
    const created = s.mp.calls.find((c) => c.method === 'POST');
    expect(created?.auth).toBe('Bearer APP_USR-test');
    expect(created?.body).toEqual({
      reason: 'CheMrster Pro',
      external_reference: ANA,
      payer_email: 'ana@example.com',
      auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 19.9, currency_id: 'BRL' },
      back_url: 'https://chemrster.example/?assinatura=retorno',
      status: 'pending',
    });
    // Paying is not done yet: still free. Coming back to checkout reuses the same page.
    expect((await s.call('/api/billing', { user: ANA })).body.plan).toBe('free');
    expect((await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } })).body.url).toBe(r.body.url);
    expect(s.mp.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect((await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'not-an-email' } })).status).toBe(400);
    await s.close();
  });

  it('turns Pro on when Mercado Pago says the subscription is authorized, and raises the tutor allowance', async () => {
    const s = await serve();
    await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } });
    const [id] = s.mp.preapprovals.keys();
    Object.assign(s.mp.preapprovals.get(id)!, { status: 'authorized', next_payment_date: '2030-01-10T00:00:00.000Z' });
    expect((await s.notify('subscription_preapproval', id)).status).toBe(200);
    const after = (await s.call('/api/billing', { user: ANA })).body;
    expect(after.plan).toBe('plus');
    expect(after.subscription).toMatchObject({ status: 'authorized', nextPaymentDate: '2030-01-10T00:00:00.000Z', paidUntil: '2030-01-10T00:00:00.000Z' });
    expect((await s.call('/api/anthropic/status', { user: ANA })).body).toMatchObject({ plan: 'plus', limit: 5 });
    await s.close();
  });

  it('reads the subscription back when the learner returns from paying', async () => {
    const s = await serve();
    await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } });
    const [id] = s.mp.preapprovals.keys();
    s.mp.preapprovals.get(id)!.status = 'authorized';
    expect((await s.call('/api/billing/sync', { user: ANA, body: { preapprovalId: id } })).body.plan).toBe('plus');
    // Someone else's subscription id does not give Pro to another learner.
    expect((await s.call('/api/billing/sync', { user: 'user_bia', body: { preapprovalId: id } })).body.plan).toBe('free');
    await s.close();
  });

  it('follows monthly charges through the authorized payment notifications', async () => {
    const s = await serve();
    await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } });
    const [id] = s.mp.preapprovals.keys();
    s.mp.preapprovals.get(id)!.status = 'authorized';
    s.mp.payments.set('7001', { preapproval_id: id });
    expect((await s.notify('subscription_authorized_payment', '7001')).status).toBe(200);
    expect((await s.call('/api/billing', { user: ANA })).body.plan).toBe('plus');
    await s.close();
  });

  it('refuses unsigned or forged notifications and never trusts their content', async () => {
    const s = await serve();
    await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } });
    const [id] = s.mp.preapprovals.keys();
    s.mp.preapprovals.get(id)!.status = 'authorized';
    expect((await s.notify('subscription_preapproval', id, 'wrong-secret')).status).toBe(401);
    expect((await s.call(`/api/webhooks/mercadopago?data.id=${id}&type=subscription_preapproval`, { body: { type: 'subscription_preapproval', data: { id } } })).status).toBe(401);
    expect((await s.call('/api/billing', { user: ANA })).body.plan).toBe('free');
    await s.close();
  });

  it('keeps Pro until the end of the paid month after a cancellation', async () => {
    const s = await serve();
    await s.call('/api/billing/checkout', { user: ANA, body: { payerEmail: 'ana@example.com' } });
    const [id] = s.mp.preapprovals.keys();
    Object.assign(s.mp.preapprovals.get(id)!, { status: 'authorized', next_payment_date: '2030-01-10T00:00:00.000Z' });
    await s.notify('subscription_preapproval', id);
    const r = await s.call('/api/billing/cancel', { user: ANA, body: {} });
    expect(r.status).toBe(200);
    expect(s.mp.calls.at(-1)).toMatchObject({ method: 'PUT', path: `/preapproval/${id}`, body: { status: 'cancelled' } });
    expect(r.body).toMatchObject({ plan: 'plus', subscription: { status: 'cancelled', paidUntil: '2030-01-10T00:00:00.000Z' } });
    expect((await s.call('/api/billing/cancel', { user: ANA, body: {} })).status).toBe(409);
    await s.close();
  });

  it('ignores subscriptions this app did not create, and ids Mercado Pago does not know', async () => {
    const s = await serve();
    expect((await s.notify('subscription_preapproval', 'nope1')).status).toBe(200);
    s.mp.preapprovals.set('abc1', { id: 'abc1', status: 'authorized', external_reference: 'order-42' });
    expect((await s.notify('subscription_preapproval', 'abc1')).status).toBe(200);
    expect(await s.db.getSubscription('order-42')).toBeNull();
    await s.close();
  });
});

describe('planOf', () => {
  const sub = (status: string, paidUntil: string | null) => ({ userId: ANA, id: 'p', status, payerEmail: null, amount: 19.9, initPoint: null, nextPaymentDate: null, paidUntil });
  it('is Pro while authorized, or until the paid date after a cancellation', () => {
    const now = new Date('2030-01-01T00:00:00Z');
    expect(planOf(null, now)).toBe('free');
    expect(planOf(sub('pending', null), now)).toBe('free');
    expect(planOf(sub('authorized', null), now)).toBe('plus');
    expect(planOf(sub('cancelled', '2030-01-10T00:00:00Z'), now)).toBe('plus');
    expect(planOf(sub('cancelled', '2029-12-10T00:00:00Z'), now)).toBe('free');
  });
});

describe('validSignature', () => {
  it('checks the HMAC of id, request id and timestamp', () => {
    const v1 = createHmac('sha256', 's').update('id:abc123;request-id:r1;ts:42;').digest('hex');
    expect(validSignature('s', `ts=42,v1=${v1}`, 'r1', 'ABC123')).toBe(true);
    expect(validSignature('s', `ts=43,v1=${v1}`, 'r1', 'abc123')).toBe(false);
    expect(validSignature('s', undefined, 'r1', 'abc123')).toBe(false);
    expect(validSignature('s', 'garbage', 'r1', 'abc123')).toBe(false);
  });
});
