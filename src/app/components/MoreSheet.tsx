/** "Mais" on phones: the sections that do not fit in the tab bar, in a bottom sheet. */
import { useAccounts } from '../account.ts';
import { dismissSheet, useSheet } from '../mobile.ts';
import { type Route, href } from '../router.ts';
import { currentStreak, dayKey, useProgress } from '../store.ts';
import { useSettings } from '../settings.ts';
import { BoltIcon, ChainIcon, ChartIcon, ChevronRightIcon, FlameIcon, HistoryIcon, SlidersIcon, StarIcon } from './Icons.tsx';

export function MoreSheet({ onClose }: { onClose: () => void }) {
  const ref = useSheet();
  const accounts = useAccounts();
  const progress = useProgress();
  const { dailyGoal } = useSettings();
  const today = progress.days[dayKey(new Date())]?.xp ?? 0;
  const streak = currentStreak(progress);

  const items: Array<{ route: Route; label: string; note: string; icon: typeof ChartIcon }> = [
    { route: { name: 'progress' }, label: 'Progresso', note: 'Domínio, calendário e metas', icon: ChartIcon },
    { route: { name: 'studio' }, label: 'Estruturas', note: 'Desenhe qualquer molécula', icon: ChainIcon },
    { route: { name: 'tutor' }, label: 'Conversas', note: 'Tudo o que você falou com o tutor', icon: HistoryIcon },
    { route: { name: 'settings' }, label: 'Ajustes', note: 'Tutor, meta diária e tema', icon: SlidersIcon },
  ];
  if (accounts) items.push({ route: { name: 'plans' }, label: 'Planos', note: 'Grátis ou Pro', icon: StarIcon });

  // Following a link closes the sheet right away: the next screen is already on its way.
  const go = () => ref.current?.close();

  return (
    <dialog ref={ref} className="sheet more-sheet" onClose={onClose} aria-labelledby="more-title">
      <h2 id="more-title" className="sr-only">
        Mais
      </h2>
      <a className="more-today" href={href({ name: 'progress' })} onClick={go}>
        <span className="more-stat">
          <FlameIcon /> <strong>{streak}</strong> {streak === 1 ? 'dia' : 'dias'}
        </span>
        <span className="more-stat">
          <BoltIcon /> <strong>{progress.xp}</strong> XP
        </span>
        <span className="more-goal">
          <span>
            Hoje {today}/{dailyGoal} XP
          </span>
          <span className="meter meter--thin" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (today / dailyGoal) * 100)}%` }} />
          </span>
        </span>
      </a>
      <ul className="more-list">
        {items.map(({ route, label, note, icon: Icon }) => (
          <li key={route.name}>
            <a href={href(route)} onClick={go}>
              <span className="more-icon">
                <Icon />
              </span>
              <span className="more-text">
                <strong>{label}</strong>
                <span>{note}</span>
              </span>
              <ChevronRightIcon className="more-chevron" width={18} height={18} />
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn--quiet btn--wide" onClick={() => dismissSheet(ref.current)}>
        Fechar
      </button>
    </dialog>
  );
}
