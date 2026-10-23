/** The bar at the top: CheMrster, what this tab is, the streak, and how to play, statistics and preferences. */
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stats } from '../../../src/nomenclatura/play.ts';
import { useSave } from '../../../src/nomenclatura/store.ts';
import { useToday } from '../game/clock.ts';
import { openSheet } from '../game/Sheets.tsx';
import { FONT, GUTTER, useTheme } from '../theme.ts';
import { ChartIcon, FlameIcon, HelpIcon, SlidersIcon } from './Icons.tsx';
import { IconBtn, Press } from './kit.tsx';

export function TopBar({ subtitle }: { subtitle: string }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < 360;
  const n = useToday();
  const save = useSave();
  const streak = useMemo(() => stats(save.days, n).streak, [save.days, n]);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4, backgroundColor: c.bench }]}>
      <View style={styles.title}>
        <Text style={[styles.wordmark, narrow && { fontSize: 19 }, { color: c.text }]} accessibilityRole="header" numberOfLines={1}>
          CheMrster
        </Text>
        <Text style={[styles.subtitle, { color: c.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Press onPress={() => openSheet('stats')} style={styles.streak} accessibilityLabel={`Sequência de ${streak} dias`}>
        <FlameIcon width={20} height={20} color={streak ? c.magenta : c.muted} />
        <Text style={[styles.streakText, { color: streak ? c.magenta : c.muted }]}>{streak}</Text>
      </Press>
      <IconBtn label="Como jogar" onPress={() => openSheet('help')} style={narrow && styles.iconNarrow}>
        <HelpIcon color={c.muted} />
      </IconBtn>
      <IconBtn label="Estatísticas" onPress={() => openSheet('stats')} style={narrow && styles.iconNarrow}>
        <ChartIcon color={c.muted} />
      </IconBtn>
      <IconBtn label="Ajustes" onPress={() => openSheet('prefs')} style={[{ marginRight: -8 }, narrow && styles.iconNarrow]}>
        <SlidersIcon color={c.muted} />
      </IconBtn>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: GUTTER, paddingBottom: 6, minHeight: 52 },
  title: { flex: 1, minWidth: 0 },
  wordmark: { fontFamily: FONT.displayHeavy, fontSize: 22, letterSpacing: -0.4, lineHeight: 26 },
  subtitle: { fontFamily: FONT.uiBold, fontSize: 12.5 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 8 },
  streakText: { fontFamily: FONT.uiBold, fontSize: 16 },
  iconNarrow: { width: 38 },
});
