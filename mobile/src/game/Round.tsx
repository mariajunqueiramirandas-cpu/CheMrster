/**
 * One compound to name: its formula on paper, the board of guesses, and the keyboard; once the
 * round is over, the result and why. Daily and practice rounds are the same; they differ only in
 * where the guesses are kept (`guesses` and `onGuess`).
 */
import { type ComponentRef, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { toast } from '../../../src/app/toast.ts';
import { type Compound, TIER_LABEL } from '../../../src/nomenclatura/catalog.ts';
import { MAX_TRIES, grade, keyStates, roundState } from '../../../src/nomenclatura/grade.ts';
import { type Guess, type Piece, SLOTS, type Slot } from '../../../src/nomenclatura/pieces.ts';
import { haptic, prefersReducedMotion } from '../lib/haptics.ts';
import { COLUMN, GUTTER, LIGHT, paperShadow, useTheme } from '../theme.ts';
import { Txt } from '../ui/kit.tsx';
import { Board } from './Board.tsx';
import { Formula } from './Formula.tsx';
import { Keyboard } from './Keyboard.tsx';
import { RoundResult } from './Result.tsx';

/** A board row with its gap, and the slot labels above the rows. */
const ROW = 52;
const LABELS = 22;

const without = (g: Guess, slot: Slot): Guess => {
  const { [slot]: _, ...rest } = g;
  return rest;
};

/** How long a row takes to turn over. */
const flipMs = (tiles: number) => (prefersReducedMotion() ? 0 : (tiles - 1) * 160 + 420);

function Dots({ tier }: { tier: number }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Dificuldade: ${TIER_LABEL[tier as 1 | 2 | 3]}`}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i <= tier ? LIGHT.magenta : LIGHT.rule }]} />
      ))}
      <Txt variant="small" style={{ color: LIGHT.muted, marginLeft: 4 }}>
        {TIER_LABEL[tier as 1 | 2 | 3]}
      </Txt>
    </View>
  );
}

export function Round({
  compound,
  guesses,
  onGuess,
  kicker,
  children,
}: {
  compound: Compound;
  guesses: readonly Guess[];
  /** Plays a guess: why it was refused, or null when it counted. */
  onGuess: (g: Guess) => string | null;
  kicker: string;
  /** Under the result once the round is over: the way on. */
  children?: ReactNode;
}) {
  const c = useTheme();
  const short = useWindowDimensions().height < 780;
  const category = compound.category;
  const state = useMemo(() => roundState(compound, guesses), [compound, guesses]);
  const states = useMemo(() => keyStates(compound, guesses), [compound, guesses]);
  const [draft, setDraft] = useState<Guess>({});
  // The order pieces went in, so the delete key takes out the latest.
  const [order, setOrder] = useState<Slot[]>([]);
  const [reveal, setReveal] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(state.done);
  const shake = useRef(new Animated.Value(0)).current;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewHeight, setViewHeight] = useState(0);

  const place = (p: Piece) => {
    if (draft[p.slot] === p.id) return clear(p.slot);
    setDraft((d) => ({ ...d, [p.slot]: p.id }));
    setOrder((o) => [...o.filter((s) => s !== p.slot), p.slot]);
  };
  const clear = (slot: Slot) => {
    setDraft((d) => without(d, slot));
    setOrder((o) => o.filter((s) => s !== slot));
  };
  const back = () => {
    const last = order[order.length - 1];
    if (last) clear(last);
  };
  const refuse = (why: string) => {
    haptic('error');
    toast(why, undefined, 2200);
    if (prefersReducedMotion()) return;
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: true })),
    ).start();
  };
  const enter = () => {
    if (state.done) return;
    const why = onGuess(draft);
    if (why) return refuse(why);
    const solved = grade(compound, draft).solved;
    const last = guesses.length + 1 >= MAX_TRIES;
    setReveal(guesses.length);
    setDraft({});
    setOrder([]);
    setTimeout(() => haptic(solved ? 'success' : last ? 'error' : 'tap'), flipMs(SLOTS[category].length));
  };

  // A physical keyboard (on the web): Enter sends, Backspace deletes.
  const keys = useRef({ enter, back });
  keys.current = { enter, back };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // A focused button handles its own Enter, and an open sheet owns the keyboard.
      const target = e.target as HTMLElement | null;
      if (e.defaultPrevented || target?.closest?.('[role="button"],[role="tab"],[role="switch"],button,input') || document.querySelector('[aria-modal="true"]')) return;
      if (e.key === 'Enter') keys.current.enter();
      else if (e.key === 'Backspace') keys.current.back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The result comes in once the last row has turned over (and hopped, on a win).
  useEffect(() => {
    if (!state.done) return setShowResult(false);
    if (reveal === null) return setShowResult(true);
    const t = setTimeout(() => setShowResult(true), flipMs(SLOTS[category].length) + (state.won ? 700 : 250));
    return () => clearTimeout(t);
  }, [state.done]);

  // Keep the row being built at the bottom of the view as the board fills up.
  useEffect(() => {
    if (state.done || !viewHeight) return;
    scroll.current?.scrollTo({ y: Math.max(0, LABELS + (guesses.length + 1) * ROW - viewHeight), animated: true });
  }, [guesses.length, state.done, viewHeight]);
  // Then the last row and the result under it.
  useEffect(() => {
    if (showResult && reveal !== null) setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, LABELS + (guesses.length - 1) * ROW - 8), animated: true }), 50);
  }, [showResult]);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={[styles.paper, { backgroundColor: c.paper }, paperShadow(c)]}>
          <View style={styles.paperHead}>
            <Txt variant="kicker" style={{ color: LIGHT.magenta }}>
              {kicker}
            </Txt>
            <Dots tier={compound.tier} />
          </View>
          <Formula formula={compound.formula} size={short ? 32 : 40} color={c.ink} style={{ minHeight: short ? 40 : 50 }} />
        </View>
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setViewHeight(e.nativeEvent.layout.height)}
      >
        <Board
          category={category}
          guesses={state.guesses}
          graded={state.graded}
          draft={state.done ? null : draft}
          rows={state.done ? state.guesses.length : MAX_TRIES}
          reveal={reveal}
          shake={shake}
          onClear={clear}
        />
        {showResult && (
          <RoundResult compound={compound} state={state}>
            {children}
          </RoundResult>
        )}
      </ScrollView>
      {!state.done && <Keyboard category={category} draft={draft} states={states} onKey={place} onBack={back} onEnter={enter} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 10, width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  paper: { borderRadius: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, alignItems: 'center', gap: 2 },
  paperHead: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 2, paddingBottom: 24, gap: 16, width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
});

