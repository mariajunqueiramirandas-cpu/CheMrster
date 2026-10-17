/**
 * The learner's plan and their Mercado Pago subscription to Pro, through the server
 * (server/billing.ts). Paying happens on Mercado Pago's own page; the app only starts the
 * subscription, reads it back and cancels it.
 */
import { authFetch } from './account.ts';
import { memory } from './persist.ts';
import { refreshTutorUsage } from './tutor-store.ts';

export interface SubscriptionView {
  /** pending, authorized, paused or cancelled (Mercado Pago's statuses). */
  status: string;
  payerEmail: string | null;
  amount: number;
  nextPaymentDate: string | null;
  paidUntil: string | null;
}

export interface BillingView {
  /** Whether this server takes payments (has a Mercado Pago access token). */
  enabled: boolean;
  price: number | null;
  plan: 'free' | 'plus';
  subscription: SubscriptionView | null;
}

const state = memory<BillingView | undefined>(undefined);
export const useBilling = state.use;

async function request(path: string, body?: unknown): Promise<unknown> {
  const res = await authFetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? 'Não foi possível falar com o servidor. Tente de novo.');
  return json;
}

function update(view: BillingView) {
  const before = state.get()?.plan;
  state.set(view);
  if (before && before !== view.plan) refreshTutorUsage();
}

export async function loadBilling(): Promise<void> {
  update((await request('/api/billing')) as BillingView);
}

/** Starts a subscription and leaves for Mercado Pago's page to pay it. */
export async function subscribe(payerEmail: string): Promise<void> {
  const { url } = (await request('/api/billing/checkout', { payerEmail })) as { url: string };
  location.assign(url);
}

/** Reads the subscription back from Mercado Pago (after paying, or when the learner asks). */
export async function syncBilling(preapprovalId?: string): Promise<BillingView> {
  const view = (await request('/api/billing/sync', preapprovalId ? { preapprovalId } : {})) as BillingView;
  update(view);
  return view;
}

export async function cancelSubscription(): Promise<void> {
  update((await request('/api/billing/cancel', {})) as BillingView);
}

/** What each plan gives, for the landing page and Planos. */
export function planFeatures(limits: { free: number; plus: number } | undefined) {
  return {
    free: ['A trilha inteira, com teoria e questões novas a cada vez', 'Revisão espaçada, progresso, mapa e quadro', `Tutor com IA: ${limits?.free ?? 20} pedidos por dia`, 'Tutor offline sem limite'],
    plus: ['Tudo do Grátis', `Tutor com IA: ${limits?.plus ?? 400} pedidos por dia`, 'Cancele quando quiser, pelo app'],
  };
}

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : '');
