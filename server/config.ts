/** Builds the API from environment variables; see .env.example for each one. */
import { type ApiOptions, DEFAULT_LIMITS, createApi } from './api.ts';
import type { Middleware } from './anthropic-proxy.ts';
import { clerkAuth } from './auth.ts';
import { createBilling } from './billing.ts';
import { type Database, memoryDatabase, postgresDatabase } from './db.ts';

type Env = Record<string, string | undefined>;

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
/** Pro's monthly price in reais, with cents. */
const price = (v: string | undefined) => {
  const n = Number((v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 19.9;
};
const int = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : fallback);

/** The origins the app is served from: APP_URL plus any in APP_ORIGINS. */
export function appOrigins(env: Env): string[] {
  return [...list(env.APP_URL), ...list(env.APP_ORIGINS)].map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      throw new Error(`APP_URL/APP_ORIGINS: "${u}" não é uma URL.`);
    }
  });
}

/** Host names the server answers to; undefined leaves the check to someone else (Vite). */
export function allowedHosts(env: Env): string[] {
  return ['localhost', '127.0.0.1', '[::1]', ...appOrigins(env).map((o) => new URL(o).hostname), ...list(env.ALLOWED_HOSTS)].map((h) => h.toLowerCase());
}

export async function apiFromEnv(env: Env, { checkHosts = true } = {}): Promise<{ api: Middleware; db: Database; accounts: boolean }> {
  const publishableKey = env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY;
  const secretKey = env.CLERK_SECRET_KEY;
  if (Boolean(publishableKey) !== Boolean(secretKey)) throw new Error('Defina CLERK_PUBLISHABLE_KEY e CLERK_SECRET_KEY juntas (ou nenhuma, para rodar sem contas).');
  const accounts = Boolean(publishableKey && secretKey);
  const origins = appOrigins(env);

  let db: Database;
  if (env.DATABASE_URL) db = await postgresDatabase(env.DATABASE_URL);
  else {
    if (accounts) console.warn('Sem DATABASE_URL: os dados das contas ficam só na memória e somem quando o servidor reinicia.');
    db = memoryDatabase();
  }

  const options: ApiOptions = {
    db,
    auth: accounts
      ? clerkAuth({
          secretKey: secretKey!,
          publishableKey: publishableKey!,
          authorizedParties: origins.length ? origins : undefined,
          // Environment files keep a PEM on one line, with literal \n.
          jwtKey: env.CLERK_JWT_KEY ? env.CLERK_JWT_KEY.replace(/\\n/g, '\n') : undefined,
        })
      : undefined,
    publishableKey,
    webhookSecret: env.CLERK_WEBHOOK_SIGNING_SECRET || undefined,
    billing: env.MERCADO_PAGO_ACCESS_TOKEN
      ? createBilling(db, {
          accessToken: env.MERCADO_PAGO_ACCESS_TOKEN,
          webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET || undefined,
          price: price(env.PRO_PRICE_BRL),
          reason: env.PRO_REASON || 'CheMrster Pro',
          appUrl: origins[0] ?? 'http://localhost:5173',
        })
      : undefined,
    anthropicKey: env.ANTHROPIC_API_KEY || undefined,
    allowedHosts: checkHosts ? allowedHosts(env) : undefined,
    limits: {
      free: int(env.TUTOR_DAILY_LIMIT_FREE, DEFAULT_LIMITS.free),
      plus: int(env.TUTOR_DAILY_LIMIT_PLUS, DEFAULT_LIMITS.plus),
      models: env.TUTOR_MODELS ? list(env.TUTOR_MODELS) : DEFAULT_LIMITS.models,
      maxTokens: int(env.TUTOR_MAX_TOKENS, DEFAULT_LIMITS.maxTokens),
      timeZone: env.QUOTA_TIME_ZONE || DEFAULT_LIMITS.timeZone,
    },
    maxStateBytes: int(env.MAX_STATE_BYTES, 8 * 1024 * 1024),
  };
  return { api: createApi(options), db, accounts };
}
