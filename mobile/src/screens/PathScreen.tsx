/** The track (src/app/screens/PathScreen.tsx): lessons as element tiles strung along a zig-zag chain. */
import { useScrollToTop } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { COURSE, LESSON_BY_ID, LESSONS } from '../../../src/course/course.ts';
import type { Lesson, Unit } from '../../../src/course/types.ts';
import { useSettings } from '../../../src/app/settings.ts';
import { type Progress, dayKey, dueLessons, nextReviewIn, useProgress } from '../../../src/app/store.ts';
import { go } from '../lib/nav.ts';
import { COLUMN, FONT, GUTTER, SIZE, useTheme } from '../theme.ts';
import { TopBar } from '../ui/Bars.tsx';
import { ElementTile, type TileState } from '../ui/ElementTile.tsx';
import { ArrowRightIcon, BoltIcon } from '../ui/Icons.tsx';
import { Btn, Card, Meter, Press, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const ROW = 112;
const SWING = 64;

export function PathScreen() {
  const c = useTheme();
  const progress = useProgress();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState<Lesson | null>(null);
  const playable = LESSONS.filter((l) => l.generate);
  const doneCount = playable.filter((l) => progress.completed[l.id]).length;
  const currentId = playable.find((l) => !progress.completed[l.id])?.id;
  const current = currentId ? LESSON_BY_ID[currentId] : undefined;

  const scroll = useRef<ScrollViewInstance>(null);
  useScrollToTop(scroll);
  // Where the next lesson's tile sits in the page, and what is on screen.
  const currentY = useRef<number | undefined>(undefined);
  const jumped = useRef(false);
  const [offscreen, setOffscreen] = useState(false);
  const viewport = useRef({ y: 0, h: height });
  const updateOffscreen = () => {
    const y = currentY.current;
    if (y === undefined) return setOffscreen(false);
    const { y: top, h } = viewport.current;
    setOffscreen(y + 60 < top + 64 || y > top + h - 140);
  };
  // Back on the track: start where the learner left off, not at the top of unit one.
  const onCurrentLayout = (y: number) => {
    currentY.current = y;
    if (!jumped.current && doneCount > 0) {
      jumped.current = true;
      scroll.current?.scrollTo({ y: Math.max(0, y - height / 2 + 60), animated: false });
    }
    updateOffscreen();
  };

  const stateOf = (lesson: Lesson): TileState => {
    if (!lesson.generate) return 'soon';
    if (progress.completed[lesson.id]) return 'done';
    if (lesson.id === currentId) return 'current';
    return 'locked';
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bench }}>
      <TopBar />
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        scrollEventThrottle={64}
        onLayout={(e) => (viewport.current.h = e.nativeEvent.layout.height)}
        onScroll={(e) => {
          viewport.current.y = e.nativeEvent.contentOffset.y;
          updateOffscreen();
        }}
      >
        <View style={styles.column}>
          <View style={styles.head}>
            <Txt variant="display" accessibilityRole="header">
              Química orgânica
            </Txt>
            <Txt tone="muted" style={{ marginTop: 6 }}>
              Do carbono às proteínas, no ritmo do ENEM. {doneCount} de {playable.length} lições concluídas.
            </Txt>
            <Meter value={doneCount / playable.length} style={{ marginTop: 14 }} />
          </View>

          <TodayCard progress={progress} />
          <ReviewCard progress={progress} />

          {COURSE.map((unit) => (
            <UnitChain key={unit.id} unit={unit} stateOf={stateOf} onSelect={setOpen} currentId={currentId} onCurrentLayout={onCurrentLayout} />
          ))}
        </View>
      </ScrollView>

      {current && offscreen && !open && (
        <Press
          onPress={() => go({ name: 'lesson', id: current.id })}
          style={[styles.continue, { backgroundColor: c.magenta, shadowColor: c.magentaPress }]}
          accessibilityRole="button"
          accessibilityLabel={`Continuar: ${current.title}`}
        >
          <View style={styles.continueTile}>
            <Text style={[styles.continueSymbol, { color: c.magenta }]}>{current.element.symbol}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.continueKicker}>Continuar</Text>
            <Text style={styles.continueTitle} numberOfLines={1}>
              {current.title}
            </Text>
          </View>
          <ArrowRightIcon color="#fff" />
        </Press>
      )}

      {open && <LessonSheet lesson={open} state={stateOf(open)} onClose={() => setOpen(null)} />}
    </View>
  );
}

