/** After an answer: right or wrong, the IUPAC name, and why the name is what it is. */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Compound } from '../../../src/nomenclatura/catalog.ts';
import { explain } from '../../../src/nomenclatura/explain.ts';
import { useTheme } from '../theme.ts';
import { CheckIcon, CrossIcon, HintIcon } from '../ui/Icons.tsx';
import { Card, Rich, Txt } from '../ui/kit.tsx';

export function Result({ compound, typed, correct, children }: { compound: Compound; typed: string; correct: boolean; children?: ReactNode }) {
  const c = useTheme();
  const others = [...compound.traditional, ...compound.common];
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.banner, { backgroundColor: correct ? c.rightWash : c.wrongWash, borderColor: correct ? c.right : c.wrong }]}>
        <View style={styles.verdict}>
          {correct ? <CheckIcon color={c.right} /> : <CrossIcon color={c.wrong} />}
          <Txt variant="strong" tone={correct ? 'right' : 'wrong'}>
            {correct ? 'Certo!' : 'Não é isso.'}
          </Txt>
        </View>
        {!correct && (
          <Txt variant="small" tone="muted">
            Você escreveu: {typed}
          </Txt>
        )}
        <Txt variant="title" accessibilityRole="header">
          {compound.name}
        </Txt>
        {others.length > 0 && (
          <Txt variant="small" tone="muted">
            Também chamado {others.join(', ')}
          </Txt>
        )}
      </View>
      <Card style={styles.why}>
        <Txt variant="kicker" tone="magenta">
          Por que esse nome
        </Txt>
        {explain(compound).map((line, i) => (
          <Rich key={i} text={line} variant="body" style={styles.line} />
        ))}
      </Card>
      {compound.fact && (
        <View style={[styles.fact, { backgroundColor: c.cobaltWash }]}>
          <HintIcon color={c.cobalt} width={20} height={20} />
          <Txt variant="small" style={{ flex: 1 }}>
            {compound.fact}
          </Txt>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  banner: { borderRadius: 14, borderWidth: 2, padding: 14, gap: 4 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  why: { gap: 6 },
  line: { fontSize: 15.5, lineHeight: 22 },
  fact: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
});
