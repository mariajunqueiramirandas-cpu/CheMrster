/** A lesson's theory as one page (src/app/screens/TheoryScreen.tsx), to read again before an exam or a review. */
import { StyleSheet, View } from 'react-native';
import { LESSON_BY_ID, LESSONS, unitOf } from '../../../src/course/course.ts';
import { useProgress } from '../../../src/app/store.ts';
import { go } from '../lib/nav.ts';
import { useTheme } from '../theme.ts';
import { BackBar } from '../ui/Bars.tsx';
import { ElementTile } from '../ui/ElementTile.tsx';
import { TheoryActions, TheoryCardView } from '../ui/TheoryCardView.tsx';
import { Btn, Press, Txt } from '../ui/kit.tsx';
import { Page } from '../ui/Page.tsx';
import { router } from 'expo-router';

export function TheoryScreen({ id }: { id: string }) {
  const c = useTheme();
  const lesson = LESSON_BY_ID[id];
  const progress = useProgress();
  if (!lesson?.theory?.length) {
    return (
      <Page header={<BackBar title="Teoria" />}>
        <Txt>Teoria não encontrada.</Txt>
      </Page>
    );
  }
  const unit = unitOf(id);
  const at = LESSONS.indexOf(lesson);
  const prev = LESSONS[at - 1];
  const next = LESSONS[at + 1];
  // Paging between lessons replaces this page instead of piling pages up.
  const open = (other: string) => router.replace(`/teoria/${encodeURIComponent(other)}`);
  return (
    <Page header={<BackBar title="Teoria" />}>
      <View style={styles.head}>
        <ElementTile lesson={lesson} state={progress.completed[id] ? 'done' : 'current'} size="large" />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="kicker" tone="magenta">
            {unit.title}
          </Txt>
          <Txt variant="display">{lesson.title}</Txt>
          <Txt tone="muted">{lesson.summary}</Txt>
        </View>
      </View>
      {lesson.theory.map((card, i) => (
        <View key={i} style={[styles.card, { borderTopColor: c.benchDeep }]}>
          <TheoryCardView card={card} compact />
          <TheoryActions lessonId={id} index={i} card={card} />
        </View>
      ))}
      <View style={styles.actions}>
        <Btn kind="primary" wide label={progress.completed[id] ? 'Praticar de novo' : 'Começar lição'} onPress={() => go({ name: 'lesson', id })} />
        <View style={styles.nav}>
          {prev?.theory?.length ? (
            <Press onPress={() => open(prev.id)} style={{ flex: 1 }} accessibilityRole="link">
              <Txt variant="strong">← {prev.title}</Txt>
            </Press>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {next?.theory?.length ? (
            <Press onPress={() => open(next.id)} style={{ flex: 1 }} accessibilityRole="link">
              <Txt variant="strong" style={{ textAlign: 'right' }}>
                {next.title} →
              </Txt>
            </Press>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 8 },
  card: { paddingTop: 20, marginTop: 20, borderTopWidth: 2, gap: 4 },
  actions: { gap: 18, marginTop: 28 },
  nav: { flexDirection: 'row', gap: 12 },
});
