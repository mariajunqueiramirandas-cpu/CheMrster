/** A formula set like the exam booklets print it: Arial-like letters, counts as subscripts. */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { runs } from '../../../src/nomenclatura/formula.ts';
import { FONT, useTheme } from '../theme.ts';

export function Formula({ formula, size = 44, color, style }: { formula: string; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const ink = color ?? c.text;
  return (
    <View style={[styles.row, style]} accessible accessibilityRole="text" accessibilityLabel={`Fórmula ${formula}`}>
      {runs(formula).map((r, i) => (
        <Text
          key={i}
          style={
            r.sub
              ? { fontFamily: FONT.mol, fontSize: size * 0.62, lineHeight: size * 0.62, marginBottom: -size * 0.08, color: ink }
              : { fontFamily: FONT.mol, fontSize: size, lineHeight: size * 1.15, color: ink }
          }
        >
          {r.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'nowrap' },
});
