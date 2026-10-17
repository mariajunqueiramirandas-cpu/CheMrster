/**
 * The Pro plan, paid through Mercado Pago subscriptions (the Preapproval API): a monthly
 * charge in reais that Mercado Pago renews by itself.
 *
 * Checkout creates a pending subscription for the learner (external_reference = their Clerk
 * user id) and sends them to Mercado Pago's page (init_point) to pay; they come back to the
 * app (back_url). The state of a subscription is never taken from what a browser or a
 * notification says: it is always read back from Mercado Pago with the server's access token,
 * on return to the app, on Mercado Pago's webhook and on request.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Database, Subscription } from './db.ts';

const API = 'https://api.mercadopago.com';

export interface BillingOptions {
  accessToken: string;
  /** Mercado Pago → Suas integrações → Webhooks → assinatura secreta. */
  webhookSecret?: string;
  /** Monthly price of Pro, in reais. */
  price: number;
  /** What the learner sees on Mercado Pago's page and their statement. */
  reason: string;
  /** Where Mercado Pago sends the learner after paying: the app's own URL. */
  appUrl: string;
}

/** A subscription as Mercado Pago returns it (only the fields used here). */
export interface Preapproval {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number; currency_id?: string };
}

export class BillingError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Pro until when: an active subscription, or a cancelled one until the end of the month paid for. */
export function planOf(sub: Subscription | null, now = new Date()): 'free' | 'plus' {
  if (!sub) return 'free';
  if (sub.status === 'authorized') return 'plus';
  if (sub.paidUntil && new Date(sub.paidUntil) > now) return 'plus';
  return 'free';
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

export function createBilling(db: Database, o: BillingOptions) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${o.accessToken}`, 'content-type': 'application/json', accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new BillingError(`Não foi possível falar com o Mercado Pago: ${err instanceof Error ? err.message : String(err)}`);
    }
    const body = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (!res.ok) {
      console.error(`Mercado Pago ${init.method ?? 'GET'} ${path}: ${res.status}`, body);
      // The server's own credentials were refused: a configuration problem, not the learner's.
      if (res.status === 401 || res.status === 403) throw new BillingError('Os pagamentos estão indisponíveis no momento. Tente de novo mais tarde.', 502);
      throw new BillingError(body.message ? `Mercado Pago: ${body.message}` : `Mercado Pago respondeu ${res.status}.`, res.status >= 500 ? 502 : 400);
    }
    return body;
  }

  /** Stores what Mercado Pago says about a subscription; only ones this app created for a user are kept. */
  async function record(p: Preapproval): Promise<Subscription | null> {
    const userId = p.external_reference;
    if (!userId || !/^user_[A-Za-z0-9]+$/.test(userId)) return null;
    const previous = await db.getSubscription(userId);
    // A notification about an older subscription of the same learner does not replace the current one.
    if (previous && previous.id !== p.id && previous.status === 'authorized' && p.status !== 'authorized') return previous;
    const sub: Subscription = {
      userId,
      id: p.id,
      status: p.status,
      payerEmail: p.payer_email ?? previous?.payerEmail ?? null,
      amount: p.auto_recurring?.transaction_amount ?? previous?.amount ?? o.price,
      initPoint: p.init_point ?? null,
      nextPaymentDate: p.next_payment_date ?? null,
      // Paid through the next charge while active; after a cancellation (or during a new checkout), what was paid for stays.
      paidUntil: later(previous?.paidUntil ?? null, p.status === 'authorized' ? (p.next_payment_date ?? null) : null),
    };
    await db.saveSubscription(sub);
    return sub;
  }

  const fetchPreapproval = (id: string) => call<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);

  return {
    price: o.price,

    async status(userId: string) {
      const sub = await db.getSubscription(userId);
      return { plan: planOf(sub), subscription: sub };
    },

    /** A pending subscription and the Mercado Pago page to pay it on. */
    async checkout(userId: string, payerEmail: string): Promise<string> {
      const current = await db.getSubscription(userId);
      if (current?.status === 'authorized') throw new BillingError('Você já assina o Pro.', 409);
      // An unfinished checkout for the same e-mail is reused: Mercado Pago refuses a second one.
      if (current?.status === 'pending' && current.initPoint && current.payerEmail === payerEmail) return current.initPoint;
      const p = await call<Preapproval>('/preapproval', {
        method: 'POST',
        body: JSON.stringify({
          reason: o.reason,
          external_reference: userId,
          payer_email: payerEmail,
          auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: o.price, currency_id: 'BRL' },
          back_url: `${o.appUrl}/?assinatura=retorno`,
          status: 'pending',
        }),
      });
      if (!p.init_point) throw new BillingError('O Mercado Pago não devolveu o link de pagamento.');
      await record({ ...p, external_reference: userId });
      return p.init_point;
    },

    /** Reads the learner's subscription back from Mercado Pago (after checkout, or on request). */
    async sync(userId: string, preapprovalId?: string) {
      const current = await db.getSubscription(userId);
      const id = preapprovalId ?? current?.id;
      if (id) {
        const p = await fetchPreapproval(id);
        // An id from the return URL must belong to this learner.
        if (p.external_reference === userId) await record(p);
      }
      return this.status(userId);
    },

    async cancel(userId: string) {
      const current = await db.getSubscription(userId);
      if (!current || current.status === 'cancelled') throw new BillingError('Não há assinatura ativa para cancelar.', 409);
      const p = await call<Preapproval>(`/preapproval/${encodeURIComponent(current.id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
      await record({ ...p, external_reference: userId });
      return this.status(userId);
    },

    /** Mercado Pago's webhook: whatever it names is fetched again with the access token. */
    async notify(query: URLSearchParams, body: unknown, headers: { signature?: string; requestId?: string }) {
      const b = (body && typeof body === 'object' ? body : {}) as { type?: string; topic?: string; data?: { id?: unknown } };
      const type = b.type ?? b.topic ?? query.get('type') ?? query.get('topic') ?? '';
      const id = String(b.data?.id ?? query.get('data.id') ?? query.get('id') ?? '');
      if (o.webhookSecret && !validSignature(o.webhookSecret, headers.signature, headers.requestId, query.get('data.id') ?? id)) {
        throw new BillingError('Assinatura do webhook inválida.', 401);
      }
      if (!id) return;
      if (type === 'subscription_preapproval' || type === 'preapproval') await record(await fetchPreapproval(id));
      else if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
        const payment = await call<{ preapproval_id?: string }>(`/authorized_payments/${encodeURIComponent(id)}`);
        if (payment.preapproval_id) await record(await fetchPreapproval(payment.preapproval_id));
      }
    },
  };
}

export type Billing = ReturnType<typeof createBilling>;

/**
 * Mercado Pago signs notifications with HMAC-SHA256 over `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (pairs whose value is missing are left out; alphanumeric ids in lower case), sent as
 * `x-signature: ts=<ts>,v1=<hex>`.
 */
export function validSignature(secret: string, signature: string | undefined, requestId: string | undefined, dataId: string | undefined): boolean {
  if (!signature) return false;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2).map((s) => s?.trim());
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value;
  }
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
  const manifest = `${dataId ? `id:${dataId.toLowerCase()};` : ''}${requestId ? `request-id:${requestId};` : ''}ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
