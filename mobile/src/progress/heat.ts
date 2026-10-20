/** The magenta heat scale of the progress page (src/app/styles/progress.css), light and dark. */
import type { MasteryLevel } from '../../../src/study/progress.ts';
import type { Palette } from '../theme.ts';

const LIGHT = { 1: '#e98ec0', 2: '#d4559b', 3: '#b0136f', 4: '#6b0a44', ink1: '#3d0726', ink2: '#ffffff', ink3: '#ffffff' };
const DARK = { 1: '#913069', 2: '#b9408a', 3: '#df5ca8', 4: '#f8b0d6', ink1: '#ffffff', ink2: '#ffffff', ink3: '#2a0619' };

export function heat(c: Palette) {
  const h = c.dark ? DARK : LIGHT;
  return {
    /** Background for heat level 0–4 (calendar cells). */
    cell: (level: number) => (level <= 0 ? c.benchDeep : h[Math.min(4, level) as 1 | 2 | 3 | 4]),
    /** A lesson tile coloured by how well it is known. */
    tile: (level: MasteryLevel) =>
      level === 'nova'
        ? { bg: 'transparent', fg: c.muted, border: c.rule, dashed: true, edge: undefined as string | undefined }
        : level === 'fraca'
          ? { bg: h[1], fg: h.ink1, border: 'transparent', dashed: false, edge: undefined }
          : level === 'media'
            ? { bg: h[2], fg: h.ink2, border: 'transparent', dashed: false, edge: undefined }
            : { bg: h[3], fg: h.ink3, border: 'transparent', dashed: false, edge: h[4] },
  };
}
