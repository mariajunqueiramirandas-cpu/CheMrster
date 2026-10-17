/**
 * Reaction schemes the way textbooks print them: structures and formulas joined by "+",
 * an arrow with reagents over it and conditions under it, and a dashed "?" for the unknown.
 */
import { readableFormula } from '../../course/kit.ts';
import type { MolSpec, Scheme, Term } from '../../course/types.ts';
import { depict } from '../../nanquim/index.ts';
import { type AtomMark, MoleculeView } from './MoleculeView.tsx';

/** Long chains (and, for answer tiles, written-out formulas) need a full row to stay legible. */
export function isWide(spec: MolSpec, { formulas = true } = {}): boolean {
  if (formulas && spec.formula && spec.formula !== 'skeletal') return true;
  const { viewBox } = depict(spec.smiles, { formula: spec.formula, polymer: spec.polymer, conventions: 'enem', style: 'enem' });
  return viewBox.width / viewBox.height > 2.4;
}

/** A MolSpec drawn with the ENEM look. */
export function SpecView({
  spec,
  size = 30,
  animate,
  marks,
}: {
  spec: MolSpec;
  size?: number;
  animate?: boolean;
  marks?: number[];
}) {
  const atomMarks = marks?.length ? Object.fromEntries(marks.map((a) => [a, 'selected' as AtomMark])) : undefined;
  return (
    <MoleculeView
      smiles={spec.smiles}
      formula={spec.formula ?? (spec.polymer ? undefined : readableFormula(spec.smiles))}
      polymer={spec.polymer}
      outline={spec.highlight}
      caption={spec.caption}
      source={spec.source}
      size={size}
      animate={animate}
      marks={atomMarks}
      title={spec.name ?? spec.caption}
    />
  );
}

const termText = (t: Term) => ('mol' in t ? (t.mol.name ?? t.mol.caption ?? 'estrutura') : 'text' in t ? t.text : 'substância desconhecida');

/** "propeno + HBr → ?" for screen readers. */
export function describeScheme(s: Scheme): string {
  const side = (terms: Term[]) => terms.map((t) => `${t.coef ? `${t.coef} ` : ''}${termText(t)}`).join(' + ');
  const cond = [s.over, s.under].filter(Boolean).join(', ');
  return `Reação: ${side(s.left)} ${s.reversible ? 'em equilíbrio com' : 'forma'} ${side(s.right)}${cond ? ` (${cond})` : ''}`;
}

function TermView({ term, size, animate }: { term: Term; size: number; animate?: boolean }) {
  const coef = term.coef ? <span className="scheme-coef">{term.coef}</span> : null;
  if ('mol' in term) {
    return (
      <span className="scheme-term">
        {coef}
        <SpecView spec={term.mol} size={size} animate={animate} />
      </span>
    );
  }
  if ('text' in term) {
    return (
      <span className="scheme-term scheme-term--text">
        {coef}
        {term.text}
      </span>
    );
  }
  return (
    <span className="scheme-term">
      {coef}
      <span className="scheme-unknown">?</span>
    </span>
  );
}

function Arrow({ over, under, reversible }: { over?: string; under?: string; reversible?: boolean }) {
  const label = Math.max(over?.length ?? 0, under?.length ?? 0);
  const w = Math.max(54, Math.round(label * 7.4 + 18));
  return (
    <span className="scheme-arrow">
      <span className="scheme-cond">{over ?? ''}</span>
      <svg width={w} height="14" viewBox={`0 0 ${w} 14`} aria-hidden="true">
        {reversible ? (
          <>
            <path d={`M2 4.5H${w - 3}L${w - 10} 0.8`} />
            <path d={`M${w - 2} 9.5H3L10 13.2`} />
          </>
        ) : (
          <path d={`M2 7H${w - 3}M${w - 10} 2.6L${w - 2.5} 7L${w - 10} 11.4`} />
        )}
      </svg>
      <span className="scheme-cond">{under ?? ''}</span>
    </span>
  );
}

export function SchemeView({ scheme, size = 26, animate }: { scheme: Scheme; size?: number; animate?: boolean }) {
  const side = (terms: Term[], key: string) =>
    terms.map((t, i) => (
      <span key={`${key}${i}`} className="scheme-slot">
        {i > 0 && <span className="scheme-plus">+</span>}
        <TermView term={t} size={size} animate={animate} />
      </span>
    ));
  // The arrow travels with the products, so a wrapped scheme breaks before the arrow.
  return (
    <div className="scheme" role="img" aria-label={describeScheme(scheme)}>
      <span className="scheme-side">{side(scheme.left, 'l')}</span>
      <span className="scheme-side">
        <Arrow over={scheme.over} under={scheme.under} reversible={scheme.reversible} />
        {side(scheme.right, 'r')}
      </span>
    </div>
  );
}
