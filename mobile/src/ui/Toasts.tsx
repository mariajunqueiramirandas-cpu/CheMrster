/** Short messages under the top bar ("Falta o sufixo", "Resultado copiado"), from src/app/toast.ts. */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dismissToast, useToasts } from '../../../src/app/toast.ts';
import { FONT } from '../theme.ts';
import { Press } from './kit.tsx';

export function Toasts() {
  const toasts = useToasts();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 64 }]} accessibilityLiveRegion="polite">
      {toasts.map((t) => (
        <View key={t.id} style={styles.toast}>
          <Text style={styles.text}>{t.text}</Text>
          {t.action?.run && (
            <Press
              onPress={() => {
                t.action?.run?.();
                dismissToast(t.id);
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.action}>{t.action.label}</Text>
            </Press>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    maxWidth: 520,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1e2a36',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { flexShrink: 1, color: '#fff', fontFamily: FONT.uiBold, fontSize: 15 },
  action: { color: '#f39bc9', fontFamily: FONT.uiBold, fontSize: 15 },
});
