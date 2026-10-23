/** The tab bar under the thumb: today's challenge, practice, and the guide. */
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../src/lib/haptics.ts';
import { FONT, useTheme } from '../../src/theme.ts';
import { BoltIcon, BookIcon, FlaskIcon, type IconProps } from '../../src/ui/Icons.tsx';
import { Press } from '../../src/ui/kit.tsx';

const TABS: Record<string, { label: string; icon: ComponentType<IconProps> }> = {
  index: { label: 'Hoje', icon: FlaskIcon },
  treino: { label: 'Treino', icon: BoltIcon },
  guia: { label: 'Guia', icon: BookIcon },
};

function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.benchDeep, paddingBottom: insets.bottom + 4 }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? c.magenta : c.muted;
        const Icon = tab.icon;
        const onPress = () => {
          haptic('tap');
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Press key={route.key} tap={false} onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label}>
            <View style={[styles.pill, focused && { backgroundColor: c.magentaWash }]}>
              <Icon color={color} />
            </View>
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bench } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="treino" />
      <Tabs.Screen name="guia" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 2, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'flex-end' },
  pill: { width: 56, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONT.uiBold, fontSize: 12 },
});
