/**
 * CheMrster's look: lab bench, white paper, black ink, phenolphthalein magenta. Colours follow
 * the device unless the player picked a theme in Ajustes.
 */
import { useColorScheme } from 'react-native';
import type { Verdict } from '../../src/nomenclatura/grade.ts';
import { usePrefs } from './prefs.ts';

export interface Palette {
  dark: boolean;
  bench: string;
  benchDeep: string;
  rule: string;
  surface: string;
  paper: string;
  ink: string;
  text: string;
  muted: string;
  magenta: string;
  magentaPress: string;
  magentaWash: string;
  cobalt: string;
  cobaltWash: string;
  right: string;
  rightWash: string;
  wrong: string;
  wrongWash: string;
  amber: string;
  amberWash: string;
  highlight: string;
  gridDot: string;
  overlay: string;
}

export const LIGHT: Palette = {
  dark: false,
  bench: '#e8ecef',
  benchDeep: '#d9dfe4',
  rule: '#c3ccd4',
  surface: '#f6f8f9',
  paper: '#ffffff',
  ink: '#000000',
  text: '#1e2a36',
  muted: '#56626f',
  magenta: '#c0157a',
  magentaPress: '#940f5d',
  magentaWash: '#f9dcec',
  cobalt: '#2448c8',
  cobaltWash: '#e2e8fb',
  right: '#17784a',
  rightWash: '#dcf2e6',
  wrong: '#c2302a',
  wrongWash: '#fbe3e1',
  amber: '#9a5b00',
  amberWash: '#fbecd2',
  highlight: '#f39bc9',
  gridDot: '#c9d1d8',
  overlay: 'rgba(10,16,22,0.45)',
};

export const DARK: Palette = {
  dark: true,
  bench: '#151b22',
  benchDeep: '#222b35',
  rule: '#34404c',
  surface: '#1c242d',
  // Molecules stay black ink on (slightly warm) paper in the dark too, as printed.
  paper: '#f5f5f1',
  ink: '#000000',
  text: '#e6ebf0',
  muted: '#9aa6b2',
  magenta: '#e2489e',
  magentaPress: '#b02a77',
  magentaWash: '#3e1830',
  cobalt: '#8ea6ff',
  cobaltWash: '#1d2850',
  right: '#4fc68a',
  rightWash: '#163627',
  wrong: '#ff7d73',
  wrongWash: '#3d1b19',
  amber: '#f0b44c',
  amberWash: '#3a2a10',
  highlight: '#f39bc9',
  gridDot: '#2c3742',
  overlay: 'rgba(0,0,0,0.6)',
};

export function useTheme(): Palette {
  const { theme } = usePrefs();
  const system = useColorScheme();
  const dark = theme === 'dark' || (theme === 'system' && system === 'dark');
  return dark ? DARK : LIGHT;
}

/** A graded tile: its fill and the ink on it. */
export interface TileLook {
  bg: string;
  fg: string;
}

const TILES: Record<'light' | 'dark' | 'contrast', Record<Verdict, TileLook>> = {
  light: {
    right: { bg: '#1d8a52', fg: '#ffffff' },
    close: { bg: '#e2ab1f', fg: '#2a1d00' },
    wrong: { bg: '#68747f', fg: '#ffffff' },
  },
  dark: {
    right: { bg: '#2a9d62', fg: '#ffffff' },
    close: { bg: '#d6a82e', fg: '#201600' },
    wrong: { bg: '#3a4552', fg: '#e6ebf0' },
  },
  // Wordle's high-contrast pair: orange for right, blue for close.
  contrast: {
    right: { bg: '#f5793a', fg: '#1c0b00' },
    close: { bg: '#85c0f9', fg: '#06203a' },
    wrong: { bg: '#68747f', fg: '#ffffff' },
  },
};

/** The colours of right, close and wrong, in the player's theme and contrast. */
export function useTiles(): Record<Verdict, TileLook> {
  const c = useTheme();
  const { contrast } = usePrefs();
  if (contrast) return { ...TILES.contrast, wrong: TILES[c.dark ? 'dark' : 'light'].wrong };
  return TILES[c.dark ? 'dark' : 'light'];
}

/** Font families as loaded in app/_layout.tsx (Android picks weights by family, not fontWeight). Formulas use Arimo, the exam booklets' Arial. */
export const FONT = {
  ui: 'AtkinsonHyperlegibleNext_400Regular',
  uiBold: 'AtkinsonHyperlegibleNext_700Bold',
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  /** Arimo is metric-identical to Arial, the booklets' typeface; molecule labels use it. */
  mol: 'Arimo_400Regular',
  molBold: 'Arimo_700Bold',
  mono: 'monospace',
} as const;

/** The web app's type scale at phone width (17px body). */
export const SIZE = { small: 13.5, body: 17, step1: 20, step2: 24, step3: 30 } as const;

export const GUTTER = 16;
/** Readable column on tablets and phones turned sideways. */
export const COLUMN = 600;

/** The paper's soft drop shadow. */
export const paperShadow = (c: Palette) =>
  ({
    shadowColor: '#1e2a36',
    shadowOpacity: c.dark ? 0.5 : 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  }) as const;
