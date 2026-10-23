/** Today's puzzle number, which turns over at local midnight (or when the app comes back to the front). */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { memory } from '../../../src/app/persist.ts';
import { msToNext, puzzleNumber } from '../../../src/nomenclatura/daily.ts';

const today = memory(puzzleNumber());
let timer: ReturnType<typeof setTimeout> | undefined;

function tick() {
  today.set(puzzleNumber());
  clearTimeout(timer);
  // A little after midnight, so the new day has surely begun.
  timer = setTimeout(tick, msToNext() + 500);
}

/** Starts following the calendar; returns the stop. */
export function startClock(): () => void {
  tick();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') tick();
  });
  return () => {
    clearTimeout(timer);
    sub.remove();
  };
}

export const useToday = today.use;

const two = (n: number) => String(n).padStart(2, '0');

/** "05:12:33" until the next puzzle, ticking every second while shown. */
export function useCountdown(): string {
  const [ms, setMs] = useState(msToNext);
  useEffect(() => {
    const id = setInterval(() => setMs(msToNext()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}
