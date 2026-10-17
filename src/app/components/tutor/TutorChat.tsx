/** A conversation with the tutor: the messages, what is streaming, and the box to write in. */
import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LESSON_BY_ID } from '../../../course/course.ts';
import { plainText } from '../../../tutor/markup.ts';
import type { Part, Thread, Turn, TutorTurn } from '../../../tutor/types.ts';
import { masteryAll, weakSpots } from '../../../study/progress.ts';
import { saveToMap } from '../../canvas-store.ts';
import { href, navigate } from '../../router.ts';
import { dueLessons, useProgress } from '../../store.ts';
import { toast } from '../../toast.ts';
import {
  answerExercise,
  ask,
  closeTutor,
  isBusy,
  retry,
  stopReply,
  undoSaved,
  useConnection,
  useLiveTurns,
  useTutorData,
} from '../../tutor-store.ts';
import { CopyIcon, PinIcon, SendIcon, StopIcon, TutorIcon, UndoIcon } from '../Icons.tsx';
import { Markup } from './Markup.tsx';
import { MiniExercise } from './MiniExercise.tsx';

const TOOL_LABEL: Record<string, [running: string, done: string]> = {
  analisar_molecula: ['Analisando a estrutura…', 'Consultou o motor químico'],
  reagir: ['Calculando a reação…', 'Calculou a reação'],
  propor_exercicio: ['Preparando uma questão…', 'Questão pronta'],
  salvar_no_mapa: ['Montando cartões no mapa…', 'Cartões no mapa'],
  planejar_tarefas: ['Organizando o quadro…', 'Tarefas no quadro'],
};

/** Chips for the tools whose result has no card of its own. */
const QUIET_WHEN_DONE = new Set(['propor_exercicio', 'salvar_no_mapa', 'planejar_tarefas']);

export function ConnectionPill() {
  const c = useConnection();
  if (!c.checked && c.kind === 'offline') return <span className="conn conn--checking">Conectando…</span>;
  return (
    <a className={`conn conn--${c.kind === 'offline' ? 'offline' : 'ai'}`} href={href({ name: 'settings' })} onClick={() => closeTutor()}>
      {c.kind === 'offline' ? 'Modo offline' : 'IA conectada'}
    </a>
  );
}

function PartView({ part, turn, threadId, last }: { part: Part; turn: TutorTurn; threadId: string; last: boolean }) {
  switch (part.type) {
    case 'text':
      return <Markup text={part.text} streaming={turn.status === 'streaming' && last} />;
    case 'tool': {
      if (part.status === 'done' && QUIET_WHEN_DONE.has(part.name)) return null;
      const [running, done] = TOOL_LABEL[part.name] ?? ['Trabalhando…', 'Pronto'];
      return (
        <p className={`tool-chip tool-chip--${part.status}`}>
          <span className="tool-chip-dot" aria-hidden="true" />
          {part.status === 'running' ? running : part.status === 'error' ? `Não deu: ${part.detail ?? 'erro'}` : done}
          {part.status === 'done' && part.detail && <span className="tool-chip-detail">{part.detail}</span>}
        </p>
      );
    }
    case 'exercise':
      return <MiniExercise part={part} disabled={isBusy(threadId)} onAnswer={(a) => answerExercise(threadId, turn.id, part.id, a)} />;
    case 'saved':
      return (
        <div className={`saved${part.undone ? ' saved--undone' : ''}`}>
          <p>{part.undone ? `Desfeito: ${part.summary}` : `Criado: ${part.summary}`}</p>
          {!part.undone && (
            <>
              <a className="btn btn--small" href={href({ name: part.target === 'map' ? 'canvas' : 'board' })} onClick={() => closeTutor()}>
                {part.target === 'map' ? 'Ver no mapa' : 'Ver no quadro'}
              </a>
              <button type="button" className="btn btn--small btn--quiet" onClick={() => undoSaved(threadId, turn.id, part.id)}>
                <UndoIcon width={16} height={16} /> Desfazer
              </button>
            </>
          )}
        </div>
      );
    case 'notice':
      return (
        <div className={`notice notice--${part.tone}`} role={part.tone === 'error' ? 'alert' : 'status'}>
          <p>{part.text}</p>
          {part.action === 'settings' && (
            <a className="btn btn--small" href={href({ name: 'settings' })} onClick={() => closeTutor()}>
              Abrir Ajustes
            </a>
          )}
          {part.action === 'retry' && last && (
            <button type="button" className="btn btn--small" onClick={() => retry(threadId)}>
              Tentar de novo
            </button>
          )}
        </div>
      );
  }
}

function replyText(turn: TutorTurn): string {
  return turn.parts
    .filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim();
}

