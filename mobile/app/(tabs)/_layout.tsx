/**
 * The tab bar under the thumb, as on the web app's phone layout: Trilha, Mapa, the tutor
 * raised in the middle, Quadro, and Mais for the rest.
 */
import { type BottomTabBarProps, Tabs } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../../src/lib/haptics.ts';
import { FONT, useTheme } from '../../src/theme.ts';
import { BoardIcon, type IconProps, MapIcon, MoreIcon, PathIcon, TutorIcon } from '../../src/ui/Icons.tsx';
import { Press } from '../../src/ui/kit.tsx';

const TABS: Record<string, { label: string; icon: ComponentType<IconProps> }> = {
  index: { label: 'Trilha', icon: PathIcon },
  mapa: { label: 'Mapa', icon: MapIcon },
  tutor: { label: 'Tutor', icon: TutorIcon },
  quadro: { label: 'Quadro', icon: BoardIcon },
  mais: { label: 'Mais', icon: MoreIcon },
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
        const onPress = () => {
          haptic('tap');
          // Pressing the open tab scrolls it back to the top (useScrollToTop in the screens).
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        if (route.name === 'tutor') {
          return (
            <Press key={route.key} tap={false} onPress={onPress} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel="Tutor">
              <View style={[styles.disc, { backgroundColor: c.magenta, borderColor: c.surface }]}>
                <TutorIcon color="#fff" width={26} height={26} />
              </View>
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Press>
          );
        }
        const Icon = tab.icon;
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
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bench } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="mapa" />
      <Tabs.Screen name="tutor" />
      <Tabs.Screen name="quadro" />
      <Tabs.Screen name="mais" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 2, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'flex-end' },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    elevation: 4,
  },
  label: { fontFamily: FONT.uiBold, fontSize: 12 },
});
