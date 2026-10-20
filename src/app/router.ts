/** Following and changing the hash route in the browser; the routes themselves are in routes.ts. */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Route, href, parseRoute } from './routes.ts';

export { type Route, href, parseRoute } from './routes.ts';

export function navigate(route: Route, replace = false) {
  const target = href(route);
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Full-screen practice, which slides up over the app and back down when done. */
const IMMERSIVE: Route['name'][] = ['lesson', 'review'];

/** How the screen change animates: practice slides up and down, everything else crossfades. */
function transitionOf(from: Route, to: Route): 'up' | 'down' | 'fade' | null {
  if (from.name === to.name && (to.name === 'tutor' || to.name === 'studio')) return null;
  const a = IMMERSIVE.includes(from.name);
  const b = IMMERSIVE.includes(to.name);
  if (b && !a) return 'up';
  if (a && !b) return 'down';
  return 'fade';
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const current = useRef(route);
  useEffect(() => {
    const onChange = () => {
      const next = parseRoute(location.hash);
      const kind = transitionOf(current.current, next);
      current.current = next;
      const doc = document as ViewTransitionDoc;
      if (!kind || !doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return setRoute(next);
      document.documentElement.dataset.vt = kind;
      doc.startViewTransition(() => flushSync(() => setRoute(next)));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
