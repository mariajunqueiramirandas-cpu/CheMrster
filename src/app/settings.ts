/** Preferences: the tutor connection, the exam date, the daily goal and the theme. */
import { persisted, usePersisted } from './persist.ts';

export const TUTOR_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'O mais capaz: explicações mais cuidadosas.' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Rápido e muito bom.' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'O mais rápido e barato.' },
] as const;

export type TutorModel = (typeof TUTOR_MODELS)[number]['id'];
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** The learner's own Anthropic API key. It never leaves this device except to api.anthropic.com. */
  apiKey: string;
  model: TutorModel;
  /** Exam day, YYYY-MM-DD; empty when not set. */
  examDate: string;
  /** XP a day. */
  dailyGoal: number;
  /** What the tutor calls the learner. */
  name: string;
  theme: Theme;
}

export const DAILY_GOALS = [
  { xp: 10, label: 'Leve', note: 'uma lição' },
  { xp: 20, label: 'Regular', note: 'uma lição e uma revisão' },
  { xp: 40, label: 'Intenso', note: 'três lições' },
] as const;

const DEFAULTS: Settings = { apiKey: '', model: 'claude-opus-5-5', examDate: '', dailyGoal: 20, name: '', theme: 'system' };

function revive(stored: unknown): Settings {
  const s = { ...DEFAULTS, ...(stored && typeof stored === 'object' ? (stored as Partial<Settings>) : {}) };
  if (!TUTOR_MODELS.some((m) => m.id === s.model)) s.model = DEFAULTS.model;
  return s;
}

// The API key never goes into a backup, and restoring one keeps this device's key.
export const settingsStore = persisted<Settings>('chemrster:settings:v1', revive, {
  backup: ({ apiKey: _key, ...rest }) => rest,
  merge: (backup, current) => ({ ...revive(backup), apiKey: current.apiKey }),
});

export const useSettings = () => usePersisted(settingsStore);

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((s) => ({ ...s, ...patch }));
}

/** Applies the theme to <html>; 'system' follows the device. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  // The phone's status bar and browser chrome take the bench colour of the theme in use.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.dataset.color ?? (meta.dataset.color = meta.content);
    meta.content = theme === 'system' ? own : THEME_COLOR[theme];
  }
}

const THEME_COLOR: Record<Exclude<Theme, 'system'>, string> = { light: '#E8ECEF', dark: '#151B22' };
