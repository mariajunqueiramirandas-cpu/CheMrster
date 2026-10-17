/**
 * The study board: four columns of cards dragged with mouse, finger (long press) or keyboard
 * (Alt + arrows). Cards linked to a lesson show how well it is known and move by themselves
 * after practice.
 */
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LESSON_BY_ID, LESSONS } from '../../course/course.ts';
import { type BoardCard, type CardColor, COLUMNS, COLUMN_TITLE, type ColumnId, addCard, columnOf, moveCard, removeCard, updateCard } from '../../study/board.ts';
import { LEVEL_LABEL, daysUntil, masteryAll } from '../../study/progress.ts';
import { createCard, editBoard, seedBoard, syncOnVisit, useBoard } from '../board-store.ts';
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon, TutorIcon } from '../components/Icons.tsx';
import { uid } from '../persist.ts';
import { href, navigate } from '../router.ts';
import { useProgress } from '../store.ts';
import { toast } from '../toast.ts';
import { ask } from '../tutor-store.ts';

const COLORS: Array<{ id: CardColor; label: string }> = [
  { id: 'none', label: 'Sem cor' },
  { id: 'magenta', label: 'Magenta' },
  { id: 'cobalt', label: 'Azul' },
  { id: 'green', label: 'Verde' },
  { id: 'amber', label: 'Âmbar' },
];

