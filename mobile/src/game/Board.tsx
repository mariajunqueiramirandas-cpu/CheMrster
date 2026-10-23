/**
 * The guesses as rows of tiles, Wordle-style: one tile per piece of the name, turned over one by
 * one to show right, close or wrong. The draft row is the one being built; tapping its tiles
 * takes pieces back out.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { toast } from '../../../src/app/toast.ts';
import type { Graded, Verdict } from '../../../src/nomenclatura/grade.ts';
import { type Category, type Guess, OPTIONAL, SLOTS, SLOT_LABEL, type Slot, compose, piece } from '../../../src/nomenclatura/pieces.ts';
import { prefersReducedMotion } from '../lib/haptics.ts';
import { FONT, type Palette, type TileLook, useTheme, useTiles } from '../theme.ts';

/** How wide each slot is, relative to the others in its row. */
const WEIGHT: Record<Category, Partial<Record<Slot, number>>> = {
  acido: { prefixo: 1, radical: 1, sufixo: 1 },
  base: { cation: 1.7, valencia: 1 },
  sal: { prefixo: 1.45, radical: 1.1, sufixo: 0.95, cation: 1.45, valencia: 0.75 },
};

const GAP = 5;
const JOINER = 20;
const TILE_H = 46;

/** The "de" between anion and cation in a salt's row. */
const joinsAfter = (category: Category, slot: Slot) => category === 'sal' && slot === 'sufixo';

/** A piece as its tile shows it: no hyphens at the ends ("hipo", "ato"). */
const tileText = (slot: Slot, id: string | undefined) => (id === undefined ? '' : (piece(slot, id)?.label ?? id).replace(/^-|-$/g, ''));

const VERDICT_WORD: Record<Verdict, string> = { right: 'certo', close: 'quase', wrong: 'errado' };

/** Tile widths for a row this wide. */
function widths(category: Category, rowWidth: number): Partial<Record<Slot, number>> {
  const slots = SLOTS[category];
  const total = slots.reduce((s, slot) => s + (WEIGHT[category][slot] ?? 1), 0);
  const free = rowWidth - GAP * (slots.length - 1) - (category === 'sal' ? JOINER + GAP : 0);
  return Object.fromEntries(slots.map((s) => [s, (free * (WEIGHT[category][s] ?? 1)) / total]));
}

/** The largest size, up to 16, at which the text fits the tile on one line. */
const fit = (text: string, width: number) => Math.max(10, Math.min(16, (width - 8) / (Math.max(text.length, 1) * 0.6)));

function Face({ text, width, look, border, dashed }: { text: string; width: number; look: TileLook; border: string; dashed?: boolean }) {
  return (
    <View style={[styles.face, { width, backgroundColor: look.bg, borderColor: border, borderStyle: dashed ? 'dashed' : 'solid' }]}>
      <Text style={[styles.tileText, { color: look.fg, fontSize: fit(text, width) }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** A played tile; when `turn` is set it flips over after `delay` ms, and hops if the row won. */
function PlayedTile({
  text,
  width,
  look,
  front,
  turn,
  delay,
  hop,
}: {
  text: string;
  width: number;
  look: TileLook;
  front: { look: TileLook; border: string };
  turn: boolean;
  delay: number;
  hop: boolean;
}) {
  const animate = turn && !prefersReducedMotion();
  const flip = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) return;
    const steps: Animated.CompositeAnimation[] = [Animated.timing(flip, { toValue: 1, duration: 380, delay, useNativeDriver: true })];
    if (hop) {
      steps.push(
        Animated.sequence([
          Animated.delay(900 - delay + delay / 2),
          Animated.timing(lift, { toValue: -12, duration: 130, useNativeDriver: true }),
          Animated.spring(lift, { toValue: 0, useNativeDriver: true, bounciness: 14 }),
        ]),
      );
    }
    Animated.sequence(steps).start();
  }, [animate, delay, flip, hop, lift]);
  const rotateX = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] });
  const showFront = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] });
  const showBack = flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] });
  return (
    <Animated.View style={{ width, height: TILE_H, transform: [{ perspective: 500 }, { rotateX }, { translateY: lift }] }}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: showFront }]}>
        <Face text={text} width={width} look={front.look} border={front.border} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: showBack }]}>
        <Face text={text} width={width} look={look} border={look.bg} />
      </Animated.View>
    </Animated.View>
  );
}

function Joiner({ c }: { c: Palette }) {
  return <Text style={[styles.joiner, { color: c.muted }]}>de</Text>;
}

