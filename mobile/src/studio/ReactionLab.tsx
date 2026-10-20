/** The studio's reaction lab: pick a reaction, see the computed product, open it next. */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { labReactions } from '../../../src/course/lab.ts';
import { COLUMN, FONT, GUTTER, SIZE, useTheme } from '../theme.ts';
import { Btn, Paper, Press, Txt } from '../ui/kit.tsx';
import { SchemeView } from '../ui/SchemeView.tsx';

export function ReactionLab({ smiles, onOpen }: { smiles: string; onOpen: (smiles: string) => void }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const reactions = useMemo(() => labReactions(smiles), [smiles]);
  const [chosen, setChosen] = useState<string | undefined>();
  if (!reactions.length) return null;
  const current = reactions.find((r) => r.id === chosen) ?? reactions[0];
  // Room for a structure beside the arrow or a "+ H₂O" on the same line.
  const room = Math.min(width, COLUMN) - GUTTER * 2 - 24 - 80;
  return (
    <View style={styles.lab}>
      <View>
        <Txt variant="heading" accessibilityRole="header">
          Laboratório de reações
        </Txt>
        <Txt variant="small" tone="muted" style={{ marginTop: 2 }}>
          Escolha uma reação: o produto é calculado a partir da estrutura.
        </Txt>
      </View>
      <View style={styles.chips} accessibilityRole="tablist" accessibilityLabel="Reações possíveis">
        {reactions.map((r) => {
          const on = r.id === current.id;
          return (
            <Press
              key={r.id}
              onPress={() => setChosen(r.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: on ? c.magenta : c.rule, backgroundColor: on ? c.magentaWash : c.surface }]}
            >
              <Text style={[styles.chipText, { color: on ? c.magenta : c.text }]}>{r.name}</Text>
            </Press>
          );
        })}
      </View>
      <Paper style={styles.result}>
        <SchemeView key={`${smiles}-${current.id}`} scheme={current.scheme} animate maxWidth={room} />
        <Text style={styles.note}>{current.note}</Text>
      </Paper>
      {current.product && <Btn label="Abrir o produto no editor" onPress={() => onOpen(current.product!.smiles)} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  lab: { gap: 12, marginTop: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 2, borderRadius: 999, justifyContent: 'center' },
  chipText: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  result: { gap: 12, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  note: { fontFamily: FONT.ui, fontSize: SIZE.small, lineHeight: SIZE.small * 1.35, color: '#3b4651', textAlign: 'center' },
});
