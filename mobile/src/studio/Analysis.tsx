/** What the engine reads off a structure: formula, molar mass, chain, chiral carbons, functions. */
import { type ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { chiralCarbons, classifyChain, functionalGroups, molarMass } from '../../../src/chem/analysis.ts';
import { subscript } from '../../../src/course/kit.ts';
import { moleculeFromSmiles } from '../../../src/nanquim/index.ts';
import { FONT, SIZE, useTheme } from '../theme.ts';
import { Txt } from '../ui/kit.tsx';

export function Analysis({ smiles }: { smiles: string }) {
  const c = useTheme();
  const info = useMemo(() => {
    const mol = moleculeFromSmiles(smiles);
    const groups = [...new Set(functionalGroups(mol).map((g) => g.id))];
    const chain = classifyChain(mol);
    const chainText = [
      chain.fechada ? (chain.aromatica ? 'fechada, aromática' : 'fechada') : 'aberta',
      chain.ramificada ? 'ramificada' : 'normal',
      chain.insaturada ? 'insaturada' : 'saturada',
      chain.heterogenea ? 'heterogênea' : 'homogênea',
    ];
    return { formula: subscript(mol.formula()), groups, chain: chainText, chiral: chiralCarbons(mol).length, mass: molarMass(mol) };
  }, [smiles]);

  const Item = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => (
    <View style={[styles.item, wide && styles.wide]}>
      <Txt variant="small" tone="muted">
        {label}
      </Txt>
      {children}
    </View>
  );

  return (
    <View style={[styles.box, { borderColor: c.benchDeep }]}>
      <Item label="Fórmula molecular">
        <Text style={[styles.formula, { color: c.text }]}>{info.formula}</Text>
      </Item>
      {info.mass !== undefined && (
        <Item label="Massa molar">
          <Txt variant="strong">{info.mass.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g/mol</Txt>
        </Item>
      )}
      <Item label="Cadeia" wide>
        <Txt variant="strong">{info.chain.join(', ')}</Txt>
      </Item>
      <Item label="Carbonos quirais">
        <Txt variant="strong">{info.chiral}</Txt>
      </Item>
      <Item label="Funções orgânicas" wide>
        {info.groups.length ? (
          <View style={styles.chips}>
            {info.groups.map((g) => (
              <View key={g} style={[styles.chip, { backgroundColor: c.magentaWash }]}>
                <Text style={[styles.chipText, { color: c.magenta }]}>{g}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Txt variant="strong">Nenhuma: só carbono e hidrogênio.</Txt>
        )}
      </Item>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, padding: 16, borderRadius: 14, borderWidth: 2 },
  item: { width: '50%', paddingRight: 12, gap: 2 },
  wide: { width: '100%' },
  formula: { fontFamily: FONT.display, fontSize: SIZE.step1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingVertical: 2, paddingHorizontal: 12, borderRadius: 999 },
  chipText: { fontFamily: FONT.ui, fontSize: 15 },
});
