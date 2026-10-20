/** A theory card (src/app/components/TheoryCardView.tsx): text, drawings to look at, and how the ENEM asks. */
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { TheoryCard } from '../../../src/course/types.ts';
import { saveToMap } from '../../../src/app/canvas-store.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { COLUMN, FONT, GUTTER, SIZE, useTheme } from '../theme.ts';
import { PinIcon, TutorIcon } from './Icons.tsx';
import { Btn, Paper, Txt } from './kit.tsx';
import { SchemeView, SpecView, isWide } from './SchemeView.tsx';

/** Paragraph text where **double asterisks** mark the key terms, underlined in magenta wash. */
export function RichParagraph({ text, size = SIZE.body }: { text: string; size?: number }) {
  const c = useTheme();
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Txt style={{ fontSize: size, lineHeight: size * 1.5 }}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={{ fontFamily: FONT.uiBold, backgroundColor: c.magentaWash }}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Txt>
  );
}

export function TheoryCardView({ card, animate, compact }: { card: TheoryCard; animate?: boolean; compact?: boolean }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const column = Math.min(width, COLUMN) - GUTTER * 2;
  const mols = card.molecules ?? [];
  // A long chain next to a small structure leaves a hole; then every drawing gets its own row.
  const stack = mols.length > 1 && mols.some((m) => isWide(m, { formulas: false }));
  const perRow = stack || mols.length === 1 ? 1 : mols.length > 2 && column >= 340 ? 3 : 2;
  const figureWidth = (column - (perRow - 1) * 12) / perRow;
  return (
    <View style={styles.card}>
      <Txt variant={compact ? 'heading' : 'title'}>{card.title}</Txt>
      <View style={styles.body}>
        {card.body.map((p, i) => (
          <RichParagraph key={i} text={p} />
        ))}
      </View>
      {card.scheme && (
        <Paper style={styles.schemePaper}>
          <SchemeView scheme={card.scheme} animate={animate} maxWidth={column - 28} />
        </Paper>
      )}
      {mols.length > 0 && (
        <View style={styles.figures}>
          {mols.map((m, i) => (
            <Paper key={i} style={[styles.figure, { width: figureWidth }]}>
              <SpecView spec={m} size={30} animate={animate} marks={m.marks} maxWidth={figureWidth - 20} />
              {m.label ? <Text style={styles.figcaption}>{m.label}</Text> : null}
            </Paper>
          ))}
        </View>
      )}
      {card.tip && (
        <View style={[styles.tip, { backgroundColor: c.magentaWash, borderLeftColor: c.magenta }]}>
          <Txt variant="kicker" tone="magenta">
            No ENEM
          </Txt>
          <RichParagraph text={card.tip} />
        </View>
      )}
    </View>
  );
}

/** Under a theory card: ask the tutor to explain it another way, or keep it on the concept map. */
export function TheoryActions({ lessonId, index, card }: { lessonId: string; index: number; card: TheoryCard }) {
  return (
    <View style={styles.actions}>
      <Btn
        small
        kind="tutor"
        label="Explicar de outro jeito"
        icon={(color) => <TutorIcon width={18} height={18} color={color} />}
        onPress={() =>
          ask({
            text: 'Me explica este cartão de outro jeito, com um exemplo do dia a dia.',
            screen: { kind: 'theory', lessonId, card },
            about: `Teoria: ${card.title}`,
            open: true,
          })
        }
      />
      <Btn
        small
        label="Salvar no mapa"
        icon={(color) => <PinIcon width={18} height={18} color={color} />}
        onPress={() => saveToMap({ kind: 'theory', title: card.title, lessonId, card: index })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  body: { gap: 10 },
  schemePaper: { padding: 14, alignItems: 'center' },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  figure: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 14, paddingHorizontal: 10, paddingBottom: 12 },
  figcaption: { fontFamily: FONT.ui, fontSize: SIZE.small, lineHeight: SIZE.small * 1.3, color: '#3b4651', textAlign: 'center' },
  tip: { gap: 2, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 4, borderTopRightRadius: 12, borderBottomRightRadius: 12, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
});
