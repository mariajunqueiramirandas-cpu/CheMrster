/** A theory card: what the lesson's exercises are about to ask, with drawings to look at. */
import { Fragment } from 'react';
import type { TheoryCard } from '../../course/types.ts';
import { SchemeView, SpecView, isWide } from './SchemeView.tsx';

/** Paragraph text where **double asterisks** mark the key terms. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/** A long chain next to a small structure leaves a hole; then every drawing gets its own row. */
function figuresClass(card: TheoryCard): string {
  const mols = card.molecules ?? [];
  if (mols.length > 1 && mols.some((m) => isWide(m, { formulas: false }))) return ' theory-figures--stack';
  return mols.length > 2 ? ' theory-figures--three' : '';
}

export function TheoryCardView({ card, animate, headingLevel = 1 }: { card: TheoryCard; animate?: boolean; headingLevel?: 1 | 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <article className="theory-card">
      <Heading className="theory-title">{card.title}</Heading>
      <div className="theory-body">
        {card.body.map((p, i) => (
          <p key={i}>
            <Rich text={p} />
          </p>
        ))}
      </div>
      {card.scheme && (
        <figure className="paper paper--scheme">
          <SchemeView scheme={card.scheme} animate={animate} />
        </figure>
      )}
      {!!card.molecules?.length && (
        <div className={`theory-figures${figuresClass(card)}`}>
          {card.molecules.map((m, i) => (
            <figure key={i} className="paper theory-figure">
              <SpecView spec={m} size={30} animate={animate} marks={m.marks} />
              {m.label && <figcaption>{m.label}</figcaption>}
            </figure>
          ))}
        </div>
      )}
      {card.tip && (
        <aside className="theory-tip">
          <span className="theory-tip-kicker">No ENEM</span>
          <p>
            <Rich text={card.tip} />
          </p>
        </aside>
      )}
    </article>
  );
}
