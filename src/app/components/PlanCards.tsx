/** The two plans side by side: Grátis and Pro, with what each gives and an action under each. */
import type { ReactNode } from 'react';
import { type PlanOffer, formatPrice } from '../account.ts';
import { planFeatures } from '../billing.ts';

export function PlanCards({ offer, current, free, plus }: { offer: PlanOffer | null; current?: 'free' | 'plus'; free?: ReactNode; plus?: ReactNode }) {
  const features = planFeatures(offer?.limits);
  return (
    <div className="plan-cards">
      <article className={`plan-card${current === 'free' ? ' is-current' : ''}`}>
        <header>
          <h3>Grátis</h3>
          {current === 'free' && <span className="plan-badge">Seu plano</span>}
        </header>
        <p className="plan-price">
          {formatPrice(0)}
          <span>/mês</span>
        </p>
        <ul>
          {features.free.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {free && <div className="plan-action">{free}</div>}
      </article>
      {offer && (
        <article className={`plan-card plan-card--pro${current === 'plus' ? ' is-current' : ''}`}>
          <header>
            <h3>Pro</h3>
            {current === 'plus' && <span className="plan-badge">Seu plano</span>}
          </header>
          <p className="plan-price">
            {formatPrice(offer.price)}
            <span>/mês</span>
          </p>
          <ul>
            {features.plus.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {plus && <div className="plan-action">{plus}</div>}
          <p className="plan-note">Pagamento mensal pelo Mercado Pago: cartão de crédito ou saldo em conta.</p>
        </article>
      )}
    </div>
  );
}