/** Today's XP against the daily goal, with the way to the full progress page. */
function TodayCard({ progress }: { progress: Progress }) {
  const c = useTheme();
  const { dailyGoal } = useSettings();
  const xp = progress.days[dayKey(new Date())]?.xp ?? 0;
  if (!progress.xp) return null;
  return (
    <Press onPress={() => go({ name: 'progress' })} accessibilityRole="link" style={{ marginTop: 18 }}>
      <Card style={styles.today}>
        <View style={{ flex: 1 }}>
          <Txt variant="strong">
            Hoje: {xp} de {dailyGoal} XP
          </Txt>
          <Txt variant="small" tone="muted">
            {xp >= dailyGoal ? 'Meta cumprida' : 'Ver seu progresso'}
          </Txt>
        </View>
        <Meter value={xp / dailyGoal} height={8} style={{ width: 96 }} color={xp >= dailyGoal ? c.right : undefined} />
      </Card>
    </Press>
  );
}

/** Spaced review: lessons come back after 1, 2, 4, 8 and 16 days, sooner when they went badly. */
function ReviewCard({ progress }: { progress: Progress }) {
  const c = useTheme();
  const due = dueLessons(progress);
  const wait = nextReviewIn(progress);
  if (wait === undefined) return null;
  if (!due.length) {
    return (
      <Txt tone="muted" style={styles.reviewIdle}>
        Revisão em dia: a próxima lição volta {wait <= 1 ? 'amanhã' : `em ${wait} dias`}.
      </Txt>
    );
  }
  const titles = due
    .slice(0, 4)
    .map((d) => LESSON_BY_ID[d.id]?.title)
    .filter(Boolean);
  return (
    <View style={[styles.review, { backgroundColor: c.magentaWash, borderColor: c.magenta }]}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Txt variant="heading">Revisão do dia</Txt>
        <Txt variant="small" tone="muted" style={{ marginTop: 2 }}>
          {titles.join(' · ')}
          {due.length > 4 ? ` e mais ${due.length - 4}` : ''}
        </Txt>
      </View>
      <Btn kind="primary" label="Revisar" icon={(color) => <BoltIcon color={color} width={20} height={20} />} onPress={() => go({ name: 'review' })} />
    </View>
  );
}

