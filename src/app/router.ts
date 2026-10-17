/**
 * Hash routes: #/ (trilha), #/licao/<id>, #/teoria/<id>, #/revisao, #/estruturas[?smiles=...],
 * #/tutor[/<conversa>], #/mapa, #/quadro, #/progresso, #/ajustes.
 */
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'path' }
  | { name: 'lesson'; id: string }
  | { name: 'theory'; id: string }
  | { name: 'review' }
  | { name: 'studio'; smiles?: string }
  | { name: 'tutor'; thread?: string }
  | { name: 'canvas' }
  | { name: 'board' }
  | { name: 'progress' }
  | { name: 'settings' };

const SIMPLE: Record<string, Route> = {
  revisao: { name: 'review' },
  mapa: { name: 'canvas' },
  quadro: { name: 'board' },
  progresso: { name: 'progress' },
  ajustes: { name: 'settings' },
};

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'licao' && parts[1]) return { name: 'lesson', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'teoria' && parts[1]) return { name: 'theory', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'tutor') return parts[1] ? { name: 'tutor', thread: decodeURIComponent(parts[1]) } : { name: 'tutor' };
  if (parts[0] === 'estruturas') {
    const smiles = new URLSearchParams(query).get('smiles') ?? undefined;
    return { name: 'studio', smiles };
  }
  return SIMPLE[parts[0]] ?? { name: 'path' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'lesson':
      return `#/licao/${encodeURIComponent(route.id)}`;
    case 'theory':
      return `#/teoria/${encodeURIComponent(route.id)}`;
    case 'review':
      return '#/revisao';
    case 'studio':
      return route.smiles ? `#/estruturas?smiles=${encodeURIComponent(route.smiles)}` : '#/estruturas';
    case 'tutor':
      return route.thread ? `#/tutor/${encodeURIComponent(route.thread)}` : '#/tutor';
    case 'canvas':
      return '#/mapa';
    case 'board':
      return '#/quadro';
    case 'progress':
      return '#/progresso';
    case 'settings':
      return '#/ajustes';
    default:
      return '#/';
  }
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
