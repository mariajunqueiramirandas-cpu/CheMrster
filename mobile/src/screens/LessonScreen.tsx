/** A lesson (src/app/screens/LessonScreen.tsx): its theory cards, then generated exercises, then the result. */
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, PanResponder, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSON_BY_ID, unitOf } from '../../../src/course/course.ts';
import { createRng } from '../../../src/course/random.ts';
import type { TheoryCard } from '../../../src/course/types.ts';
import { syncAfterPractice } from '../../../src/app/board-store.ts';
import { INTERVALS, currentStreak, recordLesson, recordStudyTime, useProgress } from '../../../src/app/store.ts';
import { haptic, prefersReducedMotion } from '../lib/haptics.ts';
import { back } from '../lib/nav.ts';
import { COLUMN, FONT, GUTTER, useTheme } from '../theme.ts';
import { ElementTile } from '../ui/ElementTile.tsx';
import { BoltIcon, CheckIcon, CloseIcon, FlameIcon } from '../ui/Icons.tsx';
import { TheoryActions, TheoryCardView } from '../ui/TheoryCardView.tsx';
import { Btn, IconBtn, Meter, Press, Txt } from '../ui/kit.tsx';
import { Practice, type PracticeItem } from './Practice.tsx';

const XP_BASE = 10;
const XP_PERFECT = 5;

export function LessonScreen({ id }: { id: string }) {
  const lesson = LESSON_BY_ID[id];
  const [seed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const items = useMemo<PracticeItem[]>(
    () => (lesson?.generate?.(createRng(seed)) ?? []).map((exercise, i) => ({ key: `q${i}`, lessonId: id, exercise })),
    [lesson, seed, id],
  );
  const [phase, setPhase] = useState<'theory' | 'practice'>(lesson?.theory?.length ? 'theory' : 'practice');
  const [finished, setFinished] = useState<null | { accuracy: number; xp: number }>(null);

  if (!lesson?.generate) return <Missing text="Esta lição ainda não está disponível." />;
  if (finished) return <LessonDone lessonId={id} accuracy={finished.accuracy} xp={finished.xp} />;
  if (phase === 'theory') return <TheoryPhase lessonId={id} cards={lesson.theory!} onDone={() => setPhase('practice')} onExit={back} />;

  return (
    <Practice
      items={items}
      source="lesson"
      onExit={back}
      onFinish={({ accuracy }) => {
        const xp = XP_BASE + (accuracy === 1 ? XP_PERFECT : 0);
        recordLesson(id, accuracy, xp);
        syncAfterPractice([id]);
        setFinished({ accuracy, xp });
      }}
    />
  );
}

/** Nothing to practise: say so, with the way back. */
export function Missing({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={[styles.missing, { backgroundColor: c.bench }]}>
      <Txt style={{ textAlign: 'center' }}>{text}</Txt>
      <Btn kind="primary" label="Voltar para a trilha" onPress={back} />
    </View>
  );
}

/** Teach first: the lesson's cards one at a time (swipe sideways to page), then the exercises. */
function TheoryPhase({ lessonId, cards, onDone, onExit }: { lessonId: string; cards: TheoryCard[]; onDone: () => void; onExit: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const last = index === cards.length - 1;
  const shownAt = useRef(Date.now());
  const scroll = useRef<ScrollViewInstance>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const go = (to: number) => {
    if (!prefersReducedMotion()) slide.setValue(to < index ? -28 : 28);
    setIndex(to);
  };
  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, [index, slide]);

  // Swipe left for the next card, right for the one before.
  const forward = useRef(() => {});
  const backward = useRef(() => {});
  forward.current = () => {
    haptic('tap');
    if (last) onDone();
    else go(index + 1);
  };
  backward.current = () => {
    if (index === 0) return;
    haptic('tap');
    go(index - 1);
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) forward.current();
        else if (g.dx > 60) backward.current();
      },
    }),
  ).current;

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    shownAt.current = Date.now();
    // Reading a card counts as study time when the learner moves on.
    return () => recordStudyTime(Date.now() - shownAt.current);
  }, [index]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) go(index - 1);
      else onExit();
      return true;
    });
    return () => sub.remove();
  });

  return (
    <View style={[styles.root, { backgroundColor: c.bench, paddingTop: insets.top }]} {...pan.panHandlers}>
      <View style={styles.bar}>
        <IconBtn label="Sair da lição" onPress={onExit}>
          <CloseIcon color={c.muted} />
        </IconBtn>
        <Meter value={(index + 1) / cards.length} height={14} color={c.cobalt} style={{ flex: 1 }} />
        <Press onPress={onDone} accessibilityRole="button" accessibilityLabel="Pular a teoria e ir para os exercícios" hitSlop={8}>
          <Text style={[styles.skip, { color: c.muted }]}>Pular</Text>
        </Press>
      </View>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.main}>
        <Animated.View style={[styles.column, { transform: [{ translateX: slide }], opacity: slide.interpolate({ inputRange: [-28, 0, 28], outputRange: [0, 1, 0] }) }]}>
          <Txt variant="kicker" tone="magenta">
            Teoria · {index + 1} de {cards.length}
          </Txt>
          <TheoryCardView key={index} card={cards[index]} animate />
          <TheoryActions lessonId={lessonId} index={index} card={cards[index]} />
        </Animated.View>
      </ScrollView>
      <View style={[styles.foot, { borderTopColor: c.benchDeep, paddingBottom: insets.bottom + 14 }]}>
        <View style={[styles.column, styles.footRow]}>
          {index > 0 && <Btn label="Voltar" onPress={() => go(index - 1)} />}
          <Btn kind="primary" label={last ? 'Praticar' : 'Continuar'} onPress={() => (last ? onDone() : go(index + 1))} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

