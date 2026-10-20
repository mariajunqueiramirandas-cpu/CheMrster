/** The app's frame: fonts, theme, the stack of screens, and what floats over them (tutor, toasts). */
import { Arimo_400Regular, Arimo_700Bold } from '@expo-google-fonts/arimo';
import {
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible-next';
import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setApiBase } from '../../src/app/account.ts';
import { TutorSheet } from '../src/tutor/TutorSheet.tsx';
import { Toasts } from '../src/ui/Toasts.tsx';
import { useTheme } from '../src/theme.ts';

// A CheMrster server (see the README) gives the tutor its Claude key; without one, the learner's
// own key from Ajustes or the offline tutor answers.
setApiBase(process.env.EXPO_PUBLIC_API_URL ?? '');

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Arimo_400Regular,
    Arimo_700Bold,
    AtkinsonHyperlegibleNext_400Regular,
    AtkinsonHyperlegibleNext_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const c = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bench).catch(() => undefined);
  }, [c.bench]);

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bench }}>
      <SafeAreaProvider>
        {/* The bars follow the app's theme, which can differ from the system's (Ajustes). */}
        <StatusBar style={c.dark ? 'light' : 'dark'} />
        <NavigationBar style={c.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bench }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          {/* Practice slides up over the app and back down when done. */}
          <Stack.Screen name="licao/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="revisao" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack>
        <TutorSheet />
        <Toasts />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
