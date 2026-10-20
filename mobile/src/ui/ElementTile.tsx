/** A lesson drawn as a periodic-table cell: atomic number = its place in the course. */
import { StyleSheet, Text, View } from 'react-native';
import type { Lesson } from '../../../src/course/types.ts';
import { FONT, useTheme } from '../theme.ts';
import { Press } from './kit.tsx';

export type TileState = 'done' | 'current' | 'open' | 'locked' | 'soon';

const STATE_LABEL: Record<TileState, string> = {
  done: 'concluída',
  current: 'próxima lição',
  open: 'disponível',
  locked: 'bloqueada',
  soon: 'em breve',
};

export function ElementTile({
  lesson,
  state,
  onSelect,
  size = 'path',
}: {
  lesson: Lesson;
  state: TileState;
  onSelect?: () => void;
  size?: 'path' | 'large' | 'small';
}) {
  const c = useTheme();
  const dim = size === 'large' ? 96 : size === 'small' ? 52 : 76;
  const look = {
    done: { bg: c.magenta, fg: '#fff', border: 'transparent', edge: c.magentaPress },
    current: { bg: c.paper, fg: c.ink, border: c.magenta, edge: c.magentaPress },
    open: { bg: c.paper, fg: c.ink, border: c.rule, edge: c.rule },
    locked: { bg: c.benchDeep, fg: c.muted, border: 'transparent', edge: c.rule },
    soon: { bg: 'transparent', fg: c.muted, border: c.rule, edge: undefined },
  }[state];
  const face = (
    <View
      style={[
        styles.tile,
        { width: dim, height: dim, borderRadius: dim * 0.18, backgroundColor: look.bg, borderColor: look.border },
        state === 'soon' && { borderStyle: 'dashed' },
      ]}
    >
      <Text style={[styles.number, { color: look.fg }, size === 'small' && { fontSize: 10, top: 4, left: 6 }]}>{lesson.element.number}</Text>
      <Text style={[styles.symbol, { color: look.fg, fontSize: size === 'large' ? 42 : size === 'small' ? 22 : 32 }]}>{lesson.element.symbol}</Text>
    </View>
  );
  const edged = look.edge ? (
    <View style={{ borderRadius: dim * 0.18, backgroundColor: look.edge, paddingBottom: size === 'small' ? 3 : 4 }}>{face}</View>
  ) : (
    face
  );
  if (!onSelect) return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{edged}</View>;
  return (
    <Press
      sink={3}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`Lição ${lesson.element.number}: ${lesson.title} (${STATE_LABEL[state]})`}
    >
      {edged}
    </Press>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  number: { position: 'absolute', top: 6, left: 8, fontFamily: FONT.uiBold, fontSize: 12 },
  symbol: { fontFamily: FONT.displayHeavy, letterSpacing: -0.8, includeFontPadding: false },
});
