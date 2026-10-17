/**
 * The SaaS side of the server, shared by the production server and `npm run dev`:
 *
 *   GET    /api/config              what the browser needs to start (Clerk's publishable key, Pro's price)
 *   GET    /api/health              liveness and database check, for the container
 *   GET    /api/state               the signed-in learner's saved app state
 *   PUT    /api/state               saves it, if nobody else saved since ({ baseRev, data })
 *   DELETE /api/state               deletes it
 *   GET    /api/billing             the learner's plan and Mercado Pago subscription
 *   POST   /api/billing/checkout    starts a subscription to Pro ({ payerEmail }) → { url } to pay on Mercado Pago
 *   POST   /api/billing/sync        reads the subscription back from Mercado Pago ({ preapprovalId? })
 *   POST   /api/billing/cancel      cancels it (Pro lasts until the end of the month paid for)
 *   POST   /api/webhooks/clerk      Clerk events: a deleted user's data is deleted too
 *   POST   /api/webhooks/mercadopago  Mercado Pago events: subscriptions and their monthly charges
 *   *      /api/anthropic/...       the tutor proxy, for signed-in learners within their daily allowance
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { type Gate, type Middleware, type Refusal, anthropicProxy, apiError, hostName, json, readBody, refuse, sameOrigin } from './anthropic-proxy.ts';
import { type Authenticate, toFetchRequest } from './auth.ts';
import { type Billing, BillingError, planOf } from './billing.ts';
import type { Database } from './db.ts';

export interface TutorLimits {
  /** Requests a day (one tutor answer can take a few, when it uses tools). */
  free: number;
  plus: number;
  /** The models the server's key may be used for. */
  models: string[];
  maxTokens: number;
  /** Days start at midnight here. */
  timeZone: string;
}

export interface ApiOptions {
  db: Database;
  /** Without it, accounts are off: the app runs on this device only, as before. */
  auth?: Authenticate;
  publishableKey?: string;
  webhookSecret?: string;
  /** Pro through Mercado Pago; without it, everyone is on the free plan. */
  billing?: Billing;
  anthropicKey?: string;
  allowedHosts?: string[];
  limits: TutorLimits;
  /** Largest saved state, in bytes. */
  maxStateBytes: number;
}

export const DEFAULT_LIMITS: TutorLimits = {
  free: 20,
  plus: 400,
  models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  maxTokens: 32000,
  timeZone: 'America/Sao_Paulo',
};