export function Board({
  category,
  guesses,
  graded,
  draft,
  rows,
  reveal,
  shake,
  onClear,
}: {
  category: Category;
  guesses: readonly Guess[];
  graded: readonly Graded[];
  draft: Guess | null;
  /** Rows to draw in all. */
  rows: number;
  /** The row turning over now (just played). */
  reveal: number | null;
  /** Shifts the draft row sideways when a guess is refused. */
  shake: Animated.Value;
  onClear: (slot: Slot) => void;
}) {
  const c = useTheme();
  const tiles = useTiles();
  const [rowWidth, setRowWidth] = useState(0);
  const w = widths(category, rowWidth);
  const slots = SLOTS[category];
  const blank: TileLook = { bg: 'transparent', fg: c.text };
  const filled: TileLook = { bg: c.surface, fg: c.text };

  const onLayout = (e: LayoutChangeEvent) => setRowWidth(Math.min(e.nativeEvent.layout.width, 460));

  return (
    <View onLayout={onLayout} style={styles.board}>
      {rowWidth > 0 && (
        <View style={styles.row} importantForAccessibility="no-hide-descendants">
          {slots.map((s) => (
            <View key={s} style={[styles.labelCell, { width: w[s] }, joinsAfter(category, s) && { marginRight: JOINER + GAP }]}>
              <Text style={[styles.label, { color: c.muted }]} numberOfLines={1}>
                {SLOT_LABEL[s]}
              </Text>
            </View>
          ))}
        </View>
      )}
      {rowWidth > 0 &&
        Array.from({ length: rows }, (_, i) => {
          const played = guesses[i];
          if (played) {
            const g = graded[i];
            const said = slots.map((s) => `${SLOT_LABEL[s]} ${VERDICT_WORD[g.verdicts[s] ?? 'wrong']}`).join(', ');
            return (
              <Pressable
                key={i}
                onPress={() => toast(compose(category, played))}
                accessibilityRole="button"
                accessibilityLabel={`Tentativa ${i + 1}: ${compose(category, played)}. ${said}.`}
                accessibilityHint="Mostra o nome dessa tentativa"
                style={styles.row}
              >
                {slots.map((s, k) => (
                  <View key={s} style={styles.cell}>
                    <PlayedTile
                      text={played[s] === undefined ? '—' : tileText(s, played[s])}
                      width={w[s] ?? 0}
                      look={tiles[g.verdicts[s] ?? 'wrong']}
                      front={{ look: filled, border: c.muted }}
                      turn={reveal === i}
                      delay={k * 160}
                      hop={reveal === i && g.solved}
                    />
                    {joinsAfter(category, s) && <Joiner c={c} />}
                  </View>
                ))}
              </Pressable>
            );
          }
          const isDraft = draft && i === guesses.length;
          return (
            <Animated.View
              key={i}
              style={[styles.row, isDraft ? { transform: [{ translateX: shake }] } : null]}
              accessibilityLabel={isDraft ? `Montando: ${compose(category, draft)}` : undefined}
            >
              {slots.map((s) => {
                const id = isDraft ? draft[s] : undefined;
                const optional = OPTIONAL.includes(s);
                const face = (
                  <Face
                    text={tileText(s, id)}
                    width={w[s] ?? 0}
                    look={id ? filled : blank}
                    border={id ? c.muted : isDraft ? c.rule : c.benchDeep}
                    dashed={!id && optional && !!isDraft}
                  />
                );
                return (
                  <View key={s} style={styles.cell}>
                    {isDraft && id ? (
                      <Pressable onPress={() => onClear(s)} accessibilityRole="button" accessibilityLabel={`Tirar ${tileText(s, id)}`}>
                        {face}
                      </Pressable>
                    ) : (
                      face
                    )}
                    {joinsAfter(category, s) && <Joiner c={c} />}
                  </View>
                );
              })}
            </Animated.View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: GAP + 1 },
  row: { flexDirection: 'row', gap: GAP, alignItems: 'center' },
  cell: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  labelCell: { alignItems: 'center' },
  label: { fontFamily: FONT.uiBold, fontSize: 10.5, letterSpacing: 0.3, textTransform: 'uppercase' },
  face: { height: TILE_H, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  tileText: { fontFamily: FONT.uiBold, textAlign: 'center' },
  joiner: { width: JOINER, textAlign: 'center', fontFamily: FONT.ui, fontSize: 14 },
});
