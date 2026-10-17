import { useEffect, useRef, useState } from 'react';
import { COURSE, LESSON_BY_ID, LESSONS } from '../../course/course.ts';
import type { Lesson } from '../../course/types.ts';
import { ElementTile, type TileState } from '../components/ElementTile.tsx';
import { BoltIcon } from '../components/Icons.tsx';
import { navigate } from '../router.ts';
import { type Progress, dueLessons, nextReviewIn, useProgress } from '../store.ts';

const ROW = 112;
const SWING = 64;

export function PathScreen() {
  const progress = useProgress();
  const [open, setOpen] = useState<Lesson | null>(null);
  const playable = LESSONS.filter((l) => l.generate);
  const doneCount = playable.filter((l) => progress.completed[l.id]).length;
  const currentId = playable.find((l) => !progress.completed[l.id])?.id;

  const stateOf = (lesson: Lesson): TileState => {
    if (!lesson.generate) return 'soon';
    if (progress.completed[lesson.id]) return 'done';
    if (lesson.id === currentId) return 'current';
    return 'locked';
  };

  return (
    <div className="path-screen">
      <header className="track-head">
        <h1>Química orgânica</h1>
        <p>
          Do carbono às proteínas, no ritmo do ENEM. {doneCount} de {playable.length} lições concluídas.
        </p>
        <div className="track-meter" role="progressbar" aria-valuemin={0} aria-valuemax={playable.length} aria-valuenow={doneCount}>
          <span style={{ width: `${(doneCount / playable.length) * 100}%` }} />
        </div>
      </header>

      <ReviewCard progress={progress} />

      {COURSE.map((unit) => (
        <section key={unit.id} className="unit" aria-labelledby={`unit-${unit.id}`}>
          <div className="unit-head">
            <h2 id={`unit-${unit.id}`}>{unit.title}</h2>
            <p>{unit.description}</p>
          </div>
          <UnitChain lessons={unit.lessons} stateOf={stateOf} onSelect={setOpen} />
        </section>
      ))}

      {open && <LessonSheet lesson={open} state={stateOf(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Spaced review: lessons come back after 1, 2, 4, 8 and 16 days, sooner when they went badly. */
function ReviewCard({ progress }: { progress: Progress }) {
  const due = dueLessons(progress);
  const wait = nextReviewIn(progress);
  if (wait === undefined) return null;
  if (!due.length) {
    return (
      <p className="review-card review-card--idle">
        Revisão em dia: a próxima lição volta {wait <= 1 ? 'amanhã' : `em ${wait} dias`}.
      </p>
    );
  }
  const titles = due.slice(0, 4).map((d) => LESSON_BY_ID[d.id]?.title).filter(Boolean);
  return (
    <section className="review-card" aria-labelledby="review-title">
      <div>
        <h2 id="review-title">Revisão do dia</h2>
        <p>
          {titles.join(' · ')}
          {due.length > 4 ? ` e mais ${due.length - 4}` : ''}
        </p>
      </div>
      <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'review' })}>
        <BoltIcon /> Revisar
      </button>
    </section>
  );
}

/** Tiles sit on the vertices of a zig-zag chain, drawn like a skeletal formula. */
function UnitChain({
  lessons,
  stateOf,
  onSelect,
}: {
  lessons: Lesson[];
  stateOf: (l: Lesson) => TileState;
  onSelect: (l: Lesson) => void;
}) {
  const height = (lessons.length - 1) * ROW + 120;
  const xs = lessons.map((_, i) => (i % 2 === 0 ? -SWING : SWING));
  return (
    <div className="chain" style={{ height }}>
      <svg className="chain-bonds" viewBox={`-160 0 320 ${height}`} preserveAspectRatio="xMidYMin meet" aria-hidden="true">
        {lessons.slice(1).map((l, i) => {
          const done = stateOf(lessons[i]) === 'done' && stateOf(l) !== 'locked' && stateOf(l) !== 'soon';
          return (
            <line
              key={l.id}
              className={done ? 'bond bond--done' : 'bond'}
              x1={xs[i]}
              y1={i * ROW + 44}
              x2={xs[i + 1]}
              y2={(i + 1) * ROW + 44}
            />
          );
        })}
      </svg>
      {lessons.map((lesson, i) => {
        const state = stateOf(lesson);
        return (
          <div key={lesson.id} className={`chain-node chain-node--${i % 2 === 0 ? 'left' : 'right'}`} style={{ top: i * ROW }}>
            <ElementTile lesson={lesson} state={state} onSelect={() => onSelect(lesson)} />
            <span className={`chain-title chain-title--${state}`}>{lesson.title}</span>
          </div>
        );
      })}
    </div>
  );
}

function LessonSheet({ lesson, state, onClose }: { lesson: Lesson; state: TileState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  const start = () => navigate({ name: 'lesson', id: lesson.id });
  const playable = state === 'done' || state === 'current';
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="sheet-body">
        <ElementTile lesson={lesson} state={state} size="large" />
        <div className="sheet-text">
          <h3>{lesson.title}</h3>
          <p>{lesson.summary}</p>
          {state === 'locked' && <p className="sheet-note">Conclua a lição anterior para liberar esta.</p>}
          {state === 'soon' && <p className="sheet-note">Esta lição ainda está sendo escrita.</p>}
        </div>
      </div>
      <div className="sheet-actions">
        {playable && (
          <button type="button" className="btn btn--primary" onClick={start} autoFocus>
            {state === 'done' ? 'Praticar de novo' : 'Começar lição'}
          </button>
        )}
        {state === 'locked' && (
          <button type="button" className="btn btn--primary" onClick={start} autoFocus>
            Fazer mesmo assim
          </button>
        )}
        {!!lesson.theory?.length && state !== 'soon' && (
          <button type="button" className="btn" onClick={() => navigate({ name: 'theory', id: lesson.id })}>
            Ver teoria
          </button>
        )}
        <button type="button" className="btn btn--quiet" onClick={onClose} autoFocus={state === 'soon'}>
          Fechar
        </button>
      </div>
    </dialog>
  );
}