/** A unit: its title, then tiles on the vertices of a zig-zag chain, drawn like a skeletal formula. */
function UnitChain({
  unit,
  stateOf,
  onSelect,
  currentId,
  onCurrentLayout,
}: {
  unit: Unit;
  stateOf: (l: Lesson) => TileState;
  onSelect: (l: Lesson) => void;
  currentId?: string;
  /** Where the next lesson's tile is in the page, once this unit has been laid out. */
  onCurrentLayout: (y: number) => void;
}) {
  const c = useTheme();
  const { lessons } = unit;
  const height = (lessons.length - 1) * ROW + 120;
  const xs = lessons.map((_, i) => (i % 2 === 0 ? -SWING : SWING));
  const at = lessons.findIndex((l) => l.id === currentId);
  // The unit's place in the column and the chain's place in the unit arrive separately.
  const place = useRef<{ unit?: number; chain?: number }>({});
  const report = () => {
    const { unit: u, chain } = place.current;
    if (at >= 0 && u !== undefined && chain !== undefined) onCurrentLayout(u + chain + at * ROW);
  };
  return (
    <View
      style={styles.unit}
      onLayout={(e) => {
        place.current.unit = e.nativeEvent.layout.y;
        report();
      }}
    >
      <View style={[styles.unitHead, { borderLeftColor: c.magenta }]}>
        <Txt variant="title" accessibilityRole="header">
          {unit.title}
        </Txt>
        <Txt tone="muted" style={{ marginTop: 4 }}>
          {unit.description}
        </Txt>
      </View>
      <View
        style={[styles.chain, { height }]}
        onLayout={(e) => {
          place.current.chain = e.nativeEvent.layout.y;
          report();
        }}
      >
        <Svg style={styles.bonds} width={200} height={height} viewBox={`-100 0 200 ${height}`}>
          {lessons.slice(1).map((l, i) => {
            const done = stateOf(lessons[i]) === 'done' && stateOf(l) !== 'locked' && stateOf(l) !== 'soon';
            return (
              <Line
                key={l.id}
                x1={xs[i]}
                y1={i * ROW + 44}
                x2={xs[i + 1]}
                y2={(i + 1) * ROW + 44}
                stroke={done ? c.magenta : c.rule}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
        {lessons.map((lesson, i) => {
          const state = stateOf(lesson);
          return (
            <View key={lesson.id} style={[styles.node, { top: i * ROW, left: '50%', marginLeft: xs[i] - 84 }]}>
              <ElementTile lesson={lesson} state={state} onSelect={() => onSelect(lesson)} />
              <Text
                style={[
                  styles.chainTitle,
                  { backgroundColor: c.bench, color: state === 'locked' || state === 'soon' ? c.muted : c.text },
                  state !== 'locked' && state !== 'soon' && { fontFamily: FONT.uiBold },
                ]}
                numberOfLines={2}
              >
                {lesson.title}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LessonSheet({ lesson, state, onClose }: { lesson: Lesson; state: TileState; onClose: () => void }) {
  const playable = state === 'done' || state === 'current';
  const start = () => {
    onClose();
    go({ name: 'lesson', id: lesson.id });
  };
  return (
    <Sheet visible onClose={onClose}>
      <View style={styles.sheetBody}>
        <ElementTile lesson={lesson} state={state} size="large" />
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="title">{lesson.title}</Txt>
          <Txt tone="muted">{lesson.summary}</Txt>
          {state === 'locked' && (
            <Txt variant="small" tone="magenta" style={{ fontFamily: FONT.uiBold }}>
              Conclua a lição anterior para liberar esta.
            </Txt>
          )}
          {state === 'soon' && (
            <Txt variant="small" tone="magenta" style={{ fontFamily: FONT.uiBold }}>
              Esta lição ainda está sendo escrita.
            </Txt>
          )}
        </View>
      </View>
      <View style={styles.sheetActions}>
        {playable && <Btn kind="primary" wide label={state === 'done' ? 'Praticar de novo' : 'Começar lição'} onPress={start} />}
        {state === 'locked' && <Btn kind="primary" wide label="Fazer mesmo assim" onPress={start} />}
        {!!lesson.theory?.length && state !== 'soon' && (
          <Btn
            wide
            label="Ver teoria"
            onPress={() => {
              onClose();
              go({ name: 'theory', id: lesson.id });
            }}
          />
        )}
        <Btn kind="quiet" wide label="Fechar" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  head: { paddingTop: 8, paddingBottom: 4 },
  today: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  reviewIdle: { marginTop: 18, fontSize: SIZE.small + 1 },
  review: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 2 },
  unit: { marginTop: 36 },
  unitHead: { paddingLeft: 14, borderLeftWidth: 4 },
  chain: { width: '100%', maxWidth: 320, alignSelf: 'center', marginTop: 26 },
  bonds: { position: 'absolute', top: 0, left: '50%', marginLeft: -100 },
  node: { position: 'absolute', width: 168, alignItems: 'center', gap: 6 },
  chainTitle: { paddingHorizontal: 8, borderRadius: 6, fontFamily: FONT.ui, fontSize: SIZE.small, lineHeight: SIZE.small * 1.3, textAlign: 'center' },
  continue: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    elevation: 6,
  },
  continueTile: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  continueSymbol: { fontFamily: FONT.displayHeavy, fontSize: 20 },
  continueKicker: { color: '#fff', opacity: 0.85, fontFamily: FONT.ui, fontSize: 13 },
  continueTitle: { color: '#fff', fontFamily: FONT.uiBold, fontSize: 16 },
  sheetBody: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  sheetActions: { gap: 10, marginTop: 20 },
});
