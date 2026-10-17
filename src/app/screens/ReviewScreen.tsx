/** Daily review: questions from every lesson whose review date has come, mixed together. */
import { useMemo, useState } from 'react';
import { LESSON_BY_ID } from '../../course/course.ts';
import { createRng } from '../../course/random.ts';
import { buildReview } from '../../course/review.ts';
import { ElementTile } from '../components/ElementTile.tsx';
import { BoltIcon } from '../components/Icons.tsx';
import { syncAfterPractice } from '../board-store.ts';
import { navigate } from '../router.ts';
import { INTERVALS, dueLessons, recordReview, useProgress } from '../store.ts';
import { Practice, type PracticeItem, type PracticeResult } from './Practice.tsx';

const XP_PER_LESSON = 4;

export function ReviewScreen() {
  const progress = useProgress();
  // The deck is fixed when the review starts; finishing it moves the lessons out of "due".
  const [deck] = useState(() => dueLessons(progress).map((d) => d.id));
  const [seed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const items = useMemo<PracticeItem[]>(
    () => buildReview(createRng(seed), deck).map((it, i) => ({ key: `r${i}`, lessonId: it.lessonId, exercise: it.exercise })),
    [deck, seed],
  );
  const [result, setResult] = useState<PracticeResult | null>(null);
  const exit = () => navigate({ name: 'path' });

  if (!items.length) {
    return (
      <div className="lesson-missing">
        <p>Nada para revisar hoje. Conclua lições na trilha e elas voltam aqui no tempo certo.</p>
        <button type="button" className="btn btn--primary" onClick={exit}>
          Voltar para a trilha
        </button>
      </div>
    );
  }

  if (result) return <ReviewDone result={result} />;

  return (
    <Practice
      items={items}
      source="review"
      onExit={exit}
      label={(item) => LESSON_BY_ID[item.lessonId]?.title}
      onFinish={(r) => {
        recordReview(r.byLesson, XP_PER_LESSON * Object.keys(r.byLesson).length);
        syncAfterPractice(Object.keys(r.byLesson));
        setResult(r);
      }}
    />
  );
}

/** Same thresholds as the Leitner boxes: up a box, stay, or back to the start. */
const scoreLevel = (accuracy: number) => (accuracy >= 0.85 ? 'up' : accuracy >= 0.6 ? 'stay' : 'down');

function ReviewDone({ result }: { result: PracticeResult }) {
  const progress = useProgress();
  const ids = Object.keys(result.byLesson);
  return (
    <div className="done">
      <h1>Revisão feita</h1>
      <p className="done-sub">
        {Math.round(result.accuracy * 100)}% de acertos de primeira em {ids.length === 1 ? '1 lição' : `${ids.length} lições`}.
      </p>
      <ul className="review-results">
        {ids.map((id) => {
          const lesson = LESSON_BY_ID[id];
          const days = INTERVALS[progress.completed[id]?.box ?? 1];
          return (
            <li key={id}>
              <ElementTile lesson={lesson} state="done" />
              <span className="review-results-title">{lesson.title}</span>
              <span className="review-results-next">
                <span className={`review-score review-score--${scoreLevel(result.byLesson[id])}`}>
                  {Math.round(result.byLesson[id] * 100)}%
                </span>{' '}
                · volta {days === 1 ? 'amanhã' : `em ${days} dias`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="done-next">
        <BoltIcon /> +{XP_PER_LESSON * ids.length} XP. Acertou, o intervalo dobra; errou, a lição volta logo.
      </p>
      <button type="button" className="btn btn--primary btn--wide" onClick={() => navigate({ name: 'path' })} autoFocus>
        Continuar
      </button>
    </div>
  );
}
