/**
 * One card on the concept map, by kind (src/app/components/canvas/NodeView.tsx): a note, a
 * structure, theory from the course, a tutor answer or a question. Cards are paper, so their
 * ink stays dark in the dark theme too. The canvas handles every touch; cards only draw.
 */
import { memo, useMemo } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import { THEORY } from '../../../src/course/theory/index.ts';
import type { MapNode, NodeColor } from '../../../src/study/canvas.ts';
import { type Inline, parseMarkup } from '../../../src/tutor/markup.ts';
import { moleculeFromSmiles } from '../../../src/nanquim/index.ts';
import { FONT } from '../theme.ts';
import { MoleculeView } from '../ui/MoleculeView.tsx';
import { SpecView } from '../ui/SchemeView.tsx';

export const KIND_LABEL: Record<MapNode['kind'], string> = {
  note: 'Nota',
  molecule: 'Estrutura',
  theory: 'Teoria',
  tutor: 'Tutor',
  question: 'Questão',
};

/** The coloured band across the top of a card. */
export const BAND: Record<NodeColor, string | undefined> = {
  paper: undefined,
  magenta: '#c0157a',
  cobalt: '#2448c8',
  green: '#17784a',
  amber: '#9a5b00',
};

const INK = '#1e2a36';
const BODY = '#2b3742';
const PAD = 14;
const HANDLE = 26;

export function validSmiles(smiles?: string): boolean {
  if (!smiles) return false;
  try {
    return moleculeFromSmiles(smiles).atoms.length > 0;
  } catch {
    return false;
  }
}

/** `**key terms**` in bold over a magenta wash, as on the web cards. */
function RichText({ text, size = 14.5 }: { text: string; size?: number }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={[styles.body, { fontSize: size, lineHeight: size * 1.45 }]}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={styles.strong}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}|\n/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <RichText key={i} text={p} />
        ))}
    </>
  );
}

