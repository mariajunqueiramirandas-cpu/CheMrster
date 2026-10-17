/**
 * The learner's account, when the server has accounts on (Clerk). The Clerk session lives in
 * React; this module hands its short-lived tokens to code outside React (the tutor's API
 * client, the progress sync) as an `Authorization: Bearer` header.
 */
import { memory } from './persist.ts';

type TokenSource = () => Promise<string | null>;
let tokenSource: TokenSource | undefined;

/** Whether this server has accounts, so the app is behind a sign-in and saves to the cloud. */
export const accounts = memory(false);
export const useAccounts = accounts.use;

export function setTokenSource(source: TokenSource | undefined) {
  tokenSource = source;
}

/** fetch() with the session's token added, for this site's own API. */
export const authFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const token = await tokenSource?.().catch(() => null);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

/** Pro on this server: its monthly price in reais and the tutor's daily allowance on each plan. */
export interface PlanOffer {
  price: number;
  currency: 'BRL';
  limits: { free: number; plus: number };
}
const offer = memory<PlanOffer | null>(null);
export const usePlanOffer = offer.use;

/** What the browser needs to start, from the server (so one Docker image serves any Clerk instance). */
export async function loadConfig(): Promise<{ clerkPublishableKey: string | null }> {
  try {
    const res = await fetch('/api/config', { headers: { accept: 'application/json' } });
    if (res.ok) {
      const j = (await res.json()) as { clerkPublishableKey?: unknown; billing?: PlanOffer | null };
      if (typeof j.clerkPublishableKey === 'string' && j.clerkPublishableKey) {
        offer.set(j.billing && typeof j.billing.price === 'number' ? j.billing : null);
        return { clerkPublishableKey: j.clerkPublishableKey };
      }
    }
  } catch {
    // A static host without the API: run on this device only.
  }
  return { clerkPublishableKey: null };
}

export const formatPrice = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
