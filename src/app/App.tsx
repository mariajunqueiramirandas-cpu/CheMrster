import { type MouseEvent, type ReactNode, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAccounts } from './account.ts';
import { BoardIcon, BoltIcon, ChainIcon, ChartIcon, FlameIcon, MapIcon, MoreIcon, PathIcon, SlidersIcon, TutorIcon } from './components/Icons.tsx';
import { MoreSheet } from './components/MoreSheet.tsx';
import { Toasts } from './components/Toasts.tsx';
import { TutorPanel } from './components/tutor/TutorPanel.tsx';
import { LessonScreen } from './screens/LessonScreen.tsx';
import { PathScreen } from './screens/PathScreen.tsx';
import { ReviewScreen } from './screens/ReviewScreen.tsx';
import { StudioScreen } from './screens/StudioScreen.tsx';
import { TheoryScreen } from './screens/TheoryScreen.tsx';
import { haptic } from './mobile.ts';
import { type Route, href, useRoute } from './router.ts';
import { applyTheme, useSettings } from './settings.ts';
import { currentStreak, useProgress } from './store.ts';
import { openTutor, useTutorPanel } from './tutor-store.ts';

// The study tools load when first opened; the path and lessons come with the first page.
const BoardScreen = lazy(() => import('./screens/BoardScreen.tsx').then((m) => ({ default: m.BoardScreen })));
const CanvasScreen = lazy(() => import('./screens/CanvasScreen.tsx').then((m) => ({ default: m.CanvasScreen })));
const ProgressScreen = lazy(() => import('./screens/ProgressScreen.tsx').then((m) => ({ default: m.ProgressScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.tsx').then((m) => ({ default: m.SettingsScreen })));
const PlansScreen = lazy(() => import('./screens/PlansScreen.tsx').then((m) => ({ default: m.PlansScreen })));
const TutorScreen = lazy(() => import('./screens/TutorScreen.tsx').then((m) => ({ default: m.TutorScreen })));

/** The top navigation on wide screens. */
const TABS: Array<{ route: Route; label: string; icon: typeof PathIcon; match: Route['name'][] }> = [
  { route: { name: 'path' }, label: 'Trilha', icon: PathIcon, match: ['path', 'theory'] },
  { route: { name: 'canvas' }, label: 'Mapa', icon: MapIcon, match: ['canvas'] },
  { route: { name: 'board' }, label: 'Quadro', icon: BoardIcon, match: ['board'] },
  { route: { name: 'progress' }, label: 'Progresso', icon: ChartIcon, match: ['progress'] },
  { route: { name: 'studio' }, label: 'Estruturas', icon: ChainIcon, match: ['studio'] },
];

/** The tab bar on phones: four places and the tutor in the middle, the rest under "Mais". */
const PHONE_TABS: Array<{ route: Route; label: string; icon: typeof PathIcon; match: Route['name'][] } | 'tutor'> = [
  { route: { name: 'path' }, label: 'Trilha', icon: PathIcon, match: ['path', 'theory'] },
  { route: { name: 'canvas' }, label: 'Mapa', icon: MapIcon, match: ['canvas'] },
  'tutor',
  { route: { name: 'board' }, label: 'Quadro', icon: BoardIcon, match: ['board'] },
];
const MORE_ROUTES: Route['name'][] = ['progress', 'studio', 'settings', 'plans'];

function Screen({ route, accounts }: { route: Route; accounts: boolean }) {
  switch (route.name) {
    // The pricing table needs Clerk, which only the app with accounts has.
    case 'plans':
      return accounts ? <PlansScreen /> : <PathScreen />;
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
  plans: 'page page--wide',
};

/** `account` is the signed-in learner's menu (Clerk's UserButton), when accounts are on. */
export function App({ account }: { account?: ReactNode } = {}) {
  const route = useRoute();
  const accounts = useAccounts();
  const progress = useProgress();
  const { theme } = useSettings();
  const tutor = useTutorPanel();
  const [more, setMore] = useState(false);
  const topbarHidden = useScrollMemory(href(route));

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
  const openTutorHere = () => (onTutorPage ? undefined : openTutor(tutor.threadId));
  // Tapping the tab you are on goes back to the top, as on every phone.
  const onTab = (e: MouseEvent, match: Route['name'][]) => {
    haptic('tap');
    if (!match.includes(route.name)) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  return (
    <div className={`shell shell--${route.name}`}>
      <header className={`topbar${topbarHidden ? ' topbar--hidden' : ''}`}>
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
          <a className="icon-btn topbar-settings" href={href({ name: 'settings' })} aria-label="Ajustes" aria-current={route.name === 'settings' ? 'page' : undefined}>
            <SlidersIcon />
          </a>
          {account && <div className="topbar-account">{account}</div>}
        </div>
      </header>
      <main className={PAGE_CLASS[route.name] ?? 'page'}>
        <Suspense fallback={<PageLoading />}>
          <Screen route={route} accounts={accounts} />
        </Suspense>
      </main>
      <nav className="tabbar" aria-label="Seções">
        {PHONE_TABS.map((tab) =>
          tab === 'tutor' ? (
            <button
              key="tutor"
              type="button"
              className="tabbar-tutor"
              aria-label="Perguntar ao tutor"
              aria-current={onTutorPage || tutor.open ? 'page' : undefined}
              onClick={() => {
                haptic('tap');
                openTutorHere();
              }}
            >
              <span className="tabbar-tutor-disc">
                <TutorIcon />
              </span>
              <span>Tutor</span>
            </button>
          ) : (
            <a
              key={tab.route.name}
              href={href(tab.route)}
              aria-current={tab.match.includes(route.name) && !tutor.open ? 'page' : undefined}
              onClick={(e) => onTab(e, tab.match)}
            >
              <tab.icon /> <span>{tab.label}</span>
            </a>
          ),
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-current={MORE_ROUTES.includes(route.name) && !tutor.open ? 'page' : undefined}
          onClick={() => {
            haptic('tap');
            setMore(true);
          }}
        >
          <MoreIcon /> <span>Mais</span>
        </button>
      </nav>
      {more && <MoreSheet onClose={() => setMore(false)} />}
      {overlays}
    </div>
  );
}

/** A quiet placeholder shaped like a page, while a section's code arrives. */
function PageLoading() {
  return (
    <div className="page-loading" aria-busy="true" aria-label="Carregando">
      <span className="skeleton skeleton--title" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line skeleton--short" />
      <span className="skeleton skeleton--block" />
    </div>
  );
}

/**
 * Each screen keeps its own scroll position (hash routes never reset it on their own), and on
 * phones the top bar slides away while reading down and comes back on the way up.
 */
function useScrollMemory(key: string): boolean {
  const saved = useRef(new Map<string, number>());
  const current = useRef(key);
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    current.current = key;
    window.scrollTo({ top: saved.current.get(key) ?? 0 });
    setHidden(false);
  }, [key]);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        saved.current.set(current.current, y);
        const dy = y - last;
        if (y < 72) setHidden(false);
        else if (dy > 8) setHidden(true);
        else if (dy < -8) setHidden(false);
        if (Math.abs(dy) > 8 || y < 72) last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}