function InlineText({ inline }: { inline: Inline[] }) {
  return (
    <Text style={styles.body}>
      {inline.map((s, i) =>
        s.type === 'bold' ? (
          <Text key={i} style={styles.strong}>
            {s.text}
          </Text>
        ) : s.type === 'code' ? (
          <Text key={i} style={styles.code}>
            {s.text}
          </Text>
        ) : s.type === 'lesson' ? (
          <Text key={i} style={styles.lesson}>
            {LESSON_BY_ID[s.id]?.title ?? s.id}
          </Text>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}

/** A tutor answer kept on the map: the tutor's own markup, with its structures drawn. */
function TutorBody({ text, inner }: { text: string; inner: number }) {
  const blocks = useMemo(() => parseMarkup(text), [text]);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'mol') {
          return (
            <View key={i} style={styles.mol}>
              {validSmiles(b.smiles) ? (
                <MoleculeView smiles={b.smiles} size={20} maxWidth={inner - 18} title={b.name} />
              ) : (
                <Text style={styles.code}>{b.smiles}</Text>
              )}
              {b.name ? <Text style={styles.figcaption}>{b.name}</Text> : null}
            </View>
          );
        }
        if (b.type === 'ul' || b.type === 'ol') {
          return (
            <View key={i} style={{ gap: 3 }}>
              {b.items.map((item, k) => (
                <View key={k} style={styles.listItem}>
                  <Text style={styles.body}>{b.type === 'ul' ? '•' : `${k + 1}.`}</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText inline={item} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        if (b.type === 'h') {
          return (
            <Text key={i} style={[styles.body, styles.strong]}>
              {b.inline.map((s) => ('text' in s ? s.text : '')).join('')}
            </Text>
          );
        }
        return b.type === 'p' ? <InlineText key={i} inline={b.inline} /> : null;
      })}
    </>
  );
}

function TheoryBody({ node, inner }: { node: MapNode; inner: number }) {
  const card = node.lessonId !== undefined && node.card !== undefined ? THEORY[node.lessonId]?.[node.card] : undefined;
  if (!card) return <Text style={styles.missing}>Este cartão de teoria não existe mais.</Text>;
  const figures = card.molecules?.slice(0, 2) ?? [];
  const figureW = figures.length > 1 ? (inner - 6) / 2 : inner;
  return (
    <>
      {card.body.map((p, i) => (
        <RichText key={i} text={p} />
      ))}
      {figures.length > 0 && (
        <View style={styles.figures}>
          {figures.map((m, i) => (
            <View key={i} style={[styles.figure, { width: figureW }]}>
              <SpecView spec={m} size={18} maxWidth={figureW - 12} />
              {m.label ? <Text style={styles.figcaption}>{m.label}</Text> : null}
            </View>
          ))}
        </View>
      )}
      {card.tip ? (
        <View style={styles.tip}>
          <Text style={[styles.body, { fontSize: 13.5 }]}>
            <Text style={styles.strong}>No ENEM: </Text>
            {card.tip.replace(/\*\*/g, '')}
          </Text>
        </View>
      ) : null}
    </>
  );
}

export interface NodeCardProps {
  node: MapNode;
  selected: boolean;
  /** Offset while being dragged, before the move is saved. */
  dx: number;
  dy: number;
  /** The card's drawn height, so arrows meet its border. */
  onMeasure: (id: string, h: number) => void;
}

export const NodeCard = memo(function NodeCard({ node, selected, dx, dy, onMeasure }: NodeCardProps) {
  const lesson = node.lessonId ? LESSON_BY_ID[node.lessonId] : undefined;
  const molOk = useMemo(() => validSmiles(node.smiles), [node.smiles]);
  const inner = node.w - PAD * 2;
  const band = BAND[node.color];
  const kickerColor = node.kind === 'theory' ? '#c0157a' : node.kind === 'tutor' ? '#2448c8' : '#56626f';
  const onLayout = (e: LayoutChangeEvent) => onMeasure(node.id, Math.round(e.nativeEvent.layout.height));
  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel={`${KIND_LABEL[node.kind]}: ${node.title || 'sem título'}`}
      accessibilityState={{ selected }}
      style={[styles.node, { left: node.x + dx, top: node.y + dy, width: node.w }]}
    >
      {selected ? <View pointerEvents="none" style={styles.outline} /> : null}
      {band ? <View style={[styles.band, { backgroundColor: band }]} /> : null}
      <View style={styles.kicker}>
        {lesson ? (
          <View style={styles.tile}>
            <Text style={styles.tileText}>{lesson.element.symbol}</Text>
          </View>
        ) : null}
        <Text style={[styles.kickerText, { color: kickerColor }]} numberOfLines={1}>
          {KIND_LABEL[node.kind]}
          {lesson ? ` · ${lesson.title}` : ''}
        </Text>
      </View>
      {node.title ? <Text style={styles.title}>{node.title}</Text> : null}
      {node.smiles && node.kind !== 'tutor' ? (
        <View style={styles.mol}>
          {molOk ? <MoleculeView smiles={node.smiles} size={22} maxWidth={inner - 18} title={node.title} /> : <Text style={styles.code}>{node.smiles}</Text>}
        </View>
      ) : null}
      {node.kind === 'theory' ? (
        <TheoryBody node={node} inner={inner} />
      ) : node.kind === 'tutor' ? (
        <TutorBody text={node.text} inner={inner} />
      ) : node.text ? (
        <Paragraphs text={node.text} />
      ) : null}
      {!node.title && !node.text && !node.smiles && node.kind === 'note' ? (
        <Text style={styles.missing}>Nota vazia: toque duas vezes para escrever.</Text>
      ) : null}
      {/* Drag this dot onto another card to link them. */}
      {selected ? <View pointerEvents="none" style={styles.handle} /> : null}
    </View>
  );
});

/** Where a selected card's link handle sits, in world units: the middle of its right edge. */
export const handleOf = (n: { x: number; y: number; w: number; h: number }) => ({ x: n.x + n.w, y: n.y + n.h / 2 });

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: PAD,
    paddingBottom: 14,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    shadowColor: '#1e2a36',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'visible',
  },
  // Like the web's outline with an offset: drawn around the card without changing its size.
  outline: { position: 'absolute', top: -6, left: -6, right: -6, bottom: -6, borderWidth: 3, borderColor: '#c0157a', borderRadius: 13 },
  handle: {
    position: 'absolute',
    top: '50%',
    right: -HANDLE / 2,
    marginTop: -HANDLE / 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#c0157a',
    elevation: 4,
  },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: { fontFamily: FONT.uiBold, fontSize: 12.5, flexShrink: 1 },
  tile: { width: 20, height: 20, borderRadius: 5, backgroundColor: '#c0157a', alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#fff', fontFamily: FONT.displayHeavy, fontSize: 10.5 },
  title: { fontFamily: FONT.display, fontSize: 18.5, lineHeight: 22, color: INK },
  body: { fontFamily: FONT.ui, fontSize: 14.5, lineHeight: 21, color: BODY },
  strong: { fontFamily: FONT.uiBold, color: INK, backgroundColor: '#f9dcec' },
  code: { fontFamily: FONT.mono, fontSize: 13, color: INK, backgroundColor: '#e8ecef' },
  lesson: { fontFamily: FONT.uiBold, color: '#c0157a' },
  mol: { alignItems: 'center', gap: 4, padding: 8, borderWidth: 1, borderColor: '#e3e7ea', borderRadius: 6, backgroundColor: '#fff' },
  figures: { flexDirection: 'row', gap: 6 },
  figure: { alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, borderWidth: 1, borderColor: '#e3e7ea', borderRadius: 6 },
  figcaption: { fontFamily: FONT.ui, fontSize: 11.5, lineHeight: 14.5, color: '#3b4651', textAlign: 'center' },
  tip: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#c0157a',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fbe7f2',
  },
  missing: { fontFamily: FONT.ui, fontSize: 13.5, color: '#56626f' },
  listItem: { flexDirection: 'row', gap: 6 },
});
