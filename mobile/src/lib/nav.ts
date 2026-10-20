/**
 * The web app's routes (src/app/routes.ts) on Android's screens. Shared code speaks in hash
 * routes ("#/mapa", a toast's "Ver" link); here they become expo-router paths.
 */
import { router } from 'expo-router';
import { type Route, parseRoute } from '../../../src/app/routes.ts';

export type { Route };

/** Where a route lives in this app: a path, and its query parameters. */
export function hrefOf(route: Route): { pathname: string; params?: Record<string, string> } {
  switch (route.name) {
    case 'lesson':
      return { pathname: '/licao/[id]', params: { id: route.id } };
    case 'theory':
      return { pathname: '/teoria/[id]', params: { id: route.id } };
    case 'review':
      return { pathname: '/revisao' };
    case 'studio':
      return { pathname: '/estruturas', params: route.smiles ? { smiles: route.smiles } : undefined };
    case 'tutor':
      return { pathname: '/tutor', params: route.thread ? { thread: route.thread } : undefined };
    case 'canvas':
      return { pathname: '/mapa' };
    case 'board':
      return { pathname: '/quadro' };
    case 'progress':
      return { pathname: '/progresso' };
    // Plans need an account, which the Android app does not have yet.
    case 'settings':
    case 'plans':
      return { pathname: '/ajustes' };
    default:
      return { pathname: '/' };
  }
}

const TABS: Route['name'][] = ['path', 'canvas', 'board', 'tutor'];

/** Opens a route: tabs switch, everything else goes on top of the stack. */
export function go(route: Route) {
  const href = hrefOf(route) as never;
  if (TABS.includes(route.name)) router.navigate(href);
  else router.push(href);
}

/** Follows a link the shared code wrote as a hash route. */
export const goHref = (hash: string) => go(parseRoute(hash));

/** Back where the learner came from, or the path when there is nothing behind. */
export function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
