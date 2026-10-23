/**
 * The guide: how acids, bases and salts are named, and the ions behind every name in the game.
 * The tables come from the game's own pieces, so they always match what the board accepts.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ANIONS, parentAcid } from '../../../src/nomenclatura/catalog.ts';
import { ionText } from '../../../src/nomenclatura/formula.ts';
import { CATIONS, ROMAN } from '../../../src/nomenclatura/pieces.ts';
import { FONT, useTheme } from '../theme.ts';
import { Card, Rich, Txt, keepSuffixes } from '../ui/kit.tsx';
import { Page } from '../ui/Page.tsx';
import { TopBar } from '../ui/TopBar.tsx';

function Section({ title, emoji, children }: { title: string; emoji?: string; children: ReactNode }) {
  return (
    <Card style={styles.section}>
      <Txt variant="heading" accessibilityRole="header">
        {emoji ? `${emoji} ` : ''}
        {title}
      </Txt>
      {children}
    </Card>
  );
}

/** A table row: formula on the left (exam-booklet type), words on the right, `**bold**` for the part that matters. */
function Row({ formula, children, dim }: { formula: string; children: string | string[]; dim?: string }) {
  const c = useTheme();
  const text = keepSuffixes(Array.isArray(children) ? children.join('') : children);
  return (
    <View style={[styles.row, { borderTopColor: c.benchDeep }]}>
      <Text style={[styles.formula, { color: c.text }]}>{formula}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cell, { color: c.text }]}>
          {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
            i % 2 ? (
              <Text key={i} style={{ fontFamily: FONT.uiBold, color: c.magenta }}>
                {part}
              </Text>
            ) : (
              part
            ),
          )}
        </Text>
        {dim ? <Text style={[styles.dim, { color: c.muted }]}>{dim}</Text> : null}
      </View>
    </View>
  );
}

export function GuideScreen() {
  return (
    <Page header={<TopBar subtitle="Guia de nomenclatura" />}>
      <View style={styles.stack}>
        <Txt tone="muted">
          Toda a nomenclatura do jogo cabe nestas regras. O ENEM cobra os nomes oficiais (IUPAC) e também os tradicionais, que aparecem aqui ao lado.
        </Txt>

        <Section title="Ácidos" emoji="🍋">
          <Rich text="**Sem oxigênio (hidrácidos):** ácido + elemento + **-ídrico**." />
          <Row formula="HCl">ácido clorídrico</Row>
          <Row formula="H₂S">ácido sulfídrico</Row>
          <Row formula="HCN">ácido cianídrico</Row>
          <Rich text="**Com oxigênio (oxiácidos):** o sufixo depende do Nox do elemento central. Conte +1 para cada H e −2 para cada O; o elemento fecha a soma em zero." />
          <Row formula="HClO" dim="Nox +1, o menor">
            ácido **hipo**cloroso
          </Row>
          <Row formula="HClO₂" dim="Nox +3">
            ácido clor**oso**
          </Row>
          <Row formula="HClO₃" dim="Nox +5">
            ácido clór**ico**
          </Row>
          <Row formula="HClO₄" dim="Nox +7, o maior">
            ácido **per**clórico
          </Row>
          <Rich text="Com só dois oxiácidos, o menor Nox é **-oso** e o maior **-ico**: H₂SO₃ sulfuroso e H₂SO₄ sulfúrico; HNO₂ nitroso e HNO₃ nítrico." />
          <Rich text="**orto-, meta- e piro-** dizem quanta água o ácido tem: meta = orto − H₂O; piro = 2 orto − H₂O." />
          <Row formula="H₃PO₄">ácido (orto)fosfórico</Row>
          <Row formula="HPO₃">ácido metafosfórico</Row>
          <Row formula="H₄P₂O₇">ácido pirofosfórico</Row>
          <Rich text="**tio-** troca um O por S: H₂SO₄ → H₂S₂O₃, ácido tiossulfúrico." />
        </Section>

        <Section title="Bases" emoji="🧼">
          <Rich text="**hidróxido de** + nome do cátion. A carga do cátion é o número de OH⁻." />
          <Row formula="NaOH">hidróxido de sódio</Row>
          <Row formula="Ca(OH)₂">hidróxido de cálcio</Row>
          <Rich text="Metal com **mais de uma carga** leva a carga em romano. No nome tradicional, **-oso** é a carga menor e **-ico** a maior." />
          <Row formula="Fe(OH)₂" dim="tradicional: hidróxido ferroso">
            hidróxido de ferro(II)
          </Row>
          <Row formula="Fe(OH)₃" dim="tradicional: hidróxido férrico">
            hidróxido de ferro(III)
          </Row>
        </Section>

        <Section title="Sais" emoji="🧂">
          <Rich text="**ânion + de + cátion.** O ânion vem do ácido, trocando o sufixo; os prefixos ficam." />
          <Row formula="-ídrico">→ -eto (clorídrico → cloreto)</Row>
          <Row formula="-oso">→ -ito (hipocloroso → hipoclorito)</Row>
          <Row formula="-ico">→ -ato (sulfúrico → sulfato)</Row>
          <Rich text="Para lembrar: o mosqu**ito** teim**oso** e o b**ico** de p**ato**." />
          <Rich text="A carga do cátion sai da conta das cargas: em Fe₂(SO₄)₃, 3 × (−2) = −6 dividido entre 2 Fe dá Fe³⁺." />
          <Row formula="Fe₂(SO₄)₃" dim="tradicional: sulfato férrico">
            sulfato de ferro(III)
          </Row>
          <Rich text="Ânion que ainda tem H do ácido ganha **hidrogeno-** (ou **di-hidrogeno-**)." />
          <Row formula="NaHCO₃" dim="o popular bicarbonato de sódio">
            hidrogenocarbonato de sódio
          </Row>
          <Row formula="NaH₂PO₄">di-hidrogenofosfato de sódio</Row>
        </Section>

        <Section title="Ânions do jogo">
          {ANIONS.map((a) => (
            <Row key={a.name} formula={ionText(a.formula, -a.charge)} dim={`do ${parentAcid(a)}`}>
              {a.name}
              {a.common ? ` (${a.common})` : ''}
            </Row>
          ))}
        </Section>

        <Section title="Cátions do jogo">
          {CATIONS.map((k) => (
            <Row
              key={k.id}
              formula={k.charges.map((q) => ionText(k.symbol, q)).join('  ')}
              dim={k.traditional ? k.charges.map((q) => `${ROMAN[q]}: ${k.traditional![q]}`).join(' · ') : 'carga única: sem romano'}
            >
              {k.charges.length > 1 ? k.charges.map((q) => `${k.label}(${ROMAN[q]})`).join(', ') : k.label}
            </Row>
          ))}
        </Section>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  section: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 6, alignItems: 'baseline' },
  formula: { width: 92, fontFamily: FONT.mol, fontSize: 16 },
  cell: { fontFamily: FONT.ui, fontSize: 15.5, lineHeight: 21 },
  dim: { fontFamily: FONT.ui, fontSize: 13, lineHeight: 18 },
});
