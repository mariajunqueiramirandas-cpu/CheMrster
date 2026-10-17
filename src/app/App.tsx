import { Suspense, lazy, useEffect } from 'react';
import { BoardIcon, BoltIcon, ChainIcon, ChartIcon, FlameIcon, MapIcon, PathIcon, SlidersIcon, TutorIcon } from './components/Icons.tsx';
import { Toasts } from './components/Toasts.tsx';
import { TutorPanel } from './components/tutor/TutorPanel.tsx';
import { LessonScreen } from './screens/LessonScreen.tsx';
import { PathScreen } from './screens/PathScreen.tsx';
import { ReviewScreen } from './screens/ReviewScreen.tsx';
import { StudioScreen } from './screens/StudioScreen.tsx';
import { TheoryScreen } from './screens/TheoryScreen.tsx';
import { type Route, href, useRoute } from './router.ts';
import { applyTheme, useSettings } from './settings.ts';
import { currentStreak, useProgress } from './store.ts';
import { openTutor, useTutorPanel } from './tutor-store.ts';

// The study tools load when first opened; the path and lessons come with the first page.
const BoardScreen = lazy(() => import('./screens/BoardScreen.tsx').then((m) => ({ default: m.BoardScreen })));
const CanvasScreen = lazy(() => import('./screens/CanvasScreen.tsx').then((m) => ({ default: m.CanvasScreen })));
const ProgressScreen = lazy(() => import('./screens/ProgressScreen.tsx').then((m) => ({ default: m.ProgressScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.tsx').then((m) => ({ default: m.SettingsScreen })));
const TutorScreen = lazy(() => import('./screens/TutorScreen.tsx').then((m) => ({ default: m.TutorScreen })));

const TABS: Array<{ route: Route; label: string; icon: typeof PathIcon; match: Route['name'][] }> = [
  { route: { name: 'path' }, label: 'Trilha', icon: PathIcon, match: ['path', 'theory'] },
  { route: { name: 'canvas' }, label: 'Mapa', icon: MapIcon, match: ['canvas'] },
  { route: { name: 'board' }, label: 'Quadro', icon: BoardIcon, match: ['board'] },
  { route: { name: 'progress' }, label: 'Progresso', icon: ChartIcon, match: ['progress'] },
  { route: { name: 'studio' }, label: 'Estruturas', icon: ChainIcon, match: ['studio'] },
];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'studio':
      return <StudioScreen initialSmiles={route.smiles} />;
    case 'theory':
      return <TheoryScreen key={route.id} id={route.id} />;
    case 'tutor':
      return <TutorScreen thread={route.thread} />;
    case 'canvas':
      return <CanvasScreen />;
    case 'board':
      return <BoardScreen />;
    case 'progress':
      return <ProgressScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <PathScreen />;
  }
}

const PAGE_CLASS: Partial<Record<Route['name'], string>> = {
  tutor: 'page page--full',
  canvas: 'page page--full',
  board: 'page page--full',
  progress: 'page page--wide',
  settings: 'page',
};

export function App() {
  const route = useRoute();
  const progress = useProgress();
  const { theme } = useSettings();
  const tutor = useTutorPanel();

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    // Ctrl/⌘ + K asks the tutor from anywhere.
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openTutor(tutor.threadId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tutor.threadId]);

  const overlays = (
    <>
      <TutorPanel />
      <Toasts />
    </>
  );

  if (route.name === 'lesson')
    return (
      <>
        <LessonScreen key={route.id} id={route.id} />
        {overlays}
      </>
    );
  if (route.name === 'review')
    return (
      <>
        <ReviewScreen />
        {overlays}
      </>
    );

  const streak = currentStreak(progress);
  const onTutorPage = route.name === 'tutor';
  return (
    <div className={`shell shell--${route.name}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href={href({ name: 'path' })}>
            CheMrster
          </a>
          <nav className="tabs" aria-label="Seções">
            {TABS.map(({ route: r, label, icon: Icon, match }) => (
              <a key={r.name} href={href(r)} aria-current={match.includes(route.name) ? 'page' : undefined}>
                <Icon /> <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="stats">
            <a className={`stat${streak ? ' stat--hot' : ''}`} href={href({ name: 'progress' })} title="Dias seguidos estudando">
              <FlameIcon /> {streak}
              <span className="sr-only"> dias seguidos</span>
            </a>
            <a className="stat" href={href({ name: 'progress' })} title="Pontos de experiência">
              <BoltIcon /> {progress.xp}
              <span className="sr-only"> XP</span>
            </a>
          </div>
          {!onTutorPage && (
            <button type="button" className="btn topbar-tutor" onClick={() => openTutor(tutor.threadId)} title="Perguntar ao tutor (Ctrl+K)">
              <TutorIcon /> Tutor
            </button>
          )}
          <a className="icon-btn" href={href({ name: 'settings' })} aria-label="Ajustes" aria-current={route.name === 'settings' ? 'page' : undefined}>
            <SlidersIcon />
          </a>
        </div>
      </header>
      <main className={PAGE_CLASS[route.name] ?? 'page'}>
        <Suspense fallback={<p className="page-loading">Carregando…</p>}>
          <Screen route={route} />
        </Suspense>
      </main>
      {!onTutorPage && !tutor.open && (
        <button type="button" className="tutor-fab" onClick={() => openTutor(tutor.threadId)} aria-label="Perguntar ao tutor">
          <TutorIcon /> Tutor
        </button>
      )}
      {overlays}
    </div>
  );
}
