/**
 * Reaction schemes the way textbooks print them (src/app/components/SchemeView.tsx):
 * structures and formulas joined by "+", an arrow with reagents over it and conditions
 * under it, and a dashed "?" for the unknown.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { readableFormula } from '../../../src/course/kit.ts';
import type { MolSpec, Scheme, Term } from '../../../src/course/types.ts';
import { depict } from '../../../src/nanquim/index.ts';
import { FONT } from '../theme.ts';
import { type AtomMark, MoleculeView } from './MoleculeView.tsx';

/** Long chains (and, for answer tiles, written-out formulas) need a full row to stay legible. */
export function isWide(spec: MolSpec, { formulas = true } = {}): boolean {
  if (formulas && spec.formula && spec.formula !== 'skeletal') return true;
  const { viewBox } = depict(spec.smiles, { formula: spec.formula, polymer: spec.polymer, conventions: 'enem', style: 'enem' });
  return viewBox.width / viewBox.height > 2.4;
}

/** A MolSpec drawn with the ENEM look. */
export function SpecView({
  spec,
  size = 30,
  animate,
  marks,
  maxWidth,
}: {
  spec: MolSpec;
  size?: number;
  animate?: boolean;
  marks?: number[];
  maxWidth?: number;
}) {
  const atomMarks = marks?.length ? Object.fromEntries(marks.map((a) => [a, 'selected' as AtomMark])) : undefined;
  return (
    <MoleculeView
      smiles={spec.smiles}
      formula={spec.formula ?? (spec.polymer ? undefined : readableFormula(spec.smiles))}
      polymer={spec.polymer}
      outline={spec.highlight}
      caption={spec.caption}
      source={spec.source}
      size={size}
      animate={animate}
      marks={atomMarks}
      title={spec.name ?? spec.caption}
      maxWidth={maxWidth}
    />
  );
}

const termText = (t: Term) => ('mol' in t ? (t.mol.name ?? t.mol.caption ?? 'estrutura') : 'text' in t ? t.text : 'substância desconhecida');

/** "propeno + HBr → ?" for screen readers. */
export function describeScheme(s: Scheme): string {
  const side = (terms: Term[]) => terms.map((t) => `${t.coef ? `${t.coef} ` : ''}${termText(t)}`).join(' + ');
  const cond = [s.over, s.under].filter(Boolean).join(', ');
  return `Reação: ${side(s.left)} ${s.reversible ? 'em equilíbrio com' : 'forma'} ${side(s.right)}${cond ? ` (${cond})` : ''}`;
}

function TermView({ term, size, animate, maxWidth }: { term: Term; size: number; animate?: boolean; maxWidth?: number }) {
  const coef = term.coef ? <Text style={styles.coef}>{term.coef}</Text> : null;
  if ('mol' in term) {
    return (
      <View style={styles.term}>
        {coef}
        <SpecView spec={term.mol} size={size} animate={animate} maxWidth={maxWidth} />
      </View>
    );
  }
  if ('text' in term) {
    return (
      <View style={styles.term}>
        {coef}
        <Text style={styles.text}>{term.text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.term}>
      {coef}
      <View style={styles.unknown}>
        <Text style={styles.unknownText}>?</Text>
      </View>
    </View>
  );
}

function Arrow({ over, under, reversible }: { over?: string; under?: string; reversible?: boolean }) {
  const label = Math.max(over?.length ?? 0, under?.length ?? 0);
  const w = Math.max(54, Math.round(label * 7.4 + 18));
  return (
    <View style={styles.arrow}>
      <Text style={styles.cond}>{over ?? ''}</Text>
      <Svg width={w} height={14} viewBox={`0 0 ${w} 14`} fill="none" stroke="#000" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
        {reversible ? (
          <>
            <Path d={`M2 4.5H${w - 3}L${w - 10} 0.8`} />
            <Path d={`M${w - 2} 9.5H3L10 13.2`} />
          </>
        ) : (
          <Path d={`M2 7H${w - 3}M${w - 10} 2.6L${w - 2.5} 7L${w - 10} 11.4`} />
        )}
      </Svg>
      <Text style={styles.cond}>{under ?? ''}</Text>
    </View>
  );
}

/** `maxWidth` is the room on the paper; structures wider than it shrink. */
export function SchemeView({ scheme, size = 26, animate, maxWidth }: { scheme: Scheme; size?: number; animate?: boolean; maxWidth?: number }) {
  const side = (terms: Term[], key: string) =>
    terms.map((t, i) => (
      <View key={`${key}${i}`} style={styles.slot}>
        {i > 0 && <Text style={styles.plus}>+</Text>}
        <TermView term={t} size={size} animate={animate} maxWidth={maxWidth} />
      </View>
    ));
  // The arrow travels with the products, so a wrapped scheme breaks before the arrow.
  return (
    <View style={styles.scheme} accessible accessibilityRole="image" accessibilityLabel={describeScheme(scheme)}>
      <View style={styles.side}>{side(scheme.left, 'l')}</View>
      <View style={styles.side}>
        <Arrow over={scheme.over} under={scheme.under} reversible={scheme.reversible} />
        {side(scheme.right, 'r')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scheme: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', rowGap: 10 },
  side: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  slot: { flexDirection: 'row', alignItems: 'center' },
  term: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coef: { fontFamily: FONT.mol, fontSize: 17, color: '#000' },
  text: { fontFamily: FONT.mol, fontSize: 17, color: '#000' },
  plus: { fontFamily: FONT.mol, fontSize: 18, color: '#000', marginHorizontal: 8 },
  unknown: {
    minWidth: 52,
    height: 44,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#c0157a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownText: { fontFamily: FONT.display, fontSize: 22, color: '#c0157a' },
  arrow: { alignItems: 'center', marginHorizontal: 6 },
  cond: { fontFamily: FONT.mol, fontSize: 13, color: '#000', minHeight: 16, textAlign: 'center' },
});
