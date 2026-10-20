/**
 * The web app's routes (src/app/routes.ts) on Android's screens. Shared code speaks in hash
 * routes ("#/mapa", a toast's "Ver" link); here they become expo-router paths.
 */
import { router } from 'expo-router';
import { type Route, parseRoute } from '../../../src/app/routes.ts';

export type { Route };

/** The path that shows a route in this app. */
export function pathOf(route: Route): string {
  switch (route.name) {
    case 'lesson':
      return `/licao/${encodeURIComponent(route.id)}`;
    case 'theory':
      return `/teoria/${encodeURIComponent(route.id)}`;
    case 'review':
      return '/revisao';
    case 'studio':
      return route.smiles ? `/estruturas?smiles=${encodeURIComponent(route.smiles)}` : '/estruturas';
    case 'tutor':
      return route.thread ? `/tutor?thread=${encodeURIComponent(route.thread)}` : '/tutor';
    case 'canvas':
      return '/mapa';
    case 'board':
      return '/quadro';
    case 'progress':
      return '/progresso';
    // Plans need an account, which the Android app does not have yet.
    case 'settings':
    case 'plans':
      return '/ajustes';
    default:
      return '/';
  }
}

const TABS: Route['name'][] = ['path', 'canvas', 'board', 'tutor'];

/** Opens a route: tabs switch, everything else goes on top of the stack. */
export function go(route: Route) {
  const path = pathOf(route);
  if (TABS.includes(route.name)) router.navigate(path as never);
  else router.push(path as never);
}

/** Follows a link the shared code wrote as a hash route. */
export const goHref = (hash: string) => go(parseRoute(hash));

/** Back where the learner came from, or the path when there is nothing behind. */
export function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
