/** The tutor's side panel: opens over any screen, lessons included, on the conversation at hand. */
import { useEffect, useRef } from 'react';
import { closeTutor, showThread, useTutorData, useTutorPanel } from '../../tutor-store.ts';
import { CloseIcon, HistoryIcon, PlusIcon, TutorIcon } from '../Icons.tsx';
import { ConnectionPill, TutorChat, openThreadPage } from './TutorChat.tsx';

export function TutorPanel() {
  const { open, threadId } = useTutorPanel();
  const data = useTutorData();
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  // On wide screens the panel docks: the page makes room instead of being covered.
  useEffect(() => {
    document.documentElement.classList.toggle('tutor-open', open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTutor();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Back to where the learner was.
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  if (!open) return null;
  const thread = threadId ? data.threads[threadId] : undefined;
  return (
    <aside className="tutor-panel" ref={ref} role="dialog" aria-modal="false" aria-labelledby="tutor-panel-title">
      <header className="tutor-panel-head">
        <span className="tutor-panel-mark" aria-hidden="true">
          <TutorIcon />
        </span>
        <div className="tutor-panel-titles">
          <h2 id="tutor-panel-title">Tutor</h2>
          <p>{thread ? thread.title : 'Nova conversa'}</p>
        </div>
        <ConnectionPill />
        <button type="button" className="icon-btn" onClick={() => showThread(undefined)} aria-label="Nova conversa" title="Nova conversa">
          <PlusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={() => openThreadPage(threadId)} aria-label="Todas as conversas" title="Todas as conversas">
          <HistoryIcon />
        </button>
        <button type="button" className="icon-btn" onClick={closeTutor} aria-label="Fechar o tutor" title="Fechar (Esc)">
          <CloseIcon />
        </button>
      </header>
      <TutorChat key={threadId ?? 'new'} threadId={threadId} onThread={showThread} autoFocus />
    </aside>
  );
}