interface Drag {
  id: string;
  /** Pointer position and where on the card it was grabbed. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  w: number;
  over?: { col: ColumnId; index: number };
}

function dueLabel(due?: string): { text: string; tone: 'late' | 'soon' | 'later' } | undefined {
  const d = daysUntil(due ?? '');
  if (d === undefined) return undefined;
  if (d < 0) return { text: `atrasada ${-d}d`, tone: 'late' };
  if (d === 0) return { text: 'hoje', tone: 'soon' };
  if (d === 1) return { text: 'amanhã', tone: 'soon' };
  return { text: new Date(`${due}T12:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }), tone: 'later' };
}

function boardSummary(cards: Record<string, BoardCard>, columns: Record<ColumnId, string[]>): string {
  return COLUMNS.map((c) => `${c.title}: ${columns[c.id].map((id) => cards[id]?.title).filter(Boolean).join('; ') || 'vazio'}`).join(' | ');
}

export function BoardScreen() {
  const board = useBoard();
  const progress = useProgress();
  const mastery = useMemo(() => masteryAll(progress), [progress]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<ColumnId | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const total = Object.keys(board.cards).length;

  useEffect(() => {
    const moved = syncOnVisit();
    if (moved) toast(moved === 1 ? '1 lição voltou para Revisar' : `${moved} lições voltaram para Revisar`);
  }, []);

  const placeCard = useCallback(
    (id: string, col: ColumnId, index: number) => {
      const from = columnOf(board, id);
      editBoard((b) => moveCard(b, id, col, index));
      const limit = COLUMNS.find((c) => c.id === col)?.limit;
      if (limit && from !== col && board.columns[col].length >= limit) toast(`${COLUMN_TITLE[col]} passou de ${limit} cartões: foco em poucos de cada vez ajuda a fixar.`);
      setAnnounce(`${board.cards[id]?.title} em ${COLUMN_TITLE[col]}, posição ${index + 1}.`);
    },
    [board],
  );

  // ---- pointer drag ----
  // Refs carry the gesture between native listeners; state only drives what is drawn.
  const press = useRef<{ id: string; x: number; y: number; timer?: number; touch: boolean; pointer: number; el: HTMLElement; off: () => void } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const place = useRef(placeCard);
  place.current = placeCard;

  const show = (d: Drag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const target = (x: number, y: number, id: string): Drag['over'] => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-col]');
    if (!el) return undefined;
    const cards = [...el.querySelectorAll<HTMLElement>('[data-card]')].filter((c) => c.dataset.card !== id);
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    return { col: el.dataset.col as ColumnId, index };
  };

  const begin = (x: number, y: number) => {
    const p = press.current;
    if (!p) return;
    const r = p.el.getBoundingClientRect();
    show({ id: p.id, x, y, dx: p.x - r.left, dy: p.y - r.top, w: r.width, over: target(x, y, p.id) });
    navigator.vibrate?.(10);
  };

  const onMove = (e: globalThis.PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointer) return;
    const d = dragRef.current;
    if (!d) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      // A finger that moves before the long press is scrolling, not dragging.
      if (p.touch) {
        if (moved > 8) finish(e, true);
        return;
      }
      if (moved >= 5) begin(e.clientX, e.clientY);
      return;
    }
    e.preventDefault();
    show({ ...d, x: e.clientX, y: e.clientY, over: target(e.clientX, e.clientY, d.id) });
    const s = scroller.current;
    if (s) {
      // Near the edges, the board scrolls along.
      const r = s.getBoundingClientRect();
      if (e.clientX < r.left + 40) s.scrollLeft -= 14;
      else if (e.clientX > r.right - 40) s.scrollLeft += 14;
    }
  };

  const finish = (e: globalThis.PointerEvent | null, cancel = false) => {
    const p = press.current;
    if (!p || (e && e.pointerId !== p.pointer)) return;
    clearTimeout(p.timer);
    press.current = null;
    p.off();
    const d = dragRef.current;
    if (d) {
      if (!cancel && d.over) place.current(d.id, d.over.col, d.over.index);
      show(null);
    } else if (!cancel && e?.type === 'pointerup') {
      setEditing(p.id);
    }
  };
  const onUp = (e: globalThis.PointerEvent) => finish(e);
  const onCancel = (e: globalThis.PointerEvent) => finish(e, true);

  const onCardPointerDown = (e: PointerEvent<HTMLElement>, id: string) => {
    if (e.button !== 0 || press.current || (e.target as HTMLElement).closest('button, a, input')) return;
    const touch = e.pointerType !== 'mouse';
    // These exact functions come off again when the gesture ends, whatever render ends it.
    const [move, up, cancel] = [onMove, onUp, onCancel];
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    press.current = { id, x: e.clientX, y: e.clientY, touch, pointer: e.pointerId, el: e.currentTarget, off };
    // A finger has to rest a moment first, so swiping still scrolls the board.
    if (touch) press.current.timer = window.setTimeout(() => begin(press.current?.x ?? 0, press.current?.y ?? 0), 260);
  };

  // A non-passive touch listener present from the first touch keeps touch moves cancellable,
  // so once a long press has lifted a card the finger drags it instead of scrolling the board.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    el.addEventListener('touchmove', hold, { passive: false });
    return () => el.removeEventListener('touchmove', hold);
  }, []);

  // Escape puts a dragged card back.
  useEffect(() => {
    if (!drag) return;
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && finish(null, true);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [!!drag]);

  // ---- keyboard ----
  const onCardKey = (e: KeyboardEvent<HTMLElement>, id: string) => {
    // Keys on the card's own link (Praticar) belong to the link.
    if (e.target !== e.currentTarget) return;
    const col = columnOf(board, id);
    if (!col) return;
    const index = board.columns[col].indexOf(id);
    const ci = COLUMNS.findIndex((c) => c.id === col);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setEditing(id);
      return;
    }
    if (!e.altKey) return;
    let to: { col: ColumnId; index: number } | undefined;
    if (e.key === 'ArrowLeft' && ci > 0) to = { col: COLUMNS[ci - 1].id, index: 0 };
    if (e.key === 'ArrowRight' && ci < COLUMNS.length - 1) to = { col: COLUMNS[ci + 1].id, index: 0 };
    if (e.key === 'ArrowUp' && index > 0) to = { col, index: index - 1 };
    if (e.key === 'ArrowDown' && index < board.columns[col].length - 1) to = { col, index: index + 1 };
    if (!to) return;
    e.preventDefault();
    placeCard(id, to.col, to.index);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card="${id}"]`)?.focus());
  };

  const planWithTutor = () =>
    ask({
      text: 'Organize meu quadro de estudos para esta semana: o que revisar, o que estudar e o que reforçar.',
      screen: { kind: 'board', summary: boardSummary(board.cards, board.columns) },
      open: true,
    });

  const seed = () => {
    const ids = seedBoard();
    toast(ids.length ? `${ids.length} ${ids.length === 1 ? 'lição entrou' : 'lições entraram'} no quadro` : 'As próximas lições já estão no quadro');
  };

  const dragged = drag ? board.cards[drag.id] : undefined;

  return (
    <div ref={root} className={`board${drag ? ' board--dragging' : ''}`}>
      <header className="board-head">
        <div>
          <h1>Quadro de estudos</h1>
          <p>Arraste os cartões entre as colunas. Os cartões de lição andam sozinhos quando você pratica.</p>
        </div>
        <div className="board-actions">
          <button type="button" className="btn btn--small" onClick={seed}>
            <PlusIcon width={18} height={18} /> Lições da trilha
          </button>
          <button type="button" className="btn btn--small btn--tutor" onClick={planWithTutor}>
            <TutorIcon width={18} height={18} /> Planejar com o tutor
          </button>
        </div>
      </header>

      {total === 0 ? (
        <div className="board-empty">
          <h2>Um quadro para organizar a semana</h2>
          <p>Comece com as próximas lições e as revisões que estão vencendo, ou peça ao tutor um plano que leva em conta seus pontos fracos.</p>
          <div className="board-empty-actions">
            <button type="button" className="btn btn--primary" onClick={seed}>
              Montar com a trilha
            </button>
            <button type="button" className="btn btn--tutor" onClick={planWithTutor}>
              <TutorIcon /> Planejar com o tutor
            </button>
            <button type="button" className="btn" onClick={() => setAdding('todo')}>
              Nova tarefa
            </button>
          </div>
        </div>
      ) : null}

      <div className="board-scroll" ref={scroller} hidden={total === 0 && !adding}>
        <div className="board-cols">
          {COLUMNS.map((col) => {
            const ids = board.columns[col.id];
            const over = drag?.over?.col === col.id ? drag.over.index : undefined;
            const others = ids.filter((id) => id !== drag?.id).length;
            let k = 0;
            return (
              <section key={col.id} className={`col col--${col.id}${over !== undefined ? ' is-over' : ''}`} data-col={col.id} aria-labelledby={`col-${col.id}`}>
                <header className="col-head">
                  <h2 id={`col-${col.id}`}>{col.title}</h2>
                  <span className={`col-count${col.limit && ids.length > col.limit ? ' col-count--over' : ''}`}>
                    {ids.length}
                    {col.limit ? `/${col.limit}` : ''}
                  </span>
                  <button type="button" className="icon-btn" onClick={() => setAdding(col.id)} aria-label={`Nova tarefa em ${col.title}`}>
                    <PlusIcon width={20} height={20} />
                  </button>
                </header>
                <p className="col-hint">{col.hint}</p>
                <ol className="col-cards">
                  {adding === col.id && <NewCard column={col.id} onDone={() => setAdding(null)} />}
                  {ids.map((id) => {
                    const lifted = id === drag?.id;
                    const line = !lifted && over === k;
                    if (!lifted) k++;
                    return (
                      <li key={id} className="col-slot">
                        {line && <span className="drop-line" aria-hidden="true" />}
                        <Card
                          card={board.cards[id]}
                          lifted={lifted}
                          level={board.cards[id]?.lessonId ? mastery[board.cards[id].lessonId!] : undefined}
                          onPointerDown={(e) => onCardPointerDown(e, id)}
                          onKeyDown={(e) => onCardKey(e, id)}
                        />
                      </li>
                    );
                  })}
                  {over === others && (
                    <li className="col-slot" aria-hidden="true">
                      <span className="drop-line" />
                    </li>
                  )}
                  {ids.length === 0 && adding !== col.id && over === undefined && <li className="col-empty">Solte um cartão aqui.</li>}
                </ol>
              </section>
            );
          })}
        </div>
      </div>

      {drag && dragged && (
        <div className="card-ghost" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w } as CSSProperties} aria-hidden="true">
          <Card card={dragged} level={dragged.lessonId ? mastery[dragged.lessonId] : undefined} />
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <p className="board-keys">Teclado: Tab até um cartão, Enter para abrir, Alt + setas para mover.</p>

      {editing && board.cards[editing] && <CardEditor card={board.cards[editing]} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Card({
  card,
  level,
  lifted,
  ...handlers
}: {
  card: BoardCard;
  level?: ReturnType<typeof masteryAll>[string];
  /** Being dragged: the card stays in place, faded, under the one that follows the pointer. */
  lifted?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
}) {
  const lesson = card.lessonId ? LESSON_BY_ID[card.lessonId] : undefined;
  const due = dueLabel(card.due);
  const done = card.checklist.filter((c) => c.done).length;
  return (
    <article
      className={`card card--${card.color}${lifted ? ' card--lifted' : ''}`}
      data-card={handlers.onKeyDown ? card.id : undefined}
      tabIndex={handlers.onKeyDown ? 0 : -1}
      aria-label={`${card.title}${lesson ? `, lição ${lesson.title}` : ''}`}
      {...handlers}
    >
      <div className="card-top">
        {lesson && (
          <span className={`card-tile ptile--${level?.level ?? 'nova'}`} aria-hidden="true">
            {lesson.element.symbol}
          </span>
        )}
        <h3>{card.title}</h3>
      </div>
      {card.notes && <p className="card-notes">{card.notes}</p>}
      {(lesson || due || card.checklist.length > 0) && (
        <div className="card-meta">
          {lesson && level && <span className="card-level">{level.level === 'nova' ? 'não começou' : `${Math.round(level.mastery * 100)}% · ${LEVEL_LABEL[level.level].toLowerCase()}`}</span>}
          {due && <span className={`card-due card-due--${due.tone}`}>{due.text}</span>}
          {card.checklist.length > 0 && (
            <span className="card-check">
              <CheckIcon width={14} height={14} /> {done}/{card.checklist.length}
            </span>
          )}
          {lesson && (
            <a className="card-go" href={href({ name: 'lesson', id: lesson.id })}>
              Praticar
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function NewCard({ column, onDone }: { column: ColumnId; onDone: () => void }) {
  const [title, setTitle] = useState('');
  return (
    <li>
      <form
        className="card card--new"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) createCard(column, { title: title.trim() }, 0);
          setTitle('');
          onDone();
        }}
      >
        <label className="sr-only" htmlFor={`new-${column}`}>
          Título da tarefa
        </label>
        <input
          id={`new-${column}`}
          autoFocus
          value={title}
          placeholder="Ex.: refazer questões de isomeria"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
          onBlur={() => !title.trim() && onDone()}
        />
        <div className="card-new-actions">
          <button type="submit" className="btn btn--small btn--primary" disabled={!title.trim()}>
            Adicionar
          </button>
          <button type="button" className="btn btn--small btn--quiet" onClick={onDone}>
            Cancelar
          </button>
        </div>
      </form>
    </li>
  );
}

function CardEditor({ card, onClose }: { card: BoardCard; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const board = useBoard();
  const col = columnOf(board, card.id) ?? 'todo';
  const [item, setItem] = useState('');
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const patch = (p: Partial<BoardCard>) => editBoard((b) => updateCard(b, card.id, p));
  const lesson = card.lessonId ? LESSON_BY_ID[card.lessonId] : undefined;

  return (
    <dialog ref={ref} className="sheet card-editor" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="card-title">
      <div className="card-editor-head">
        <label className="sr-only" htmlFor="card-title">
          Título
        </label>
        <input id="card-title" className="card-editor-title" value={card.title} onChange={(e) => patch({ title: e.target.value })} />
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fechar">
          <CloseIcon />
        </button>
      </div>

      <div className="segmented segmented--four card-editor-cols" role="radiogroup" aria-label="Coluna">
        {COLUMNS.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={col === c.id} className={col === c.id ? 'is-on' : ''} onClick={() => editBoard((b) => moveCard(b, card.id, c.id, 0))}>
            {c.title}
          </button>
        ))}
      </div>

      <div className="card-editor-grid">
        <label className="field">
          <span className="field-label">Lição ligada</span>
          <select className="field-input field-input--plain" value={card.lessonId ?? ''} onChange={(e) => patch({ lessonId: e.target.value || undefined })}>
            <option value="">Nenhuma</option>
            {LESSONS.filter((l) => l.generate).map((l) => (
              <option key={l.id} value={l.id}>
                {l.element.symbol} · {l.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Prazo</span>
          <input type="date" className="field-input field-input--plain" value={card.due ?? ''} onChange={(e) => patch({ due: e.target.value || undefined })} />
        </label>
      </div>

      <fieldset className="color-pick">
        <legend className="field-label">Cor</legend>
        {COLORS.map((c) => (
          <label key={c.id} className={`color-dot color-dot--${c.id}`} title={c.label}>
            <input type="radio" name="card-color" checked={card.color === c.id} onChange={() => patch({ color: c.id })} />
            <span className="sr-only">{c.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field-label">Anotações</span>
        <textarea className="field-input field-input--plain" rows={3} value={card.notes} onChange={(e) => patch({ notes: e.target.value })} />
      </label>

      <div className="field">
        <span className="field-label">Checklist</span>
        <ul className="checklist">
          {card.checklist.map((c) => (
            <li key={c.id}>
              <label>
                <input type="checkbox" checked={c.done} onChange={(e) => patch({ checklist: card.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) })} />
                <span className={c.done ? 'is-done' : ''}>{c.text}</span>
              </label>
              <button type="button" className="icon-btn" aria-label={`Remover “${c.text}”`} onClick={() => patch({ checklist: card.checklist.filter((x) => x.id !== c.id) })}>
                <CloseIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="checklist-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!item.trim()) return;
            patch({ checklist: [...card.checklist, { id: uid('i'), text: item.trim(), done: false }] });
            setItem('');
          }}
        >
          <input className="field-input field-input--plain" value={item} placeholder="Novo item" onChange={(e) => setItem(e.target.value)} aria-label="Novo item da checklist" />
          <button type="submit" className="btn btn--small" disabled={!item.trim()}>
            Adicionar
          </button>
        </form>
      </div>

      <div className="sheet-actions sheet-actions--row">
        {lesson && (
          <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'lesson', id: lesson.id })}>
            Praticar {lesson.title}
          </button>
        )}
        <button
          type="button"
          className="btn btn--tutor"
          onClick={() => {
            ref.current?.close();
            ask({
              text: `Me ajuda com esta tarefa: “${card.title}”.${card.notes ? ` Anotações: ${card.notes}` : ''}`,
              about: `Cartão do quadro: ${card.title}`,
              screen: {
                kind: 'board',
                summary: `Cartão “${card.title}” na coluna ${COLUMN_TITLE[col]}${lesson ? `, ligado à lição ${lesson.title} [${lesson.id}]` : ''}${card.due ? `, prazo ${card.due}` : ''}.`,
              },
              open: true,
            });
          }}
        >
          <TutorIcon /> Perguntar ao tutor
        </button>
        <button
          type="button"
          className="btn btn--quiet btn--danger"
          onClick={() => {
            const index = board.columns[col].indexOf(card.id);
            // Close first: once the card is gone this editor unmounts before the dialog's close event.
            onClose();
            editBoard((b) => removeCard(b, card.id));
            // Undo puts back this card where it was, leaving later changes alone.
            toast('Cartão apagado', { label: 'Desfazer', run: () => editBoard((b) => (b.cards[card.id] ? b : addCard(b, col, card, index))) });
          }}
        >
          <TrashIcon width={18} height={18} /> Apagar
        </button>
      </div>
    </dialog>
  );
}
