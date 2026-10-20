/** A card on the study board: colour strip, linked lesson and its mastery, due date, checklist. */
import { StyleSheet, Text, View } from 'react-native';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import type { BoardCard, CardColor } from '../../../src/study/board.ts';
import { LEVEL_LABEL, type LessonMastery, daysUntil } from '../../../src/study/progress.ts';
import { go } from '../lib/nav.ts';
import { MasteryTile } from '../progress/MasteryTile.tsx';
import { FONT, type Palette, useTheme } from '../theme.ts';
import { CheckIcon } from '../ui/Icons.tsx';
import { Press } from '../ui/kit.tsx';

export const COLORS: Array<{ id: CardColor; label: string }> = [
  { id: 'none', label: 'Sem cor' },
  { id: 'magenta', label: 'Magenta' },
  { id: 'cobalt', label: 'Azul' },
  { id: 'green', label: 'Verde' },
  { id: 'amber', label: 'Âmbar' },
];

export function colorOf(c: Palette, color: CardColor): string | undefined {
  switch (color) {
    case 'magenta':
      return c.magenta;
    case 'cobalt':
      return c.cobalt;
    case 'green':
      return c.right;
    case 'amber':
      return c.amber;
    default:
      return undefined;
  }
}

export function dueLabel(due?: string): { text: string; tone: 'late' | 'soon' | 'later' } | undefined {
  const d = daysUntil(due ?? '');
  if (d === undefined) return undefined;
  if (d < 0) return { text: `atrasada ${-d}d`, tone: 'late' };
  if (d === 0) return { text: 'hoje', tone: 'soon' };
  if (d === 1) return { text: 'amanhã', tone: 'soon' };
  return { text: new Date(`${due}T12:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }), tone: 'later' };
}

export function BoardCardView({
  card,
  level,
  onPress,
  onLongPress,
}: {
  card: BoardCard;
  level?: LessonMastery;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const c = useTheme();
  const lesson = card.lessonId ? LESSON_BY_ID[card.lessonId] : undefined;
  const due = dueLabel(card.due);
  const done = card.checklist.filter((x) => x.done).length;
  const strip = colorOf(c, card.color);
  const dueLook = due?.tone === 'late' ? { bg: c.wrongWash, fg: c.wrong } : due?.tone === 'soon' ? { bg: c.amberWash, fg: c.amber } : { bg: c.bench, fg: c.text };
  return (
    <Press
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}${lesson ? `, lição ${lesson.title}` : ''}`}
      accessibilityHint="Toque para abrir; segure para mover"
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.benchDeep }]}
    >
      {strip && <View style={[styles.strip, { backgroundColor: strip }]} />}
      <View style={styles.top}>
        {lesson && <MasteryTile symbol={lesson.element.symbol} level={level?.level ?? 'nova'} size={30} />}
        <Text style={[styles.title, { color: c.text }]}>{card.title}</Text>
      </View>
      {card.notes ? (
        <Text style={[styles.notes, { color: c.muted }]} numberOfLines={3}>
          {card.notes}
        </Text>
      ) : null}
      {(lesson || due || card.checklist.length > 0) && (
        <View style={styles.meta}>
          {lesson && level && (
            <Text style={[styles.level, { color: c.muted }]}>
              {level.level === 'nova' ? 'não começou' : `${Math.round(level.mastery * 100)}% · ${LEVEL_LABEL[level.level].toLowerCase()}`}
            </Text>
          )}
          {due && (
            <View style={[styles.pill, { backgroundColor: dueLook.bg }]}>
              <Text style={[styles.pillText, { color: dueLook.fg }]}>{due.text}</Text>
            </View>
          )}
          {card.checklist.length > 0 && (
            <View style={[styles.pill, { backgroundColor: c.bench }]}>
              <CheckIcon width={13} height={13} color={c.text} />
              <Text style={[styles.pillText, { color: c.text }]}>
                {done}/{card.checklist.length}
              </Text>
            </View>
          )}
          {lesson && (
            <Press
              onPress={() => go({ name: 'lesson', id: lesson.id })}
              accessibilityRole="link"
              accessibilityLabel={`Praticar ${lesson.title}`}
              hitSlop={8}
              style={[styles.go, { borderColor: c.magenta }]}
            >
              <Text style={[styles.goText, { color: c.magenta }]}>Praticar</Text>
            </Press>
          )}
        </View>
      )}
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 6, overflow: 'hidden' },
  strip: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FONT.uiBold, fontSize: 16, lineHeight: 21 },
  notes: { fontFamily: FONT.ui, fontSize: 14, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  level: { fontFamily: FONT.uiBold, fontSize: 12.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999 },
  pillText: { fontFamily: FONT.uiBold, fontSize: 12.5 },
  go: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, borderWidth: 2 },
  goText: { fontFamily: FONT.uiBold, fontSize: 13 },
});
