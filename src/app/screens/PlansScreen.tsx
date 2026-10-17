/** Planos: today's tutor allowance, the two plans, and the learner's Mercado Pago subscription to Pro. */
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { formatPrice, usePlanOffer } from '../account.ts';
import { type BillingView, cancelSubscription, formatDate, loadBilling, subscribe, syncBilling, useBilling } from '../billing.ts';
import { TutorIcon } from '../components/Icons.tsx';
import { PlanCards } from '../components/PlanCards.tsx';
import { UsageMeter } from '../components/UsageMeter.tsx';
import { toast } from '../toast.ts';
import { refreshTutorUsage, useTutorUsage } from '../tutor-store.ts';

export function PlansScreen() {
  const usage = useTutorUsage();
  const billing = useBilling();
  const offer = usePlanOffer();
  useEffect(() => {
    refreshTutorUsage();
    loadBilling().catch((err: Error) => toast(err.message));
  }, []);
  return (
    <div className="settings plans">
      <h1>Planos</h1>
      {usage && (
        <section className="settings-section" aria-labelledby="plan-usage">
          <h2 id="plan-usage">
            <TutorIcon /> Tutor com IA hoje
          </h2>
          <UsageMeter used={usage.used} limit={usage.limit} />
          <p className="settings-note">
            Plano atual: <strong>{usage.plan === 'plus' ? 'Pro' : 'Grátis'}</strong>. Cada resposta do tutor conta um pedido, ou alguns quando ele usa ferramentas (analisar
            uma molécula, propor uma questão). O limite volta à meia-noite; quando ele acaba, o tutor offline continua respondendo com a apostila do app.
          </p>
        </section>
      )}
      <PlanCards offer={offer} current={billing?.plan} plus={billing && <ProAction billing={billing} />} />
      {billing && !billing.enabled && <p className="settings-note">Assinaturas ainda não estão disponíveis neste servidor.</p>}
    </div>
  );
}

/** What the learner can do about Pro, by the state of their subscription. */
function ProAction({ billing }: { billing: BillingView }) {
  const { user } = useUser();
  const sub = billing.subscription;
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const payerEmail = email || sub?.payerEmail || user?.primaryEmailAddress?.emailAddress || '';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const refresh = () =>
    run(async () => {
      const view = await syncBilling();
      toast(view.plan === 'plus' ? 'Pro ativo. Bons estudos!' : 'Ainda não recebemos a confirmação do Mercado Pago.');
    });

  if (!billing.enabled) return null;

  if (sub?.status === 'authorized') {
    return (
      <>
        <p className="plan-status plan-status--on">
          Assinatura ativa{sub.nextPaymentDate ? `; próxima cobrança em ${formatDate(sub.nextPaymentDate)}` : ''} ({formatPrice(sub.amount)}).
        </p>
        <button
          type="button"
          className="btn btn--quiet btn--danger"
          disabled={busy}
          onClick={() => {
            if (confirm(`Cancelar a assinatura do Pro? Você continua com o Pro até ${formatDate(sub.paidUntil) || 'o fim do mês pago'}.`)) {
              void run(async () => {
                await cancelSubscription();
                toast('Assinatura cancelada.');
              });
            }
          }}
        >
          Cancelar assinatura
        </button>
      </>
    );
  }

  const checkout = (
    <form
      className="plan-checkout"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => subscribe(payerEmail));
      }}
    >
      <label className="field">
        <span className="field-label">E-mail da sua conta do Mercado Pago</span>
        <input className="field-input field-input--plain" type="email" required value={payerEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>
        {busy ? 'Abrindo o Mercado Pago…' : sub?.status === 'pending' ? 'Continuar pagamento' : 'Assinar com Mercado Pago'}
      </button>
    </form>
  );

  return (
    <>
      {sub?.status === 'pending' && <p className="plan-status">Pagamento pendente no Mercado Pago.</p>}
      {sub?.status === 'paused' && <p className="plan-status plan-status--error">Assinatura pausada: o Mercado Pago não conseguiu cobrar. Atualize o pagamento por lá.</p>}
      {sub?.status === 'cancelled' && billing.plan === 'plus' && <p className="plan-status">Assinatura cancelada: o Pro continua até {formatDate(sub.paidUntil)}.</p>}
      {checkout}
      {sub && (
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={refresh}>
          Já paguei: atualizar
        </button>
      )}
    </>
  );
}
