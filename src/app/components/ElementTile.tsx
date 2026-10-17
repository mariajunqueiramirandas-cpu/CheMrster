import type { Lesson } from '../../course/types.ts';

export type TileState = 'done' | 'current' | 'open' | 'locked' | 'soon';

const STATE_LABEL: Record<TileState, string> = {
  done: 'concluída',
  current: 'próxima lição',
  open: 'disponível',
  locked: 'bloqueada',
  soon: 'em breve',
};

/** A lesson drawn as a periodic-table cell: atomic number = its place in the course. */
export function ElementTile({
  lesson,
  state,
  onSelect,
  size = 'path',
}: {
  lesson: Lesson;
  state: TileState;
  onSelect?: () => void;
  size?: 'path' | 'large';
}) {
  const content = (
    <>
      <span className="tile-number">{lesson.element.number}</span>
      <span className="tile-symbol">{lesson.element.symbol}</span>
    </>
  );
  if (!onSelect) {
    return (
      <span className={`tile tile--${state} tile--${size}`} aria-hidden="true">
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`tile tile--${state} tile--${size}`}
      onClick={onSelect}
      aria-label={`Lição ${lesson.element.number}: ${lesson.title} (${STATE_LABEL[state]})`}
    >
      {content}
    </button>
  );
}
