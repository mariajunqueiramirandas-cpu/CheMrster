/** Planos: today's tutor allowance and Clerk's pricing table to subscribe or change plan. */
import { PricingTable } from '@clerk/react';
import { useEffect } from 'react';
import { TutorIcon } from '../components/Icons.tsx';
import { UsageMeter } from '../components/UsageMeter.tsx';
import { refreshTutorUsage, useTutorUsage } from '../tutor-store.ts';

export function PlansScreen() {
  const usage = useTutorUsage();
  useEffect(() => refreshTutorUsage(), []);
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
      <PricingTable />
    </div>
  );
}