function LessonDone({ lessonId, accuracy, xp }: { lessonId: string; accuracy: number; xp: number }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const lesson = LESSON_BY_ID[lessonId];
  const progress = useProgress();
  const unit = unitOf(lessonId);
  const streak = currentStreak(progress);
  const box = progress.completed[lessonId]?.box ?? 1;
  const days = INTERVALS[box];
  useEffect(() => haptic('done'), []);
  return (
    <ScrollView style={{ backgroundColor: c.bench }} contentContainerStyle={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <ElementTile lesson={lesson} state="done" size="large" />
      <Txt variant="display" style={{ textAlign: 'center' }}>
        Lição concluída
      </Txt>
      <Txt tone="muted" style={{ textAlign: 'center' }}>
        {lesson.title}, em {unit.title.toLowerCase()}.
      </Txt>
      <View style={styles.stats}>
        <Stat icon={<BoltIcon color={c.amber} width={18} height={18} />} label="XP ganho" value={`+${xp}`} />
        <Stat icon={<CheckIcon color={c.right} width={18} height={18} />} label="Acertos de primeira" value={`${Math.round(accuracy * 100)}%`} />
        <Stat icon={<FlameIcon color={c.magenta} width={18} height={18} />} label="Dias seguidos" value={String(streak)} />
      </View>
      <Txt tone="muted" style={{ textAlign: 'center' }}>
        Esta lição volta na revisão {days === 1 ? 'amanhã' : `daqui a ${days} dias`}: relembrar no tempo certo fixa o conteúdo.
      </Txt>
      <Btn kind="primary" wide label="Continuar" onPress={back} />
    </ScrollView>
  );
}

export function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.rule }]}>
      <View style={styles.statLabel}>
        {icon}
        <Text style={[styles.statLabelText, { color: c.muted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER - 6, paddingVertical: 6 },
  skip: { fontFamily: FONT.uiBold, fontSize: 16, paddingHorizontal: 6 },
  main: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 24 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center', gap: 14 },
  foot: { paddingTop: 14, paddingHorizontal: GUTTER, borderTopWidth: 2 },
  footRow: { flexDirection: 'row', gap: 10 },
  done: { alignItems: 'center', gap: 16, paddingHorizontal: GUTTER + 8, maxWidth: COLUMN, alignSelf: 'center', width: '100%' },
  stats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginVertical: 8 },
  stat: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 12, gap: 6 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabelText: { fontFamily: FONT.uiBold, fontSize: 12, flexShrink: 1 },
  statValue: { fontFamily: FONT.displayHeavy, fontSize: 26 },
});
