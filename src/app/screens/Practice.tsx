/**
 * The exercise player shared by lessons and reviews: one question at a time, check,
 * explanation, and missed questions coming back at the end.
 */
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Answer, hasAnswer, isCorrect } from '../../course/answers.ts';
import type { ChoiceExercise, Exercise, MolSpec, PickStructureExercise, TapAtomsExercise } from '../../course/types.ts';
import { LESSON_BY_ID } from '../../course/course.ts';
import { saveToMap } from '../canvas-store.ts';
import { CheckIcon, CloseIcon, CrossIcon, HintIcon, PinIcon, TutorIcon } from '../components/Icons.tsx';
import { type AtomMark, MoleculeView } from '../components/MoleculeView.tsx';
import { SchemeView, SpecView, isWide } from '../components/SchemeView.tsx';
import { typingIn } from '../hooks.ts';
import { dismissSheet, haptic, useSheet } from '../mobile.ts';
import { type AttemptSource, recordAttempt } from '../store.ts';
import { ask } from '../tutor-store.ts';

export interface PracticeItem {
  key: string;
  lessonId: string;
  exercise: Exercise;
  retry?: boolean;
}

export interface PracticeResult {
  /** First-try accuracy over all questions. */
  accuracy: number;
  /** First-try accuracy per lesson (reviews mix several). */
  byLesson: Record<string, number>;
}

export function Practice({
  items,
  source,
  onExit,
  onFinish,
  label,
}: {
  items: PracticeItem[];
  /** Where the answers are logged as coming from. */
  source: AttemptSource;
  onExit: () => void;
  onFinish: (result: PracticeResult) => void;
  /** Shown above the prompt, e.g. the lesson a review question comes from. */
  label?: (item: PracticeItem) => string | undefined;
}) {
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [solved, setSolved] = useState(0);
  const [firstTry, setFirstTry] = useState<Record<string, number>>({});
  const [leaving, setLeaving] = useState(false);
  // One stray tap on the close button should not throw away a lesson half done.
  const exit = () => (solved > 0 || verdict !== null || index > 0 ? setLeaving(true) : onExit());
  const choose = useCallback((a: Answer) => {
    haptic('tap');
    setAnswer(a);
  }, []);

  const item = queue[index];
  const exercise = item?.exercise;
  const total = items.length;
  // When the current question appeared, for study time.
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [item?.key]);

  const check = useCallback(() => {
    if (!exercise || verdict !== null || !hasAnswer(answer)) return;
    const ok = isCorrect(exercise, answer);
    recordAttempt({ lesson: item.lessonId, kind: exercise.kind, ok, retry: item.retry, ms: Date.now() - shownAt.current, source });
    setVerdict(ok);
    haptic(ok ? 'success' : 'error');
    if (ok) {
      setSolved((s) => s + 1);
      if (!item.retry) setFirstTry((f) => ({ ...f, [item.lessonId]: (f[item.lessonId] ?? 0) + 1 }));
    } else {
      // Missed questions come back at the end.
      setQueue((q) => [...q, { ...item, key: `${item.key}r${q.length}`, retry: true }]);
    }
  }, [exercise, verdict, answer, item, source]);

  const next = useCallback(() => {
    if (verdict === null) return;
    if (index + 1 >= queue.length) {
      const counts: Record<string, number> = {};
      for (const it of items) counts[it.lessonId] = (counts[it.lessonId] ?? 0) + 1;
      const byLesson = Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, (firstTry[id] ?? 0) / n]));
      const right = Object.values(firstTry).reduce((s, n) => s + n, 0);
      onFinish({ accuracy: total ? right / total : 1, byLesson });
      return;
    }
    setIndex(index + 1);
    setAnswer(null);
    setVerdict(null);
    window.scrollTo({ top: 0 });
  }, [verdict, index, queue.length, items, firstTry, total, onFinish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement || typingIn(e)) return;
      if (verdict === null) check();
      else next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [verdict, check, next]);

  if (!item) return null;
  const tag = label?.(item);

  return (
    <div className="lesson">
      <header className="lesson-bar">
        <button type="button" className="icon-btn" onClick={exit} aria-label="Sair">
          <CloseIcon />
        </button>
        <div className="lesson-meter" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={total} aria-valuenow={solved}>
          <span style={{ width: `${(solved / total) * 100}%` }} />
        </div>
        <span className="lesson-count">
          {Math.min(solved + (verdict === null ? 1 : 0), total)}/{total}
        </span>
      </header>

      <main className="lesson-main" key={item.key}>
        {(item.retry || tag) && (
          <p className="lesson-retry">
            {item.retry ? 'Vamos rever esta.' : ''}
            {item.retry && tag ? ' · ' : ''}
            {tag && <span className="lesson-from">{tag}</span>}
          </p>
        )}
        <h1 className="lesson-prompt">{exercise.prompt}</h1>
        {exercise.kind === 'choice' && (
          <ChoiceView exercise={exercise} answer={answer as number | null} onAnswer={choose} verdict={verdict} />
        )}
        {exercise.kind === 'pick' && (
          <PickView exercise={exercise} answer={answer as number | null} onAnswer={choose} verdict={verdict} />
        )}
        {exercise.kind === 'tap' && (
          <TapView exercise={exercise} answer={(answer as number[] | null) ?? []} onAnswer={choose} verdict={verdict} />
        )}
      </main>

      <footer className={`lesson-foot${verdict === null ? '' : verdict ? ' lesson-foot--right' : ' lesson-foot--wrong'}`}>
        {verdict === null ? (
          <div className="lesson-foot-inner">
            {exercise.kind === 'tap' && <p className="lesson-hint">Toque nos átomos para marcar. Toque de novo para desmarcar.</p>}
            <div className="lesson-foot-row">
              <button
                type="button"
                className="btn btn--tutor"
                onClick={() => ask({ text: 'Me dá uma dica, sem entregar a resposta?', screen: { kind: 'question', lessonId: item.lessonId, exercise }, about: aboutQuestion(item), open: true })}
              >
                <HintIcon /> Dica
              </button>
              <button type="button" className="btn btn--primary btn--wide" disabled={!hasAnswer(answer)} onClick={check}>
                Verificar
              </button>
            </div>
          </div>
        ) : (
          <div className="lesson-foot-inner" role="status" aria-live="polite">
            <div className="verdict">
              <span className="verdict-icon">{verdict ? <CheckIcon /> : <CrossIcon />}</span>
              <div>
                <p className="verdict-title">{verdict ? 'Correto' : correctAnswerText(exercise)}</p>
                <p className="verdict-explain">{exercise.explain}</p>
                <div className="verdict-actions">
                  <button
                    type="button"
                    className="link-btn link-btn--tutor"
                    onClick={() =>
                      ask({
                        text: verdict ? 'Por que essa é a resposta certa? Quero entender o raciocínio.' : 'Por que eu errei? Me explica o raciocínio certo.',
                        screen: { kind: 'question', lessonId: item.lessonId, exercise, chosen: answer ?? undefined, correct: verdict },
                        about: aboutQuestion(item),
                        open: true,
                      })
                    }
                  >
                    <TutorIcon width={18} height={18} /> {verdict ? 'Entender melhor' : 'Por que errei?'}
                  </button>
                  <button type="button" className="link-btn" onClick={() => saveQuestion(item)}>
                    <PinIcon width={18} height={18} /> Salvar no mapa
                  </button>
                </div>
              </div>
            </div>
            <button type="button" className="btn btn--primary btn--wide" onClick={next} autoFocus>
              Continuar
            </button>
          </div>
        )}
      </footer>
      {leaving && <LeaveSheet onStay={() => setLeaving(false)} onLeave={onExit} />}
    </div>
  );
}

