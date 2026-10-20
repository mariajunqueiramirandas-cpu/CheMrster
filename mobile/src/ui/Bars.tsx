/** The bars at the top: the app's own on the tabs, and a back bar on screens opened on top. */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentStreak, useProgress } from '../../../src/app/store.ts';
import { back, go } from '../lib/nav.ts';
import { FONT, GUTTER, useTheme } from '../theme.ts';
import { ArrowRightIcon, BoltIcon, FlameIcon, SlidersIcon } from './Icons.tsx';
import { IconBtn, Press } from './kit.tsx';

/** CheMrster, the streak and XP, and Ajustes. */
export function TopBar({ right }: { right?: ReactNode }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const streak = currentStreak(progress);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4, backgroundColor: c.bench }]}>
      <Text style={[styles.wordmark, { color: c.text }]} accessibilityRole="header">
        CheMrster
      </Text>
      <View style={styles.stats}>
        <Press onPress={() => go({ name: 'progress' })} style={styles.stat} accessibilityLabel={`${streak} dias seguidos`}>
          <FlameIcon width={20} height={20} color={streak ? c.magenta : c.muted} />
          <Text style={[styles.statText, { color: streak ? c.magenta : c.muted }]}>{streak}</Text>
        </Press>
        <Press onPress={() => go({ name: 'progress' })} style={styles.stat} accessibilityLabel={`${progress.xp} XP`}>
          <BoltIcon width={20} height={20} color={c.muted} />
          <Text style={[styles.statText, { color: c.muted }]}>{progress.xp}</Text>
        </Press>
      </View>
      {right}
      <IconBtn label="Ajustes" onPress={() => go({ name: 'settings' })}>
        <SlidersIcon color={c.muted} />
      </IconBtn>
    </View>
  );
}

/** A title and the way back (the system back gesture works too). */
export function BackBar({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4, backgroundColor: c.bench }]}>
      <IconBtn label="Voltar" onPress={onBack ?? back} style={{ marginLeft: -8 }}>
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <ArrowRightIcon color={c.text} />
        </View>
      </IconBtn>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: GUTTER, paddingBottom: 6, minHeight: 52 },
  wordmark: { fontFamily: FONT.displayHeavy, fontSize: 22, letterSpacing: -0.4, flex: 1 },
  title: { fontFamily: FONT.display, fontSize: 20, flex: 1 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
  statText: { fontFamily: FONT.uiBold, fontSize: 16 },
});
