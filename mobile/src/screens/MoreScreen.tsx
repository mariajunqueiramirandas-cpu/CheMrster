/** "Mais" (src/app/components/MoreSheet.tsx): today's numbers and the sections that do not fit in the tab bar. */
import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSettings } from '../../../src/app/settings.ts';
import { currentStreak, dayKey, useProgress } from '../../../src/app/store.ts';
import { type Route, go } from '../lib/nav.ts';
import { FONT, useTheme } from '../theme.ts';
import { TopBar } from '../ui/Bars.tsx';
import { BoltIcon, ChainIcon, ChartIcon, ChevronRightIcon, FlameIcon, HistoryIcon, type IconProps, SlidersIcon } from '../ui/Icons.tsx';
import { Card, Meter, Press, Txt } from '../ui/kit.tsx';
import { Page } from '../ui/Page.tsx';

const ITEMS: Array<{ route: Route; label: string; note: string; icon: ComponentType<IconProps> }> = [
  { route: { name: 'progress' }, label: 'Progresso', note: 'Domínio, calendário e metas', icon: ChartIcon },
  { route: { name: 'studio' }, label: 'Estruturas', note: 'Desenhe qualquer molécula', icon: ChainIcon },
  { route: { name: 'tutor' }, label: 'Conversas', note: 'Tudo o que você falou com o tutor', icon: HistoryIcon },
  { route: { name: 'settings' }, label: 'Ajustes', note: 'Tutor, meta diária, tema e backup', icon: SlidersIcon },
];

export function MoreScreen() {
  const c = useTheme();
  const progress = useProgress();
  const { dailyGoal } = useSettings();
  const today = progress.days[dayKey(new Date())]?.xp ?? 0;
  const streak = currentStreak(progress);
  return (
    <Page header={<TopBar />}>
      <Press onPress={() => go({ name: 'progress' })} accessibilityRole="link">
        <Card style={styles.today}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <FlameIcon color={streak ? c.magenta : c.muted} />
              <Txt variant="strong">{streak}</Txt>
              <Txt tone="muted">{streak === 1 ? 'dia' : 'dias'}</Txt>
            </View>
            <View style={styles.stat}>
              <BoltIcon color={c.amber} />
              <Txt variant="strong">{progress.xp}</Txt>
              <Txt tone="muted">XP</Txt>
            </View>
          </View>
          <Txt variant="small" tone="muted">
            Hoje {today}/{dailyGoal} XP
          </Txt>
          <Meter value={today / dailyGoal} height={8} color={today >= dailyGoal ? c.right : undefined} />
        </Card>
      </Press>
      <View style={[styles.list, { borderColor: c.rule, backgroundColor: c.surface }]}>
        {ITEMS.map(({ route, label, note, icon: Icon }, i) => (
          <Press
            key={route.name}
            onPress={() => go(route)}
            accessibilityRole="link"
            accessibilityLabel={`${label}: ${note}`}
            style={[styles.item, i > 0 && { borderTopWidth: 2, borderTopColor: c.benchDeep }]}
          >
            <View style={[styles.icon, { backgroundColor: c.magentaWash }]}>
              <Icon color={c.magenta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: c.text }]}>{label}</Text>
              <Txt variant="small" tone="muted">
                {note}
              </Txt>
            </View>
            <ChevronRightIcon color={c.muted} width={18} height={18} />
          </Press>
        ))}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  today: { gap: 8 },
  stats: { flexDirection: 'row', gap: 22 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { marginTop: 18, borderWidth: 2, borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT.uiBold, fontSize: 17 },
});