function LeaveSheet({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const ref = useSheet();
  return (
    <dialog ref={ref} className="sheet leave-sheet" onClose={onStay} aria-labelledby="leave-title">
      <h2 id="leave-title">Sair agora?</h2>
      <p>O que você respondeu até aqui conta para o seu progresso, mas a lição só fica concluída quando você chega ao fim.</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn--primary" onClick={() => dismissSheet(ref.current)} autoFocus>
          Continuar estudando
        </button>
        <button type="button" className="btn btn--quiet btn--danger" onClick={onLeave}>
          Sair da lição
        </button>
      </div>
    </dialog>
  );
}

const aboutQuestion = (item: PracticeItem) => `Questão de ${LESSON_BY_ID[item.lessonId]?.title ?? 'química'}`;

/** A question worth keeping goes to the concept map with its answer and explanation. */
function saveQuestion(item: PracticeItem) {
  const ex = item.exercise;
  const answer =
    ex.kind === 'choice' ? `**${ex.options[ex.answer]}**` : ex.kind === 'pick' ? 'a estrutura desenhada no cartão' : `átomos ${ex.answer.map((a) => a + 1).join(', ')}`;
  saveToMap({
    kind: 'question',
    title: ex.prompt,
    text: `Resposta: ${answer}\n\n${ex.explain}`,
    smiles: ex.kind === 'pick' ? ex.options[ex.answer].smiles : ex.molecule?.smiles,
    lessonId: item.lessonId,
  });
}

function correctAnswerText(ex: Exercise): string {
  if (ex.kind === 'choice') return `Resposta correta: ${ex.options[ex.answer]}`;
  if (ex.kind === 'pick') return 'A estrutura correta está marcada';
  return 'Os átomos certos estão marcados';
}

/** The question's structure or reaction, on paper. */
function Prompt({ molecule, scheme, size }: { molecule?: MolSpec; scheme?: ChoiceExercise['scheme']; size: number }) {
  return (
    <>
      {scheme && (
        <figure className="paper paper--prompt paper--scheme">
          <SchemeView scheme={scheme} animate />
        </figure>
      )}
      {molecule && (
        <figure className="paper paper--prompt">
          <SpecView spec={molecule} size={molecule.polymer ? 30 : size} animate />
        </figure>
      )}
    </>
  );
}

function ChoiceView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: ChoiceExercise;
  answer: number | null;
  onAnswer: (n: number) => void;
  verdict: boolean | null;
}) {
  const locked = verdict !== null;
  useNumberKeys(exercise.options.length, locked, onAnswer);
  // Short answers (numbers, cis/trans, Sim/Não, reagents) sit side by side.
  const row =
    (exercise.options.length === 2 && exercise.options.every((o) => o.length <= 22)) ||
    (exercise.options.length <= 4 && exercise.options.every((o) => o.length <= 4));
  return (
    <>
      <Prompt molecule={exercise.molecule} scheme={exercise.scheme} size={44} />
      <div
        className={`options${row ? ' options--row' : ''}`}
        style={row ? ({ '--cols': exercise.options.length } as CSSProperties) : undefined}
        role="radiogroup"
        aria-label="Alternativas"
      >
        {exercise.options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={answer === i}
            disabled={locked}
            className={optionClass(i, answer, exercise.answer, verdict)}
            onClick={() => onAnswer(i)}
          >
            <span className="option-key" aria-hidden="true">
              {i + 1}
            </span>
            <span className="option-text">{opt}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PickView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: PickStructureExercise;
  answer: number | null;
  onAnswer: (n: number) => void;
  verdict: boolean | null;
}) {
  const locked = verdict !== null;
  useNumberKeys(exercise.options.length, locked, onAnswer);
  const wide = useMemo(() => exercise.options.some((o) => isWide(o)), [exercise]);
  return (
    <>
      <Prompt molecule={exercise.molecule} scheme={exercise.scheme} size={40} />
      <div className={`picks${wide ? ' picks--wide' : ''}`} role="radiogroup" aria-label="Estruturas">
        {exercise.options.map((opt, i) => (
          <button
            key={`${opt.smiles}-${opt.formula ?? ''}`}
            type="button"
            role="radio"
            aria-checked={answer === i}
            aria-label={`Estrutura ${i + 1}`}
            disabled={locked}
            className={`paper pick ${optionClass(i, answer, exercise.answer, verdict)}`}
            onClick={() => onAnswer(i)}
          >
            <span className="option-key" aria-hidden="true">
              {i + 1}
            </span>
            <MoleculeView smiles={opt.smiles} formula={opt.formula} polymer={opt.polymer} size={28} />
          </button>
        ))}
      </div>
    </>
  );
}

function TapView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: TapAtomsExercise;
  answer: number[];
  onAnswer: (a: number[]) => void;
  verdict: boolean | null;
}) {
  const toggle = (atom: number) => {
    if (verdict !== null) return;
    onAnswer(answer.includes(atom) ? answer.filter((a) => a !== atom) : [...answer, atom]);
  };
  const marks: Record<number, AtomMark> = {};
  if (verdict === null) {
    for (const a of answer) marks[a] = 'selected';
  } else {
    for (const a of answer) marks[a] = exercise.answer.includes(a) ? 'correct' : 'wrong';
    for (const a of exercise.answer) if (!answer.includes(a)) marks[a] = 'missed';
  }
  return (
    <figure className="paper paper--prompt paper--tap">
      <MoleculeView
        smiles={exercise.molecule.smiles}
        formula={exercise.molecule.formula}
        polymer={exercise.molecule.polymer}
        size={52}
        animate
        tappable={exercise.tappable}
        marks={marks}
        onAtomTap={toggle}
      />
    </figure>
  );
}

function optionClass(i: number, answer: number | null, correct: number, verdict: boolean | null): string {
  const classes = ['option'];
  if (answer === i) classes.push('option--chosen');
  if (verdict !== null) {
    if (i === correct) classes.push('option--right');
    else if (answer === i) classes.push('option--wrong');
  }
  return classes.join(' ');
}

function useNumberKeys(count: number, locked: boolean, onAnswer: (n: number) => void) {
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e)) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) onAnswer(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, locked, onAnswer]);
}
