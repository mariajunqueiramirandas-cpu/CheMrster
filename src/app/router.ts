/** Hash routes: #/ (trilha), #/licao/<id>, #/estruturas[?smiles=...]. */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'path' }
  | { name: 'lesson'; id: string }
  | { name: 'studio'; smiles?: string };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'licao' && parts[1]) return { name: 'lesson', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'estruturas') {
    const smiles = new URLSearchParams(query).get('smiles') ?? undefined;
    return { name: 'studio', smiles };
  }
  return { name: 'path' };
}

export function href(route: Route): string {
  if (route.name === 'lesson') return `#/licao/${encodeURIComponent(route.id)}`;
  if (route.name === 'studio') return route.smiles ? `#/estruturas?smiles=${encodeURIComponent(route.smiles)}` : '#/estruturas';
  return '#/';
}

export function navigate(route: Route, replace = false) {
  const target = href(route);
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
