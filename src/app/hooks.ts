/** Small React helpers shared by the screens. */
import { type RefObject, useEffect, useState } from 'react';

/** The element's content width, kept current as it resizes. */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 600): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Whether a media query matches, following changes. */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** Keys meant for a text field or the tutor panel, which global shortcuts must leave alone. */
export function typingIn(e: KeyboardEvent): boolean {
  const t = e.target;
  return t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"], .tutor-panel, dialog[open]');
}
