/** The studio's reaction lab: pick a reaction, see the computed product, open it next. */
import { useMemo, useState } from 'react';
import { labReactions } from '../../course/lab.ts';
import { SchemeView } from './SchemeView.tsx';

export function ReactionLab({ smiles, onOpen }: { smiles: string; onOpen: (smiles: string) => void }) {
  const reactions = useMemo(() => labReactions(smiles), [smiles]);
  const [chosen, setChosen] = useState<string | undefined>();
  if (!reactions.length) return null;
  const current = reactions.find((r) => r.id === chosen) ?? reactions[0];
  return (
    <section className="lab" aria-labelledby="lab-title">
      <div className="lab-head">
        <h2 id="lab-title">Laboratório de reações</h2>
        <p>Escolha uma reação: o produto é calculado a partir da estrutura.</p>
      </div>
      <div className="lab-chips" role="tablist" aria-label="Reações possíveis">
        {reactions.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === current.id}
            className={r.id === current.id ? 'is-on' : ''}
            onClick={() => setChosen(r.id)}
          >
            {r.name}
          </button>
        ))}
      </div>
      <figure className="paper paper--scheme lab-result" role="tabpanel" aria-label={current.name}>
        <SchemeView key={`${smiles}-${current.id}`} scheme={current.scheme} animate />
        <figcaption>{current.note}</figcaption>
      </figure>
      {current.product && (
        <button type="button" className="btn" onClick={() => onOpen(current.product!.smiles)}>
          Abrir o produto no editor
        </button>
      )}
    </section>
  );
}
