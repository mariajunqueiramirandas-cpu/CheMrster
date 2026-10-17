import { ChainIcon, BoltIcon, FlameIcon, PathIcon } from './components/Icons.tsx';
import { LessonScreen } from './screens/LessonScreen.tsx';
import { PathScreen } from './screens/PathScreen.tsx';
import { StudioScreen } from './screens/StudioScreen.tsx';
import { href, useRoute } from './router.ts';
import { currentStreak, useProgress } from './store.ts';

export function App() {
  const route = useRoute();
  const progress = useProgress();

  if (route.name === 'lesson') return <LessonScreen key={route.id} id={route.id} />;

  const streak = currentStreak(progress);
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href={href({ name: 'path' })}>
          CheMrster
        </a>
        <nav className="tabs" aria-label="Seções">
          <a href={href({ name: 'path' })} aria-current={route.name === 'path' ? 'page' : undefined}>
            <PathIcon /> <span>Trilha</span>
          </a>
          <a href={href({ name: 'studio' })} aria-current={route.name === 'studio' ? 'page' : undefined}>
            <ChainIcon /> <span>Estruturas</span>
          </a>
        </nav>
        <div className="stats">
          <span className={`stat${streak ? ' stat--hot' : ''}`} title="Dias seguidos estudando">
            <FlameIcon /> {streak}
            <span className="sr-only"> dias seguidos</span>
          </span>
          <span className="stat" title="Pontos de experiência">
            <BoltIcon /> {progress.xp}
            <span className="sr-only"> XP</span>
          </span>
        </div>
      </header>
      <main className="page">{route.name === 'studio' ? <StudioScreen initialSmiles={route.smiles} /> : <PathScreen />}</main>
    </div>
  );
}
