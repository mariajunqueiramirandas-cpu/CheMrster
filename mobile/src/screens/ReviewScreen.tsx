/** Daily review (src/app/screens/ReviewScreen.tsx): questions from every lesson whose review date has come, mixed. */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import { createRng } from '../../../src/course/random.ts';
import { buildReview } from '../../../src/course/review.ts';
import { syncAfterPractice } from '../../../src/app/board-store.ts';
import { INTERVALS, dueLessons, recordReview, useProgress } from '../../../src/app/store.ts';
import { back } from '../lib/nav.ts';
import { COLUMN, FONT, GUTTER, useTheme } from '../theme.ts';
import { ElementTile } from '../ui/ElementTile.tsx';
import { BoltIcon } from '../ui/Icons.tsx';
import { Btn, Txt } from '../ui/kit.tsx';
import { Missing } from './LessonScreen.tsx';
import { Practice, type PracticeItem, type PracticeResult } from './Practice.tsx';

const XP_PER_LESSON = 4;

export function ReviewScreen() {
  const progress = useProgress();
  // The deck is fixed when the review starts; finishing it moves the lessons out of "due".
  const [deck] = useState(() => dueLessons(progress).map((d) => d.id));
  const [seed] = useState(() => (Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const items = useMemo<PracticeItem[]>(
    () => buildReview(createRng(seed), deck).map((it, i) => ({ key: `r${i}`, lessonId: it.lessonId, exercise: it.exercise })),
    [deck, seed],
  );
  const [result, setResult] = useState<PracticeResult | null>(null);

  if (!items.length) return <Missing text="Nada para revisar hoje. Conclua lições na trilha e elas voltam aqui no tempo certo." />;
  if (result) return <ReviewDone result={result} />;

  return (
    <Practice
      items={items}
      source="review"
      onExit={back}
      label={(item) => LESSON_BY_ID[item.lessonId]?.title}
      onFinish={(r) => {
        recordReview(r.byLesson, XP_PER_LESSON * Object.keys(r.byLesson).length);
        syncAfterPractice(Object.keys(r.byLesson));
        setResult(r);
      }}
    />
  );
}

/** Same thresholds as the Leitner boxes: up a box, stay, or back to the start. */
const scoreLevel = (accuracy: number) => (accuracy >= 0.85 ? 'up' : accuracy >= 0.6 ? 'stay' : 'down');

function ReviewDone({ result }: { result: PracticeResult }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const ids = Object.keys(result.byLesson);
  const scoreColor = { up: c.right, stay: c.amber, down: c.wrong };
  return (
    <ScrollView style={{ backgroundColor: c.bench }} contentContainerStyle={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <Txt variant="display" style={{ textAlign: 'center' }}>
        Revisão feita
      </Txt>
      <Txt tone="muted" style={{ textAlign: 'center' }}>
        {Math.round(result.accuracy * 100)}% de acertos de primeira em {ids.length === 1 ? '1 lição' : `${ids.length} lições`}.
      </Txt>
      <View style={styles.list}>
        {ids.map((id) => {
          const lesson = LESSON_BY_ID[id];
          const days = INTERVALS[progress.completed[id]?.box ?? 1];
          const level = scoreLevel(result.byLesson[id]);
          return (
            <View key={id} style={[styles.row, { backgroundColor: c.surface, borderColor: c.rule }]}>
              <ElementTile lesson={lesson} state="done" size="small" />
              <View style={{ flex: 1 }}>
                <Txt variant="strong">{lesson.title}</Txt>
                <Txt variant="small" tone="muted">
                  <Text style={{ color: scoreColor[level], fontFamily: FONT.uiBold }}>{Math.round(result.byLesson[id] * 100)}%</Text> · volta{' '}
                  {days === 1 ? 'amanhã' : `em ${days} dias`}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.note}>
        <BoltIcon color={c.amber} width={18} height={18} />
        <Txt tone="muted" style={{ flex: 1 }}>
          +{XP_PER_LESSON * ids.length} XP. Acertou, o intervalo dobra; errou, a lição volta logo.
        </Txt>
      </View>
      <Btn kind="primary" wide label="Continuar" onPress={back} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: 16, paddingHorizontal: GUTTER + 8, maxWidth: COLUMN, alignSelf: 'center', width: '100%' },
  list: { alignSelf: 'stretch', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 2 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', alignSelf: 'stretch' },
});
