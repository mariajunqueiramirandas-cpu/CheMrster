/** Form controls: segmented choices and switches. */
import { StyleSheet, Switch, Text, View } from 'react-native';
import { FONT, useTheme } from '../theme.ts';
import { Press, Txt } from './kit.tsx';

/** One of a few options, as a row of pills on a sunken track. `columns` wraps them into rows. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  columns,
  small,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  columns?: number;
  small?: boolean;
}) {
  const c = useTheme();
  const per = columns ?? options.length;
  return (
    <View style={[styles.segmented, { backgroundColor: c.benchDeep }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Press
            key={o.id}
            onPress={() => onChange(o.id)}
            sink={1}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, { width: `${100 / per}%` }]}
          >
            <View style={[styles.segmentFace, on && { backgroundColor: c.surface, elevation: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }]}>
              <Text style={[styles.segmentText, small && styles.segmentTextSmall, { color: on ? c.text : c.muted }]} numberOfLines={1}>
                {o.label}
              </Text>
            </View>
          </Press>
        );
      })}
    </View>
  );
}

/** A labelled switch. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useTheme();
  return (
    <Press onPress={() => onChange(!value)} sink={0} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.rule, true: c.magenta }}
        thumbColor="#ffffff"
        importantForAccessibility="no"
      />
      <Txt style={{ flex: 1 }}>{label}</Txt>
    </Press>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14 },
  segment: { padding: 1 },
  segmentFace: { minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: FONT.uiBold, fontSize: 15 },
  segmentTextSmall: { fontSize: 13.5 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
