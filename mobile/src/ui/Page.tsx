/** A scrolling page on the bench, inside the safe area, in a readable column. */
import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLUMN, GUTTER, useTheme } from '../theme.ts';

export function Page({
  children,
  header,
  top = true,
  bottomPad = 32,
  ...rest
}: ScrollViewProps & {
  children: ReactNode;
  /** Stays above the scrolling content. */
  header?: ReactNode;
  /** Pad for the status bar (false when a header already does). */
  top?: boolean;
  bottomPad?: number;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.bench, paddingTop: top && !header ? insets.top : 0 }]}>
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        {...rest}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }, rest.contentContainerStyle]}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 12 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
});
