/**
 * The tutor's markup on screen (src/app/components/tutor/Markup.tsx): text, lists,
 * structures drawn ENEM-style and links to lessons.
 */
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import { moleculeFromSmiles } from '../../../src/nanquim/index.ts';
import { type Block, type Inline, parseMarkup } from '../../../src/tutor/markup.ts';
import { closeTutor } from '../../../src/app/tutor-store.ts';
import { haptic } from '../lib/haptics.ts';
import { go } from '../lib/nav.ts';
import { COLUMN, FONT, SIZE, useTheme } from '../theme.ts';
import { MoleculeView } from '../ui/MoleculeView.tsx';
import { Paper, Press } from '../ui/kit.tsx';

const LINE = SIZE.body * 1.55;

function InlineView({ inline }: { inline: Inline[] }) {
  const c = useTheme();
  return (
    <>
      {inline.map((x, i) => {
        if (x.type === 'bold')
          return (
            <Text key={i} style={{ fontFamily: FONT.uiBold }}>
              {x.text}
            </Text>
          );
        if (x.type === 'code')
          return (
            <Text key={i} style={[styles.code, { backgroundColor: c.benchDeep }]}>
              {x.text}
            </Text>
          );
        if (x.type === 'lesson') return <LessonLink key={i} id={x.id} />;
        return x.text;
      })}
    </>
  );
}

/** "Praticar: Adição" with the lesson's element tile; opens the lesson. Sits inline in the text. */
export function LessonLink({ id }: { id: string }) {
  const c = useTheme();
  const lesson = LESSON_BY_ID[id];
  if (!lesson) return <Text>{id}</Text>;
  return (
    <Pressable
      onPress={() => {
        haptic('tap');
        closeTutor();
        go({ name: 'lesson', id });
      }}
      accessibilityRole="link"
      accessibilityLabel={`Praticar: ${lesson.title}`}
      style={[styles.lessonLink, { borderColor: c.magenta }]}
    >
      <View style={[styles.lessonTile, { backgroundColor: c.magenta }]}>
        <Text style={styles.lessonTileText}>{lesson.element.symbol}</Text>
      </View>
      <Text style={[styles.lessonText, { color: c.magenta }]}>
        Praticar: <Text style={{ fontFamily: FONT.uiBold }}>{lesson.title}</Text>
      </Text>
    </Pressable>
  );
}

/** A structure the tutor wrote; an invalid SMILES shows as text instead of breaking the reply. */
function MolBlock({ smiles, name, maxWidth }: { smiles: string; name?: string; maxWidth: number }) {
  const c = useTheme();
  const ok = useMemo(() => {
    try {
      return moleculeFromSmiles(smiles).atoms.length > 0;
    } catch {
      return false;
    }
  }, [smiles]);
  if (!ok) return <Text style={[styles.code, { backgroundColor: c.benchDeep, color: c.text, alignSelf: 'flex-start' }]}>{smiles}</Text>;
  return (
    <Press
      onPress={() => {
        closeTutor();
        go({ name: 'studio', smiles });
      }}
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${name || 'a estrutura'} em Estruturas`}
    >
      <Paper style={styles.mol}>
        <MoleculeView smiles={smiles} size={24} title={name} animate maxWidth={maxWidth - 24} />
        {name ? <Text style={styles.molCaption}>{name}</Text> : null}
      </Paper>
    </Press>
  );
}

function BlockView({ block, maxWidth }: { block: Block; maxWidth: number }) {
  const c = useTheme();
  const text = [styles.p, { color: c.text }];
  switch (block.type) {
    case 'p':
      return (
        <Text style={text}>
          <InlineView inline={block.inline} />
        </Text>
      );
    case 'h':
      return (
        <Text style={[styles.h, { color: c.text }]} accessibilityRole="header">
          <InlineView inline={block.inline} />
        </Text>
      );
    case 'ul':
    case 'ol':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Text style={[text, styles.marker]}>{block.type === 'ul' ? '•' : `${i + 1}.`}</Text>
              <Text style={[text, { flex: 1 }]}>
                <InlineView inline={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'mol':
      return <MolBlock smiles={block.smiles} name={block.name} maxWidth={maxWidth} />;
  }
}

/** `maxWidth` is the room the reply has, for drawings. */
export const Markup = memo(function Markup({ text, streaming, maxWidth }: { text: string; streaming?: boolean; maxWidth?: number }) {
  const { width } = useWindowDimensions();
  const room = maxWidth ?? Math.min(width, COLUMN) - 32 - 40;
  const blocks = useMemo(() => parseMarkup(text, { streaming }), [text, streaming]);
  return (
    <View style={styles.md}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} maxWidth={room} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  md: { gap: 10 },
  p: { fontFamily: FONT.ui, fontSize: SIZE.body, lineHeight: LINE },
  h: { fontFamily: FONT.display, fontSize: SIZE.step1, lineHeight: SIZE.step1 * 1.25 },
  list: { gap: 4 },
  item: { flexDirection: 'row', gap: 6, paddingLeft: 4 },
  marker: { minWidth: 16 },
  code: { fontFamily: FONT.mono, fontSize: SIZE.body * 0.88, borderRadius: 5, paddingHorizontal: 5 },
  mol: { alignItems: 'center', gap: 6, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, marginVertical: 2 },
  molCaption: { fontFamily: FONT.ui, fontSize: SIZE.small, color: '#3b4651', textAlign: 'center' },
  lessonLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 14,
    borderWidth: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  lessonTile: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lessonTileText: { color: '#fff', fontFamily: FONT.displayHeavy, fontSize: 13 },
  lessonText: { fontFamily: FONT.ui, fontSize: SIZE.small + 0.5 },
});
