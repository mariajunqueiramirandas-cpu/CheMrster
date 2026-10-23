/** The app's preferences on this device: the theme. */
import { persisted, usePersisted } from '../../src/app/persist.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: Theme;
}

const DEFAULTS: Prefs = { theme: 'system' };

export const prefsStore = persisted<Prefs>('chemrster:nomenclatura:prefs:v1', (stored) => {
  const s = stored && typeof stored === 'object' ? (stored as Partial<Prefs>) : {};
  return { theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : DEFAULTS.theme };
});

export const usePrefs = () => usePersisted(prefsStore);

export function setPrefs(patch: Partial<Prefs>) {
  prefsStore.set((p) => ({ ...p, ...patch }));
}