function TutorMessage({ turn, threadId, isLast }: { turn: TutorTurn; threadId: string; isLast: boolean }) {
  const text = replyText(turn);
  const streaming = turn.status === 'streaming';
  const thinking = streaming && !turn.parts.some((p) => p.type === 'text' && p.text.trim());
  const save = () => {
    const firstLine = plainText(text).split('\n')[0];
    saveToMap({ kind: 'tutor', title: firstLine.length > 60 ? `${firstLine.slice(0, 58)}…` : firstLine || 'Resposta do tutor', text });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(text));
      toast('Resposta copiada');
    } catch {
      toast('Não foi possível copiar');
    }
  };
  return (
    <div className="msg msg--tutor" aria-busy={streaming}>
      <span className="msg-mark" aria-hidden="true">
        <TutorIcon width={18} height={18} />
      </span>
      <div className="msg-body">
        {turn.parts.map((p, i) => (
          <PartView key={'id' in p ? p.id : i} part={p} turn={turn} threadId={threadId} last={i === turn.parts.length - 1 && isLast} />
        ))}
        {thinking && (
          <p className="typing" aria-label="O tutor está escrevendo">
            <span />
            <span />
            <span />
          </p>
        )}
        {!streaming && text && (
          <div className="msg-actions">
            {turn.mode === 'offline' && <span className="msg-tag">da apostila</span>}
            {turn.status === 'stopped' && <span className="msg-tag">interrompida</span>}
            <button type="button" className="msg-action" onClick={save}>
              <PinIcon width={16} height={16} /> Salvar no mapa
            </button>
            <button type="button" className="msg-action" onClick={copy}>
              <CopyIcon width={16} height={16} /> Copiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TurnView({ turn, threadId, isLast }: { turn: Turn; threadId: string; isLast: boolean }) {
  if (turn.role === 'assistant') return <TutorMessage turn={turn} threadId={threadId} isLast={isLast} />;
  return (
    <div className="msg msg--user">
      {turn.about && <p className="msg-about">{turn.about}</p>}
      <p className="bubble">{turn.text}</p>
    </div>
  );
}

/** Ways to start, picked from where the learner stands. */
function useSuggestions(): string[] {
  const progress = useProgress();
  return useMemo(() => {
    const weak = weakSpots(masteryAll(progress))[0];
    const due = dueLessons(progress)[0];
    const out: string[] = [];
    if (weak) out.push(`Me testa em ${LESSON_BY_ID[weak.id].title.toLowerCase()}`);
    else if (due) out.push(`Revisa comigo ${LESSON_BY_ID[due.id].title.toLowerCase()}`);
    out.push('Monte um plano de estudos para esta semana');
    out.push('Faça um mapa mental das funções oxigenadas');
    out.push('O que é um carbono quiral?');
    if (!weak) out.push('Qual a diferença entre aldeído e cetona?');
    return out.slice(0, 4);
  }, [progress]);
}

export function TutorChat({ threadId, onThread, autoFocus }: { threadId?: string; onThread: (id: string) => void; autoFocus?: boolean }) {
  const data = useTutorData();
  const liveTurns = useLiveTurns();
  const thread: Thread | undefined = threadId ? data.threads[threadId] : undefined;
  const liveTurn = thread ? liveTurns[thread.id] : undefined;
  const turns: Turn[] = thread ? [...thread.turns, ...(liveTurn ? [liveTurn] : [])] : [];
  const busy = !!liveTurn;
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const suggestions = useSuggestions();
  const connection = useConnection();

  // Follow the reply as it streams, unless the learner scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  });

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus, threadId]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    stick.current = true;
    const id = ask({ text: t, thread: thread?.id });
    setDraft('');
    if (id && id !== thread?.id) onThread(id);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  return (
    <div className="chat">
      <div
        className="chat-scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {turns.length === 0 ? (
          <div className="chat-empty">
            <span className="chat-empty-mark" aria-hidden="true">
              <TutorIcon width={30} height={30} />
            </span>
            <h2>O que vamos estudar?</h2>
            <p>
              Pergunte qualquer coisa de química orgânica. O tutor confere as estruturas com o mesmo motor que corrige as questões, pode te testar
              aqui mesmo e salvar o que importa no seu mapa e no seu quadro.
            </p>
            {connection.kind === 'offline' && connection.checked && (
              <p className="chat-empty-note">
                Modo offline: as respostas vêm da apostila do app. <a href={href({ name: 'settings' })}>Conecte a IA em Ajustes</a> para conversar livremente.
              </p>
            )}
            <div className="chips-row">
              {suggestions.map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-log" aria-live="polite">
            {turns.map((t, i) => (
              <TurnView key={t.id} turn={t} threadId={thread!.id} isLast={i === turns.length - 1} />
            ))}
          </div>
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label className="sr-only" htmlFor={`composer-${threadId ?? 'new'}`}>
          Mensagem para o tutor
        </label>
        <textarea
          id={`composer-${threadId ?? 'new'}`}
          ref={input}
          rows={1}
          value={draft}
          placeholder={busy ? 'O tutor está respondendo…' : 'Pergunte ao tutor'}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={onKey}
        />
        {busy ? (
          <button type="button" className="composer-btn composer-btn--stop" onClick={() => stopReply(thread!.id)} aria-label="Parar a resposta">
            <StopIcon />
          </button>
        ) : (
          <button type="submit" className="composer-btn" disabled={!draft.trim()} aria-label="Enviar">
            <SendIcon />
          </button>
        )}
      </form>
    </div>
  );
}

/** Opens the tutor full screen on a conversation. */
export const openThreadPage = (id?: string) => {
  closeTutor();
  navigate({ name: 'tutor', thread: id });
};
