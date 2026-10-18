/** The tutor's side panel: opens over any screen, lessons included, on the conversation at hand. */
import { useEffect, useRef } from 'react';
import { haptic, isTouch } from '../../mobile.ts';
import { closeTutor, showThread, useTutorData, useTutorPanel } from '../../tutor-store.ts';
import { CloseIcon, HistoryIcon, PlusIcon, TutorIcon } from '../Icons.tsx';
import { ConnectionPill, TutorChat, openThreadPage } from './TutorChat.tsx';

export function TutorPanel() {
  const { open, threadId } = useTutorPanel();
  const data = useTutorData();
  const ref = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  const head = useRef<HTMLElement>(null);

  // On phones the panel is a sheet over the screen: pull its header down to put it away.
  useEffect(() => {
    const el = head.current;
    const panel = ref.current;
    if (!open || !el || !panel) return;
    let drag: { y: number; t: number; dy: number } | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || (e.target as HTMLElement).closest('button, a') || matchMedia('(min-width: 760px)').matches) return;
      drag = { y: e.touches[0].clientY, t: e.timeStamp, dy: 0 };
    };
    const move = (e: TouchEvent) => {
      if (!drag) return;
      drag.dy = Math.max(0, e.touches[0].clientY - drag.y);
      if (e.cancelable) e.preventDefault();
      panel.classList.add('is-dragging');
      panel.style.transform = `translateY(${drag.dy}px)`;
    };
    const end = (e: TouchEvent) => {
      if (!drag) return;
      const { dy, t } = drag;
      drag = null;
      panel.classList.remove('is-dragging');
      if (dy > 140 || (dy > 40 && dy / Math.max(1, e.timeStamp - t) > 0.5)) {
        haptic('tap');
        const anim = panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(100%)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
        anim.onfinish = () => closeTutor();
      } else {
        panel.style.transform = '';
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [open]);

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
      <header className="tutor-panel-head" ref={head}>
        <span className="tutor-panel-grabber" aria-hidden="true" />
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
      <TutorChat key={threadId ?? 'new'} threadId={threadId} onThread={showThread} autoFocus={!isTouch()} />
    </aside>
  );
}
