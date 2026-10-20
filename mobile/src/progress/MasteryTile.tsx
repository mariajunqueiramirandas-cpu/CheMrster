/** A lesson as a periodic-table cell filled by how well it is known today. */
import { StyleSheet, Text, View } from 'react-native';
import type { MasteryLevel } from '../../../src/study/progress.ts';
import { FONT, useTheme } from '../theme.ts';
import { Press } from '../ui/kit.tsx';
import { heat } from './heat.ts';

export function MasteryTile({
  symbol,
  number,
  level,
  label,
  size,
  onPress,
  accessibilityLabel,
}: {
  symbol: string;
  number?: number;
  level: MasteryLevel;
  /** Small line at the bottom (the mastery percentage). */
  label?: string;
  size: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useTheme();
  const t = heat(c).tile(level);
  const face = (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.max(6, size * 0.16),
          backgroundColor: t.bg,
          borderColor: t.border,
          borderStyle: t.dashed ? 'dashed' : 'solid',
          borderWidth: t.dashed ? 2 : 0,
        },
      ]}
    >
      {number !== undefined && size >= 34 && (
        <Text style={[styles.n, { color: t.fg, fontSize: Math.max(8, size * 0.17) }]}>{number}</Text>
      )}
      <Text style={[styles.s, { color: t.fg, fontSize: size * (number !== undefined ? 0.4 : 0.46) }]}>{symbol}</Text>
      {label ? <Text style={[styles.m, { color: t.fg, fontSize: Math.max(8, size * 0.18) }]}>{label}</Text> : null}
    </View>
  );
  const edged = t.edge ? <View style={{ backgroundColor: t.edge, borderRadius: Math.max(6, size * 0.16), paddingBottom: 3 }}>{face}</View> : face;
  if (!onPress) return <View importantForAccessibility="no-hide-descendants">{edged}</View>;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} sink={2}>
      {edged}
    </Press>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  n: { position: 'absolute', top: 3, left: 5, fontFamily: FONT.uiBold },
  s: { fontFamily: FONT.displayHeavy, includeFontPadding: false, letterSpacing: -0.5 },
  m: { position: 'absolute', bottom: 3, fontFamily: FONT.uiBold },
});
