/** The tutor full screen: every conversation on the side, the open one in the middle. */
import { useState } from 'react';
import { HistoryIcon, PlusIcon, TrashIcon, TutorIcon } from '../components/Icons.tsx';
import { ConnectionPill, TutorChat } from '../components/tutor/TutorChat.tsx';
import { isTouch } from '../mobile.ts';
import { href, navigate } from '../router.ts';
import { deleteThread, useTutorData } from '../tutor-store.ts';

const when = (t: number) => {
  const d = new Date(t);
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
};

export function TutorScreen({ thread }: { thread?: string }) {
  const data = useTutorData();
  const [listOpen, setListOpen] = useState(false);
  const current = thread && data.threads[thread] ? thread : undefined;
  const open = (id?: string) => navigate({ name: 'tutor', thread: id }, true);
  const close = () => setListOpen(false);
  return (
    <div className={`tutor-screen${listOpen ? ' tutor-screen--list' : ''}`}>
      <nav className="threads" aria-label="Conversas">
        <div className="threads-head">
          <h1>
            <TutorIcon /> Tutor
          </h1>
          <ConnectionPill />
        </div>
        <a className="btn btn--primary threads-new" href={href({ name: 'tutor' })} onClick={close}>
          <PlusIcon /> Nova conversa
        </a>
        {data.order.length === 0 ? (
          <p className="threads-empty">Suas conversas ficam salvas aqui, neste aparelho.</p>
        ) : (
          <ul className="threads-list">
            {data.order.map((id) => {
              const t = data.threads[id];
              return (
                <li key={id} className={id === current ? 'is-current' : ''}>
                  <a href={href({ name: 'tutor', thread: id })} aria-current={id === current ? 'page' : undefined} onClick={close}>
                    <span className="threads-title">{t.title}</span>
                    <span className="threads-when">{when(t.updatedAt)}</span>
                  </a>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Apagar a conversa “${t.title}”`}
                    onClick={() => {
                      if (!confirm(`Apagar a conversa “${t.title}”?`)) return;
                      deleteThread(id);
                      if (id === current) open(undefined);
                    }}
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <section className="tutor-main" aria-label={current ? data.threads[current].title : 'Nova conversa'}>
        <header className="tutor-main-head">
          <button type="button" className="btn btn--small" onClick={() => setListOpen(true)}>
            <HistoryIcon width={18} height={18} /> Conversas
          </button>
          <ConnectionPill />
          {current && (
            <a className="btn btn--small" href={href({ name: 'tutor' })}>
              <PlusIcon width={18} height={18} /> Nova
            </a>
          )}
        </header>
        <TutorChat key={current ?? 'new'} threadId={current} onThread={(id) => open(id)} autoFocus={!isTouch()} />
      </section>
    </div>
  );
}
