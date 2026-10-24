/** The bottom sheets: how it works, statistics, and preferences. */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { memory } from '../../../src/app/persist.ts';
import { DAILY_SIZE } from '../../../src/nomenclatura/daily.ts';
import { CATEGORIES, CATEGORY_PLURAL } from '../../../src/nomenclatura/pieces.ts';
import { stats } from '../../../src/nomenclatura/play.ts';
import { markHelpSeen, useSave } from '../../../src/nomenclatura/store.ts';
import { setPrefs, usePrefs } from '../prefs.ts';
import { FONT, useTheme } from '../theme.ts';
import { Segmented } from '../ui/controls.tsx';
import { Btn, Meter, Rich, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useCountdown, useToday } from './clock.ts';

export type SheetName = 'help' | 'stats' | 'prefs';

const opened = memory<SheetName | null>(null);

export const openSheet = (name: SheetName) => opened.set(name);
const closeSheet = () => opened.set(null);

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

function Help() {
  return (
    <>
      <Txt variant="title" accessibilityRole="header">
        Como funciona
      </Txt>
      <Rich text={`Todo dia, um desafio novo com **${DAILY_SIZE} compostos**: dois **ácidos**, duas **bases**, dois **sais** e dois **orgânicos**, os mesmos para todo mundo.`} />
      <Rich text="Veja a fórmula (ou a estrutura, nos orgânicos) e **escreva o nome IUPAC** no teclado. Uma resposta por composto." />
      <Rich text={'Acentos, maiúsculas e hífens não importam. A carga do metal vai em **romano**: ferro(III), ferro (III) ou ferro III. Nos orgânicos, vale o estilo atual ou o antigo: propan-\u20602-\u2060ol ou 2-\u2060propanol.'} />
      <Rich text="Escreveu o nome tradicional ou o usual (sulfato férrico, soda cáustica, acetona)? O app avisa e você tenta de novo com o IUPAC." />
      <Rich text="Depois de cada resposta, o **porquê** do nome: o Nox, as cargas, a cadeia e a regra." />
      <Rich text="Termine o desafio todo dia para manter a **sequência**. Um novo sai à meia-noite. No **Treino** você pratica quanto quiser; no **Guia** estão as regras e a tabela de íons." />
    </>
  );
}

function Statistics() {
  const c = useTheme();
  const n = useToday();
  const save = useSave();
  const countdown = useCountdown();
  const s = useMemo(() => stats(save.days, n), [save.days, n]);
  return (
    <>
      <Txt variant="title" accessibilityRole="header">
        Estatísticas
      </Txt>
      <View style={styles.numbers}>
        {[
          [String(s.complete), 'desafios completos'],
          [pct(s.correct, s.answered), 'acertos'],
          [String(s.streak), 'sequência'],
          [String(s.best), 'recorde'],
        ].map(([value, label]) => (
          <View key={label} style={styles.number}>
            <Text style={[styles.numberValue, { color: c.text }]}>{value}</Text>
            <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
              {label}
            </Txt>
          </View>
        ))}
      </View>
      <Txt variant="kicker" tone="muted">
        Acertos por função
      </Txt>
      {CATEGORIES.map((cat) => {
        const b = s.byCategory[cat];
        return (
          <View key={cat} style={styles.catRow}>
            <Txt style={{ width: 88 }}>{CATEGORY_PLURAL[cat]}</Txt>
            <Meter value={b.answered ? b.correct / b.answered : 0} style={{ flex: 1 }} />
            <Txt variant="small" tone="muted" style={{ width: 64, textAlign: 'right' }}>
              {b.correct}/{b.answered}
            </Txt>
          </View>
        );
      })}
      <Txt tone="muted">
        Próximo desafio em <Text style={{ fontFamily: FONT.uiBold, color: c.text }}>{countdown}</Text>
      </Txt>
      <Txt variant="small" tone="muted">
        A sequência conta os dias seguidos em que você completou o desafio.
      </Txt>
    </>
  );
}

function Preferences() {
  const prefs = usePrefs();
  return (
    <>
      <Txt variant="title" accessibilityRole="header">
        Ajustes
      </Txt>
      <Txt variant="strong">Tema</Txt>
      <Segmented
        label="Tema"
        value={prefs.theme}
        onChange={(theme) => setPrefs({ theme })}
        options={[
          { id: 'system', label: 'Sistema' },
          { id: 'light', label: 'Claro' },
          { id: 'dark', label: 'Escuro' },
        ]}
      />
      <Btn label="Como funciona" onPress={() => openSheet('help')} />
      <Txt variant="small" tone="muted">
        Seus desafios ficam salvos neste aparelho.
      </Txt>
    </>
  );
}

export function SheetHost() {
  const open = opened.use();
  const close = () => {
    if (open === 'help') markHelpSeen();
    closeSheet();
  };
  return (
    <Sheet visible={open !== null} onClose={close}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {open === 'help' && <Help />}
        {open === 'stats' && <Statistics />}
        {open === 'prefs' && <Preferences />}
        <Btn kind="quiet" label="Fechar" onPress={close} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 8 },
  numbers: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { flex: 1, alignItems: 'center' },
  numberValue: { fontFamily: FONT.displayHeavy, fontSize: 30 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
