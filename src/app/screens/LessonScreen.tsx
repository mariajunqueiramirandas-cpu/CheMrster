import { useEffect, useMemo, useRef, useState } from 'react';
import { LESSON_BY_ID, unitOf } from '../../course/course.ts';
import { createRng } from '../../course/random.ts';
import type { TheoryCard } from '../../course/types.ts';
import { ElementTile } from '../components/ElementTile.tsx';
import { BoltIcon, CheckIcon, CloseIcon, FlameIcon } from '../components/Icons.tsx';
import { TheoryActions, TheoryCardView } from '../components/TheoryCardView.tsx';
import { syncAfterPractice } from '../board-store.ts';
import { typingIn } from '../hooks.ts';
import { navigate } from '../router.ts';
import { INTERVALS, currentStreak, recordLesson, recordStudyTime, useProgress } from '../store.ts';
import { Practice, type PracticeItem } from './Practice.tsx';

const XP_BASE = 10;
const XP_PERFECT = 5;

export function LessonScreen({ id }: { id: string }) {
  const lesson = LESSON_BY_ID[id];
  const [seed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const items = useMemo<PracticeItem[]>(
    () => (lesson?.generate?.(createRng(seed)) ?? []).map((exercise, i) => ({ key: `q${i}`, lessonId: id, exercise })),
    [lesson, seed, id],
  );
  const [phase, setPhase] = useState<'theory' | 'practice'>(lesson?.theory?.length ? 'theory' : 'practice');
  const [finished, setFinished] = useState<null | { accuracy: number; xp: number }>(null);
  const exit = () => navigate({ name: 'path' });

  if (!lesson?.generate) {
    return (
      <div className="lesson-missing">
        <p>Esta lição ainda não está disponível.</p>
        <button type="button" className="btn btn--primary" onClick={exit}>
          Voltar para a trilha
        </button>
      </div>
    );
  }

  if (finished) return <LessonDone lessonId={id} accuracy={finished.accuracy} xp={finished.xp} />;

  if (phase === 'theory') return <TheoryPhase lessonId={id} cards={lesson.theory!} onDone={() => setPhase('practice')} onExit={exit} />;

  return (
    <Practice
      items={items}
      source="lesson"
      onExit={exit}
      onFinish={({ accuracy }) => {
        const xp = XP_BASE + (accuracy === 1 ? XP_PERFECT : 0);
        recordLesson(id, accuracy, xp);
        syncAfterPractice([id]);
        setFinished({ accuracy, xp });
      }}
    />
  );
}

/** Teach first: the lesson's cards one at a time, then the exercises. */
function TheoryPhase({ lessonId, cards, onDone, onExit }: { lessonId: string; cards: TheoryCard[]; onDone: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const last = index === cards.length - 1;
  const shownAt = useRef(Date.now());

  useEffect(() => {
    window.scrollTo({ top: 0 });
    shownAt.current = Date.now();
    // Reading a card counts as study time when the learner moves on.
    return () => recordStudyTime(Date.now() - shownAt.current);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement || typingIn(e)) return;
      if (last) onDone();
      else setIndex((i) => i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onDone]);

  return (
    <div className="lesson lesson--theory">
      <header className="lesson-bar">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Sair da lição">
          <CloseIcon />
        </button>
        <div
          className="lesson-meter lesson-meter--theory"
          role="progressbar"
          aria-label="Teoria"
          aria-valuemin={0}
          aria-valuemax={cards.length}
          aria-valuenow={index + 1}
        >
          <span style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
        </div>
        <button type="button" className="lesson-skip" onClick={onDone} aria-label="Pular a teoria e ir para os exercícios">
          Pular
        </button>
      </header>

      <main className="lesson-main" key={index}>
        <p className="theory-kicker">
          Teoria · {index + 1} de {cards.length}
        </p>
        <TheoryCardView card={cards[index]} animate />
        <TheoryActions lessonId={lessonId} index={index} card={cards[index]} />
      </main>

      <footer className="lesson-foot">
        <div className={`lesson-foot-inner${index > 0 ? ' lesson-foot-inner--pair' : ''}`}>
          {index > 0 && (
            <button type="button" className="btn" onClick={() => setIndex(index - 1)}>
              Voltar
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary btn--wide"
            onClick={() => (last ? onDone() : setIndex(index + 1))}
            autoFocus
          >
            {last ? 'Praticar' : 'Continuar'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function LessonDone({ lessonId, accuracy, xp }: { lessonId: string; accuracy: number; xp: number }) {
  const lesson = LESSON_BY_ID[lessonId];
  const progress = useProgress();
  const unit = unitOf(lessonId);
  const streak = currentStreak(progress);
  const box = progress.completed[lessonId]?.box ?? 1;
  const days = INTERVALS[box];
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
      <p className="done-next">
        Esta lição volta na revisão {days === 1 ? 'amanhã' : `daqui a ${days} dias`}: relembrar no tempo certo fixa o conteúdo.
      </p>
      <button type="button" className="btn btn--primary btn--wide" onClick={() => navigate({ name: 'path' })} autoFocus>
        Continuar
      </button>
    </div>
  );
}
