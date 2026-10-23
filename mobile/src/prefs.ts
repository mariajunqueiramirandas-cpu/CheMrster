/** The game's preferences on this device: the theme and the high-contrast squares. */
import { persisted, usePersisted } from '../../src/app/persist.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: Theme;
  /** Orange and blue instead of green and yellow, as in Wordle's high-contrast mode. */
  contrast: boolean;
}

const DEFAULTS: Prefs = { theme: 'system', contrast: false };

export const prefsStore = persisted<Prefs>('chemrster:nomenclatura:prefs:v1', (stored) => {
  const s = stored && typeof stored === 'object' ? (stored as Partial<Prefs>) : {};
  return {
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : DEFAULTS.theme,
    contrast: s.contrast === true,
  };
});

export const usePrefs = () => usePersisted(prefsStore);

export function setPrefs(patch: Partial<Prefs>) {
  prefsStore.set((p) => ({ ...p, ...patch }));
}
