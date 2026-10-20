/** The web app's buzzes (src/app/mobile.ts), as Android haptics. */
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => (reduceMotion = on))
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => (reduceMotion = on));

export type HapticKind = 'tap' | 'success' | 'error' | 'done';

export function haptic(kind: HapticKind = 'tap') {
  if (reduceMotion) return;
  const run = () => {
    switch (kind) {
      case 'tap':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      case 'done':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };
  run().catch(() => undefined);
}

/** Whether the learner asked for less motion (the ink animation and transitions stay still). */
export const prefersReducedMotion = () => reduceMotion;
