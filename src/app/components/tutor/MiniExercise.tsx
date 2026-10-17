/** A question the tutor put in the chat, answered right there. */
import { useState } from 'react';
import { LESSON_BY_ID } from '../../../course/course.ts';
import type { Exercise } from '../../../course/types.ts';
import type { Part } from '../../../tutor/types.ts';
import { CheckIcon, CrossIcon } from '../Icons.tsx';
import { type AtomMark, MoleculeView } from '../MoleculeView.tsx';
import { SchemeView, SpecView } from '../SchemeView.tsx';

type ExercisePart = Extract<Part, { type: 'exercise' }>;

function optionState(i: number, ex: Exercise, answer: ExercisePart['answer']): string {
  if (answer === undefined || ex.kind === 'tap') return '';
  if (i === ex.answer) return ' option--right';
  if (answer === i) return ' option--wrong';
  return '';
}

export function MiniExercise({ part, onAnswer, disabled }: { part: ExercisePart; onAnswer: (answer: number | number[]) => void; disabled?: boolean }) {
  const { exercise: ex, answer } = part;
  const [atoms, setAtoms] = useState<number[]>([]);
  const lesson = LESSON_BY_ID[part.lessonId];
  const locked = answer !== undefined || disabled;

  let marks: Record<number, AtomMark> | undefined;
  if (ex.kind === 'tap') {
    marks = {};
    if (answer === undefined) for (const a of atoms) marks[a] = 'selected';
    else {
      const picked = answer as number[];
      for (const a of picked) marks[a] = ex.answer.includes(a) ? 'correct' : 'wrong';
      for (const a of ex.answer) if (!picked.includes(a)) marks[a] = 'missed';
    }
  }

  return (
    <section className={`mini-ex${answer === undefined ? '' : part.correct ? ' mini-ex--right' : ' mini-ex--wrong'}`} aria-label="Questão do tutor">
      <p className="mini-ex-kicker">
        <span className="mini-ex-tile" aria-hidden="true">
          {lesson?.element.symbol}
        </span>
        Questão de {lesson?.title ?? 'química'}
      </p>
      <p className="mini-ex-prompt">{ex.prompt}</p>
      {ex.kind !== 'tap' && ex.scheme && (
        <figure className="paper paper--scheme mini-ex-figure">
          <SchemeView scheme={ex.scheme} size={20} />
        </figure>
      )}
      {ex.kind !== 'tap' && ex.molecule && (
        <figure className="paper mini-ex-figure">
          <SpecView spec={ex.molecule} size={ex.molecule.polymer ? 22 : 28} />
        </figure>
      )}
      {ex.kind === 'tap' && (
        <figure className="paper mini-ex-figure mini-ex-figure--tap">
          <MoleculeView
            smiles={ex.molecule.smiles}
            formula={ex.molecule.formula}
            polymer={ex.molecule.polymer}
            size={34}
            tappable={ex.tappable}
            marks={marks}
            onAtomTap={(a) => !locked && setAtoms((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
          />
        </figure>
      )}

      {ex.kind === 'choice' && (
        <div className="mini-ex-options" role="group" aria-label="Alternativas">
          {ex.options.map((opt, i) => (
            <button key={opt} type="button" className={`option${answer === i ? ' option--chosen' : ''}${optionState(i, ex, answer)}`} disabled={locked} onClick={() => onAnswer(i)}>
              <span className="option-key" aria-hidden="true">
                {i + 1}
              </span>
              <span className="option-text">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {ex.kind === 'pick' && (
        <div className="mini-ex-picks" role="group" aria-label="Estruturas">
          {ex.options.map((opt, i) => (
            <button
              key={`${opt.smiles}-${i}`}
              type="button"
              className={`paper pick option${answer === i ? ' option--chosen' : ''}${optionState(i, ex, answer)}`}
              aria-label={`Estrutura ${i + 1}`}
              disabled={locked}
              onClick={() => onAnswer(i)}
            >
              <span className="option-key" aria-hidden="true">
                {i + 1}
              </span>
              <MoleculeView smiles={opt.smiles} formula={opt.formula} polymer={opt.polymer} size={20} />
            </button>
          ))}
        </div>
      )}

      {ex.kind === 'tap' && answer === undefined && (
        <button type="button" className="btn btn--primary mini-ex-check" disabled={!atoms.length || disabled} onClick={() => onAnswer([...atoms].sort((a, b) => a - b))}>
          Verificar
        </button>
      )}

      {answer !== undefined && (
        <p className="mini-ex-verdict" role="status">
          <span className="mini-ex-verdict-icon">{part.correct ? <CheckIcon width={16} height={16} /> : <CrossIcon width={16} height={16} />}</span>
          {part.correct ? 'Correto' : ex.kind === 'tap' ? 'Os átomos certos estão marcados' : 'A resposta certa está marcada'}
        </p>
      )}
    </section>
  );
}
