/**
 * Drawing styles. Every length is a fraction of the bond length, so a style scales
 * without changing its proportions. `acs` follows the ACS Document 1996 settings
 * used by most chemistry journals (bond 14.4 pt, line 0.6 pt, Arial 10 pt, ...).
 */
import { DEFAULT_FONT_FAMILY } from './font.ts';

export interface DrawStyle {
  /** Bond length in output units (px). */
  bondLength: number;
  lineWidth: number;
  /** Distance between the two strokes of a double bond. */
  bondSpacing: number;
  /** Width of the wide end of a wedge. */
  wedgeWidth: number;
  /** Distance between hash strokes. */
  hashSpacing: number;
  /** Clear space between a bond end and an atom label. */
  labelMargin: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  subscriptScale: number;
  padding: number;
  /** Colour of bonds and carbon/hydrogen labels; 'currentColor' follows the page text colour. */
  ink: string;
  /** 'mono' prints everything in ink; 'color' tints heteroatom labels. */
  palette: 'mono' | 'color';
}

const ACS: DrawStyle = {
  bondLength: 14.4,
  lineWidth: 0.6 / 14.4,
  bondSpacing: 0.18,
  wedgeWidth: 2.4 / 14.4,
  hashSpacing: 2.5 / 14.4,
  labelMargin: 1.6 / 14.4,
  fontSize: 10 / 14.4,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: 400,
  subscriptScale: 0.72,
  padding: 0.35,
  ink: 'currentColor',
  palette: 'mono',
};

export const STYLES = {
  /** Journal print: thin hairlines, generous labels. */
  acs: ACS,
  /** Screen-first textbook look: slightly heavier strokes that survive small sizes. */
  textbook: {
    ...ACS,
    bondLength: 40,
    lineWidth: 0.05,
    bondSpacing: 0.17,
    wedgeWidth: 0.19,
    hashSpacing: 0.16,
    labelMargin: 0.1,
    fontSize: 0.62,
  } satisfies DrawStyle,
  /** Large, bold strokes for lesson cards on phones. */
  card: {
    ...ACS,
    bondLength: 44,
    lineWidth: 0.065,
    bondSpacing: 0.19,
    wedgeWidth: 0.22,
    hashSpacing: 0.17,
    labelMargin: 0.11,
    fontSize: 0.6,
    fontWeight: 500,
    palette: 'color',
  } satisfies DrawStyle,
} as const;

export type StyleName = keyof typeof STYLES;

export function resolveStyle(style?: StyleName | Partial<DrawStyle>): DrawStyle {
  if (!style) return STYLES.textbook;
  if (typeof style === 'string') return STYLES[style];
  return { ...STYLES.textbook, ...style };
}
