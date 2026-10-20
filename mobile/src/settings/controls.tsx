/** Form controls shared by Ajustes and Estruturas: segmented choices, switches, fields and radio cards. */
import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, TextInput, type TextInputProps, View } from 'react-native';
import { FONT, SIZE, useTheme } from '../theme.ts';
import { Press, Txt } from '../ui/kit.tsx';

/** One of a few options, as a row of pills on a sunken track. `columns` wraps them into rows. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  columns,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  columns?: number;
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
              <Text style={[styles.segmentText, { color: on ? c.text : c.muted }]} numberOfLines={1}>
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

/** A label over a text input; `mono` for SMILES and keys, `invalid` turns the border red. */
export function Field({
  label,
  note,
  mono,
  invalid,
  right,
  ...input
}: TextInputProps & { label: string; note?: string; mono?: boolean; invalid?: boolean; right?: ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          placeholderTextColor={c.muted}
          accessibilityLabel={label}
          {...input}
          style={[
            styles.input,
            { borderColor: invalid ? c.wrong : c.rule, backgroundColor: c.surface, color: c.text, fontFamily: mono ? FONT.mono : FONT.ui },
            input.style,
          ]}
        />
        {right}
      </View>
      {note ? (
        <Txt variant="small" tone="muted">
          {note}
        </Txt>
      ) : null}
    </View>
  );
}

/** A radio choice drawn as a card with a title and a note. */
export function ChoiceCard({ on, title, note, onPress }: { on: boolean; title: string; note: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Press
      onPress={onPress}
      sink={1}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${title}. ${note}`}
      style={[styles.choice, { borderColor: on ? c.magenta : c.rule, backgroundColor: on ? c.magentaWash : 'transparent' }]}
    >
      <View style={[styles.radio, { borderColor: on ? c.magenta : c.rule }]}>{on && <View style={[styles.radioDot, { backgroundColor: c.magenta }]} />}</View>
      <View style={{ flex: 1 }}>
        <Txt variant="strong">{title}</Txt>
        <Txt variant="small" tone="muted">
          {note}
        </Txt>
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, borderRadius: 14 },
  segment: { padding: 1 },
  segmentFace: { minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segmentText: { fontFamily: FONT.uiBold, fontSize: 15 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  fieldRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderRadius: 12, fontSize: 16 },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 2, borderRadius: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, marginTop: 3, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
