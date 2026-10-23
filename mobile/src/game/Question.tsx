/**
 * One compound to name: its formula on paper and a text field for the IUPAC name, typed on the
 * device's keyboard. Once answered, the result and why. The daily challenge and practice share
 * it; they differ only in where answers are kept (`answer` and `onSubmit`).
 */
import { type ReactNode, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { type Compound, TIER_LABEL } from '../../../src/nomenclatura/catalog.ts';
import type { Check } from '../../../src/nomenclatura/check.ts';
import { haptic } from '../lib/haptics.ts';
import { COLUMN, FONT, GUTTER, LIGHT, paperShadow, useTheme } from '../theme.ts';
import { Btn, Txt } from '../ui/kit.tsx';
import { Formula } from './Formula.tsx';
import { Result } from './Result.tsx';

function Dots({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <View style={styles.dots} accessibilityLabel={`Dificuldade: ${TIER_LABEL[tier]}`}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i <= tier ? LIGHT.magenta : LIGHT.rule }]} />
      ))}
      <Txt variant="small" style={{ color: LIGHT.muted, marginLeft: 4 }}>
        {TIER_LABEL[tier]}
      </Txt>
    </View>
  );
}

export function Question({
  compound,
  kicker,
  answer,
  onSubmit,
  children,
}: {
  compound: Compound;
  kicker: string;
  /** Once answered: what was typed and whether it was right. */
  answer?: { typed: string; correct: boolean };
  /** Checks (and keeps) what was typed. */
  onSubmit: (typed: string) => Check;
  /** Under the result: the way on. */
  children?: ReactNode;
}) {
  const c = useTheme();
  const short = useWindowDimensions().height < 700;
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const submit = () => {
    const result = onSubmit(text);
    if (result.kind === 'empty') return;
    if (result.kind === 'other') {
      haptic('error');
      setNote(result.note);
      return;
    }
    Keyboard.dismiss();
    haptic(result.kind === 'right' ? 'success' : 'error');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.paper, { backgroundColor: c.paper }, paperShadow(c)]}>
          <View style={styles.paperHead}>
            <Txt variant="kicker" style={{ color: LIGHT.magenta }}>
              {kicker}
            </Txt>
            <Dots tier={compound.tier} />
          </View>
          <Formula formula={compound.formula} size={short ? 36 : 46} color={c.ink} style={{ minHeight: short ? 46 : 58 }} />
        </View>

        {answer ? (
          <Result compound={compound} typed={answer.typed} correct={answer.correct}>
            {children}
          </Result>
        ) : (
          <View style={styles.form}>
            <Txt variant="strong">Qual é o nome IUPAC?</Txt>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                setNote(null);
              }}
              onSubmitEditing={submit}
              submitBehavior="submit"
              placeholder="Escreva o nome"
              placeholderTextColor={c.muted}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              returnKeyType="send"
              accessibilityLabel="Nome IUPAC"
              style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: note ? c.amber : c.rule }]}
            />
            {note && (
              <View style={[styles.note, { backgroundColor: c.amberWash }]} accessibilityLiveRegion="polite">
                <Txt variant="small">{note}</Txt>
              </View>
            )}
            <Btn kind="primary" wide label="Responder" disabled={!text.trim()} onPress={submit} />
            <Txt variant="small" tone="muted">
              Acentos, maiúsculas e hífens não importam. A carga vai em romano: ferro(III), ferro (III) ou ferro III.
            </Txt>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 32, gap: 16, width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  paper: { borderRadius: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, alignItems: 'center', gap: 4 },
  paperHead: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  form: { gap: 10 },
  input: { minHeight: 54, borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FONT.ui, fontSize: 18 },
  note: { borderRadius: 10, padding: 10 },
});
