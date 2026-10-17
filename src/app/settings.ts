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

export const settingsStore = persisted<Settings>('chemrster:settings:v1', (stored) => {
  const s = { ...DEFAULTS, ...(stored && typeof stored === 'object' ? (stored as Partial<Settings>) : {}) };
  if (!TUTOR_MODELS.some((m) => m.id === s.model)) s.model = DEFAULTS.model;
  return s;
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
}
