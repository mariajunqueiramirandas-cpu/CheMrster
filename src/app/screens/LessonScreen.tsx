import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { LESSON_BY_ID, unitOf } from '../../course/course.ts';
import { createRng } from '../../course/random.ts';
import type { ChoiceExercise, Exercise, PickStructureExercise, TapAtomsExercise } from '../../course/types.ts';
import { ElementTile } from '../components/ElementTile.tsx';
import { BoltIcon, CheckIcon, CloseIcon, CrossIcon, FlameIcon } from '../components/Icons.tsx';
import { type AtomMark, MoleculeView } from '../components/MoleculeView.tsx';
import { navigate } from '../router.ts';
import { currentStreak, recordLesson, useProgress } from '../store.ts';

type Answer = number | number[] | null;

interface Item {
  key: string;
  exercise: Exercise;
  retry: boolean;
}

const XP_BASE = 10;
const XP_PERFECT = 5;

export function LessonScreen({ id }: { id: string }) {
  const lesson = LESSON_BY_ID[id];
  const [seed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const initial = useMemo<Item[]>(
    () => (lesson?.generate?.(createRng(seed)) ?? []).map((exercise, i) => ({ key: `q${i}`, exercise, retry: false })),
    [lesson, seed],
  );
  const [queue, setQueue] = useState(initial);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [solved, setSolved] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [finished, setFinished] = useState<null | { accuracy: number; xp: number }>(null);

  const item = queue[index];
  const exercise = item?.exercise;

  const check = useCallback(() => {
    if (!exercise || verdict !== null || !hasAnswer(answer)) return;
    const ok = isCorrect(exercise, answer);
    setVerdict(ok);
    if (ok) {
      setSolved((s) => s + 1);
      if (!item.retry) setFirstTry((n) => n + 1);
    } else {
      // Missed questions come back at the end of the lesson.
      setQueue((q) => [...q, { key: `${item.key}r${q.length}`, exercise, retry: true }]);
    }
  }, [exercise, verdict, answer, item]);

  const next = useCallback(() => {
    if (verdict === null) return;
    if (index + 1 >= queue.length) {
      const accuracy = initial.length ? firstTry / initial.length : 1;
      const xp = XP_BASE + (accuracy === 1 ? XP_PERFECT : 0);
      recordLesson(id, accuracy, xp);
      setFinished({ accuracy, xp });
      return;
    }
    setIndex(index + 1);
    setAnswer(null);
    setVerdict(null);
  }, [verdict, index, queue.length, initial.length, firstTry, id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
      if (verdict === null) check();
      else next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [verdict, check, next]);

  if (!lesson?.generate) {
    return (
      <div className="lesson-missing">
        <p>Esta lição ainda não está disponível.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'path' })}>
          Voltar para a trilha
        </button>
      </div>
    );
  }

  if (finished) return <LessonDone lessonId={id} accuracy={finished.accuracy} xp={finished.xp} />;

  return (
    <div className="lesson">
      <header className="lesson-bar">
        <button type="button" className="icon-btn" onClick={() => navigate({ name: 'path' })} aria-label="Sair da lição">
          <CloseIcon />
        </button>
        <div
          className="lesson-meter"
          role="progressbar"
          aria-label="Progresso da lição"
          aria-valuemin={0}
          aria-valuemax={initial.length}
          aria-valuenow={solved}
        >
          <span style={{ width: `${(solved / initial.length) * 100}%` }} />
        </div>
        <span className="lesson-count">
          {Math.min(solved + (verdict === null ? 1 : 0), initial.length)}/{initial.length}
        </span>
      </header>

      <main className="lesson-main" key={item.key}>
        {item.retry && <p className="lesson-retry">Vamos rever esta.</p>}
        <h1 className="lesson-prompt">{exercise.prompt}</h1>
        {exercise.kind === 'choice' && (
          <ChoiceView exercise={exercise} answer={answer as number | null} onAnswer={setAnswer} verdict={verdict} />
        )}
        {exercise.kind === 'pick' && (
          <PickView exercise={exercise} answer={answer as number | null} onAnswer={setAnswer} verdict={verdict} />
        )}
        {exercise.kind === 'tap' && (
          <TapView exercise={exercise} answer={(answer as number[] | null) ?? []} onAnswer={setAnswer} verdict={verdict} />
        )}
      </main>

      <footer className={`lesson-foot${verdict === null ? '' : verdict ? ' lesson-foot--right' : ' lesson-foot--wrong'}`}>
        {verdict === null ? (
          <div className="lesson-foot-inner">
            {exercise.kind === 'tap' && <p className="lesson-hint">Toque nos átomos para marcar. Toque de novo para desmarcar.</p>}
            <button type="button" className="btn btn--primary btn--wide" disabled={!hasAnswer(answer)} onClick={check}>
              Verificar
            </button>
          </div>
        ) : (
          <div className="lesson-foot-inner" role="status" aria-live="polite">
            <div className="verdict">
              <span className="verdict-icon">{verdict ? <CheckIcon /> : <CrossIcon />}</span>
              <div>
                <p className="verdict-title">{verdict ? 'Correto' : correctAnswerText(exercise)}</p>
                <p className="verdict-explain">{exercise.explain}</p>
              </div>
            </div>
            <button type="button" className="btn btn--primary btn--wide" onClick={next} autoFocus>
              Continuar
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function hasAnswer(answer: Answer): boolean {
  return Array.isArray(answer) ? answer.length > 0 : answer !== null;
}

function isCorrect(ex: Exercise, answer: Answer): boolean {
  if (ex.kind === 'tap') {
    const picked = [...((answer as number[]) ?? [])].sort((a, b) => a - b);
    return picked.length === ex.answer.length && picked.every((a, i) => a === ex.answer[i]);
  }
  return answer === ex.answer;
}

function correctAnswerText(ex: Exercise): string {
  if (ex.kind === 'choice') return `Resposta correta: ${ex.options[ex.answer]}`;
  if (ex.kind === 'pick') return 'A estrutura correta está marcada';
  return 'Os átomos certos estão marcados';
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
  // Short answers (numbers, cis/trans, Sim/Não) sit side by side.
  const row =
    (exercise.options.length === 2 && exercise.options.every((o) => o.length <= 12)) ||
    (exercise.options.length <= 4 && exercise.options.every((o) => o.length <= 4));
  return (
    <>
      {exercise.molecule && (
        <figure className="paper paper--prompt">
          <MoleculeView
            smiles={exercise.molecule.smiles}
            formula={exercise.molecule.formula}
            outline={exercise.molecule.highlight}
            caption={exercise.molecule.caption}
            source={exercise.molecule.source}
            size={44}
            animate
          />
        </figure>
      )}
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
  return (
    <>
      {exercise.molecule && (
        <figure className="paper paper--prompt">
          <MoleculeView smiles={exercise.molecule.smiles} formula={exercise.molecule.formula} size={40} animate />
        </figure>
      )}
      <div
        className={`picks${exercise.options.some((o) => o.formula && o.formula !== 'skeletal') ? ' picks--wide' : ''}`}
        role="radiogroup"
        aria-label="Estruturas"
      >
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
            <MoleculeView smiles={opt.smiles} formula={opt.formula} size={28} />
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
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) onAnswer(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, locked, onAnswer]);
}

function LessonDone({ lessonId, accuracy, xp }: { lessonId: string; accuracy: number; xp: number }) {
  const lesson = LESSON_BY_ID[lessonId];
  const progress = useProgress();
  const unit = unitOf(lessonId);
  const streak = currentStreak(progress);
  return (
    <div className="done">
      <ElementTile lesson={lesson} state="done" size="large" />
      <h1>Lição concluída</h1>
      <p className="done-sub">
        {lesson.title}, em {unit.title.toLowerCase()}.
      </p>
      <dl className="done-stats">
        <div>
          <dt>
            <BoltIcon /> XP ganho
          </dt>
          <dd>+{xp}</dd>
        </div>
        <div>
          <dt>
            <CheckIcon /> Acertos de primeira
          </dt>
          <dd>{Math.round(accuracy * 100)}%</dd>
        </div>
        <div>
          <dt>
            <FlameIcon /> Dias seguidos
          </dt>
          <dd>{streak}</dd>
        </div>
      </dl>
      <button type="button" className="btn btn--primary btn--wide" onClick={() => navigate({ name: 'path' })} autoFocus>
        Continuar
      </button>
    </div>
  );
}
