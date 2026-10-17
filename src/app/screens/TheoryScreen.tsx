/** A lesson's theory as one page, to read again before an exam or a review. */
import { LESSON_BY_ID, LESSONS, unitOf } from '../../course/course.ts';
import { ElementTile } from '../components/ElementTile.tsx';
import { TheoryActions, TheoryCardView } from '../components/TheoryCardView.tsx';
import { href, navigate } from '../router.ts';
import { useProgress } from '../store.ts';

export function TheoryScreen({ id }: { id: string }) {
  const lesson = LESSON_BY_ID[id];
  const progress = useProgress();
  if (!lesson?.theory?.length) {
    return (
      <p className="paper-empty">
        Teoria não encontrada. <a href={href({ name: 'path' })}>Voltar para a trilha</a>
      </p>
    );
  }
  const unit = unitOf(id);
  const at = LESSONS.indexOf(lesson);
  const prev = LESSONS[at - 1];
  const next = LESSONS[at + 1];
  return (
    <div className="theory-page">
      <header className="theory-page-head">
        <ElementTile lesson={lesson} state={progress.completed[id] ? 'done' : 'current'} size="large" />
        <div>
          <p className="theory-kicker">{unit.title}</p>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>
      </header>
      {lesson.theory.map((card, i) => (
        <section key={i} className="theory-page-card">
          <TheoryCardView card={card} headingLevel={2} />
          <TheoryActions lessonId={id} index={i} card={card} />
        </section>
      ))}
      <div className="theory-page-actions">
        <button type="button" className="btn btn--primary btn--wide" onClick={() => navigate({ name: 'lesson', id })}>
          {progress.completed[id] ? 'Praticar de novo' : 'Começar lição'}
        </button>
        <nav className="theory-page-nav" aria-label="Outras lições">
          {prev ? <a href={href({ name: 'theory', id: prev.id })}>← {prev.title}</a> : <span />}
          {next && <a href={href({ name: 'theory', id: next.id })}>{next.title} →</a>}
        </nav>
      </div>
    </div>
  );
}