/** YYYY-MM-DD in a time zone. */
export function dayIn(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

const SIGN_IN: Refusal = { status: 401, type: 'session_required', message: 'Entre na sua conta para usar o tutor com IA.' };

export function tutorGate(db: Database, auth: Authenticate, limits: TutorLimits): Gate {
  const allowance = async (userId: string) =>
    planOf(await db.getSubscription(userId)) === 'plus' ? { plan: 'plus', limit: limits.plus } : { plan: 'free', limit: limits.free };
  return {
    async status(req) {
      const viewer = await auth(req);
      if (!viewer) return SIGN_IN;
      const { plan, limit } = await allowance(viewer.userId);
      return { plan, limit, used: await db.tutorRequests(viewer.userId, dayIn(limits.timeZone)) };
    },
    async admit(req, body) {
      const viewer = await auth(req);
      if (!viewer) return SIGN_IN;
      if (typeof body.model !== 'string' || !limits.models.includes(body.model)) {
        return { status: 400, type: 'invalid_request_error', message: `Modelo não disponível neste servidor: ${String(body.model)}.` };
      }
      if (typeof body.max_tokens !== 'number' || body.max_tokens > limits.maxTokens) {
        return { status: 400, type: 'invalid_request_error', message: `max_tokens acima do limite do servidor (${limits.maxTokens}).` };
      }
      const { plan, limit } = await allowance(viewer.userId);
      const used = await db.countTutorRequest(viewer.userId, dayIn(limits.timeZone));
      if (used > limit) {
        return {
          status: 429,
          type: 'quota_exceeded',
          message:
            plan === 'plus'
              ? `Você chegou ao limite de ${limit} pedidos ao tutor hoje. Amanhã tem mais; até lá, o tutor offline continua respondendo.`
              : `Você usou os ${limit} pedidos ao tutor com IA de hoje do plano Grátis. Assine o Pro para continuar hoje, ou volte amanhã.`,
        };
      }
      return undefined;
    },
  };
}

export function createApi(o: ApiOptions): Middleware {
  const proxy = anthropicProxy(o.anthropicKey, { allowedHosts: o.allowedHosts, gate: o.auth ? tutorGate(o.db, o.auth, o.limits) : undefined });
  const route = async (req: IncomingMessage, res: ServerResponse, path: string): Promise<void> => {
    if (path === '/api/config' && req.method === 'GET') {
      return json(res, 200, {
        clerkPublishableKey: o.auth ? (o.publishableKey ?? null) : null,
        billing: o.auth && o.billing ? { price: o.billing.price, currency: 'BRL', limits: { free: o.limits.free, plus: o.limits.plus } } : null,
      });
    }
    if (path === '/api/health') {
      try {
        await o.db.ping();
        return json(res, 200, { ok: true });
      } catch {
        return json(res, 503, { ok: false });
      }
    }
    if (path === '/api/webhooks/clerk' && req.method === 'POST') return webhook(req, res);
    if (path === '/api/webhooks/mercadopago' && req.method === 'POST') return mercadoPago(req, res);
    if (path === '/api/state') return state(req, res);
    if (path === '/api/billing' || path.startsWith('/api/billing/')) return billing(req, res, path);
    return json(res, 404, apiError('not_found_error', 'Rota não disponível.'));
  };

  const state = async (req: IncomingMessage, res: ServerResponse) => {
    if (!o.auth) return json(res, 404, apiError('not_found_error', 'Contas não estão ligadas neste servidor.'));
    if (!sameOrigin(req)) return json(res, 403, apiError('permission_error', 'Origem não permitida.'));
    const viewer = await o.auth(req);
    if (!viewer) return refuse(res, SIGN_IN);
    if (req.method === 'GET') {
      const saved = await o.db.getState(viewer.userId);
      return json(res, 200, saved ?? { rev: 0, data: null, updatedAt: null });
    }
    if (req.method === 'DELETE') {
      await o.db.deleteUser(viewer.userId);
      return json(res, 200, { rev: 0 });
    }
    if (req.method !== 'PUT') return json(res, 405, apiError('invalid_request_error', 'Método não permitido.'));
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return json(res, 415, apiError('invalid_request_error', 'Envie JSON.'));
    let body: { baseRev?: unknown; data?: unknown };
    try {
      body = JSON.parse((await readBody(req, o.maxStateBytes)).toString('utf8'));
    } catch (err) {
      const tooBig = err instanceof Error && err.message === 'body too large';
      return json(res, tooBig ? 413 : 400, apiError(tooBig ? 'request_too_large' : 'invalid_request_error', tooBig ? 'Dados grandes demais para salvar.' : 'JSON inválido.'));
    }
    const { baseRev, data } = body ?? {};
    if (!Number.isInteger(baseRev) || (baseRev as number) < 0 || !data || typeof data !== 'object' || (data as { app?: unknown }).app !== 'chemrster') {
      return json(res, 400, apiError('invalid_request_error', 'Envie { baseRev, data } com um backup do CheMrster.'));
    }
    const result = await o.db.putState(viewer.userId, baseRev as number, data);
    if (result.ok) return json(res, 200, { rev: result.rev });
    return json(res, 409, { ...apiError('conflict', 'Outro aparelho salvou antes.'), current: result.current ?? { rev: 0, data: null, updatedAt: null } });
  };

  const webhook = async (req: IncomingMessage, res: ServerResponse) => {
    if (!o.webhookSecret) return json(res, 404, apiError('not_found_error', 'Webhook não configurado.'));
    let event;
    try {
      event = await verifyWebhook(toFetchRequest(req, new Uint8Array(await readBody(req, 1024 * 1024))), { signingSecret: o.webhookSecret });
    } catch {
      return json(res, 400, apiError('invalid_request_error', 'Assinatura inválida.'));
    }
    if (event.type === 'user.deleted' && event.data.id) await o.db.deleteUser(event.data.id);
    return json(res, 200, { received: true });
  };

  const billing = async (req: IncomingMessage, res: ServerResponse, path: string) => {
    if (!o.auth) return json(res, 404, apiError('not_found_error', 'Contas não estão ligadas neste servidor.'));
    if (!sameOrigin(req)) return json(res, 403, apiError('permission_error', 'Origem não permitida.'));
    const viewer = await o.auth(req);
    if (!viewer) return refuse(res, SIGN_IN);
    const view = (s: Awaited<ReturnType<Billing['status']>>) => ({
      enabled: Boolean(o.billing),
      price: o.billing?.price ?? null,
      plan: s.plan,
      subscription: s.subscription && {
        status: s.subscription.status,
        payerEmail: s.subscription.payerEmail,
        amount: s.subscription.amount,
        nextPaymentDate: s.subscription.nextPaymentDate,
        paidUntil: s.subscription.paidUntil,
      },
    });
    if (path === '/api/billing' && req.method === 'GET') {
      return json(res, 200, view(o.billing ? await o.billing.status(viewer.userId) : { plan: 'free', subscription: null }));
    }
    if (req.method !== 'POST') return json(res, 405, apiError('invalid_request_error', 'Método não permitido.'));
    if (!o.billing) return json(res, 404, apiError('not_found_error', 'Pagamentos não estão ligados neste servidor.'));
    let body: Record<string, unknown> = {};
    try {
      const raw = (await readBody(req, 16 * 1024)).toString('utf8');
      if (raw) body = JSON.parse(raw);
    } catch {
      return json(res, 400, apiError('invalid_request_error', 'JSON inválido.'));
    }
    try {
      if (path === '/api/billing/checkout') {
        const email = typeof body.payerEmail === 'string' ? body.payerEmail.trim().toLowerCase() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
          return json(res, 400, apiError('invalid_request_error', 'Informe o e-mail da sua conta do Mercado Pago.'));
        }
        return json(res, 200, { url: await o.billing.checkout(viewer.userId, email) });
      }
      if (path === '/api/billing/sync') {
        const id = typeof body.preapprovalId === 'string' && /^[A-Za-z0-9]{1,64}$/.test(body.preapprovalId) ? body.preapprovalId : undefined;
        return json(res, 200, view(await o.billing.sync(viewer.userId, id)));
      }
      if (path === '/api/billing/cancel') return json(res, 200, view(await o.billing.cancel(viewer.userId)));
    } catch (err) {
      if (err instanceof BillingError) return json(res, err.status, apiError('billing_error', err.message));
      throw err;
    }
    return json(res, 404, apiError('not_found_error', 'Rota não disponível.'));
  };

  const mercadoPago = async (req: IncomingMessage, res: ServerResponse) => {
    if (!o.billing) return json(res, 404, apiError('not_found_error', 'Pagamentos não estão ligados neste servidor.'));
    let body: unknown = {};
    try {
      const raw = (await readBody(req, 64 * 1024)).toString('utf8');
      if (raw) body = JSON.parse(raw);
    } catch {
      return json(res, 400, apiError('invalid_request_error', 'JSON inválido.'));
    }
    const header = (name: string) => (typeof req.headers[name] === 'string' ? (req.headers[name] as string) : undefined);
    try {
      await o.billing.notify(new URL(req.url ?? '/', 'http://x').searchParams, body, { signature: header('x-signature'), requestId: header('x-request-id') });
    } catch (err) {
      if (!(err instanceof BillingError)) throw err;
      // Mercado Pago retries anything but a 2xx: worth it when its API could not be reached, not for
      // a bad signature (refused) or an id its API does not know (nothing to retry).
      if (err.status === 401 || err.status >= 500) return json(res, err.status, apiError('billing_error', err.message));
      return json(res, 200, { received: true, ignored: err.message });
    }
    return json(res, 200, { received: true });
  };

  return (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (path.startsWith('/api/anthropic/')) return proxy(req, res, next);
    if (!path.startsWith('/api/')) return next();
    if (o.allowedHosts && !o.allowedHosts.includes(hostName(req.headers.host).toLowerCase())) return json(res, 403, apiError('permission_error', 'Host não permitido.'));
    route(req, res, path).catch((err) => {
      console.error('API:', err);
      if (!res.headersSent) json(res, 500, apiError('api_error', 'Erro interno do servidor.'));
      else res.end();
    });
  };
}

