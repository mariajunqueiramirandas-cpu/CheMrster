/** Bottom sheets, as on the web app's phone layout: they rise from the bottom and close with a swipe down. */
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme.ts';

export function Sheet({
  visible,
  onClose,
  children,
  full,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Takes (nearly) the whole height, for the tutor. */
  full?: boolean;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const drag = useRef(new Animated.Value(0)).current;
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.9) {
          Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(() => close.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="Fechar" />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.bench, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY: drag }] },
            full ? { height: height - insets.top - 12 } : { maxHeight: height - insets.top - 24 },
          ]}
        >
          <View {...pan.panHandlers} style={styles.grip} accessibilityLabel="Arraste para baixo para fechar">
            <View style={[styles.gripBar, { backgroundColor: c.rule }]} />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  grip: { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  gripBar: { width: 42, height: 5, borderRadius: 3 },
});
