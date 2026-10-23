/** After a round: the name, how many tries it took, and why the name is what it is. */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Compound } from '../../../src/nomenclatura/catalog.ts';
import { explain } from '../../../src/nomenclatura/explain.ts';
import type { RoundState } from '../../../src/nomenclatura/grade.ts';
import { useTheme, useTiles } from '../theme.ts';
import { HintIcon } from '../ui/Icons.tsx';
import { Card, Rich, Txt } from '../ui/kit.tsx';

const CHEERS = ['De primeira!', 'Na segunda!', 'Na terceira!', 'Na quarta!', 'Na quinta!', 'No limite!'];

export function RoundResult({ compound, state, children }: { compound: Compound; state: RoundState; children?: ReactNode }) {
  const c = useTheme();
  const tiles = useTiles();
  const look = state.won ? tiles.right : tiles.wrong;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.banner, { backgroundColor: look.bg }]}>
        <Txt variant="kicker" style={{ color: look.fg }}>
          {state.won ? CHEERS[state.guesses.length - 1] : 'Não foi dessa vez. Era:'}
        </Txt>
        <Txt variant="title" style={{ color: look.fg }} accessibilityRole="header">
          {compound.name}
        </Txt>
        {compound.aka.length > 0 && (
          <Txt variant="small" style={{ color: look.fg }}>
            Também chamado {compound.aka.join(', ')}
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
          <Txt variant="small" style={{ flex: 1, color: c.text }}>
            {compound.fact}
          </Txt>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  banner: { borderRadius: 14, padding: 14, gap: 2 },
  why: { gap: 6 },
  line: { fontSize: 15.5, lineHeight: 22 },
  fact: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
});
