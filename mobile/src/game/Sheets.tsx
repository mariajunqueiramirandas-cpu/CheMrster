/** The bottom sheets: how to play, statistics (with today's result to share), and preferences. */
import { useMemo } from 'react';
import { memory } from '../../../src/app/persist.ts';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { daily } from '../../../src/nomenclatura/daily.ts';
import { MAX_TRIES, type Verdict } from '../../../src/nomenclatura/grade.ts';
import { CATEGORIES, CATEGORY_PLURAL } from '../../../src/nomenclatura/pieces.ts';
import { type Stats, isComplete, roundsOf, shareText, stats } from '../../../src/nomenclatura/play.ts';
import { markHelpSeen, useSave } from '../../../src/nomenclatura/store.ts';
import { setPrefs, usePrefs } from '../prefs.ts';
import { FONT, useTheme, useTiles } from '../theme.ts';
import { Segmented, Toggle } from '../ui/controls.tsx';
import { CopyIcon, ShareIcon } from '../ui/Icons.tsx';
import { Btn, Card, IconBtn, Meter, Rich, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { useCountdown, useToday } from './clock.ts';
import { copy, share } from './share.ts';

export type SheetName = 'help' | 'stats' | 'prefs';

const opened = memory<SheetName | null>(null);

export const openSheet = (name: SheetName) => opened.set(name);
const closeSheet = () => opened.set(null);

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–');

/** A sample row for the rules: what the colours mean. */
function Example({ cells }: { cells: Array<[string, Verdict, boolean?]> }) {
  const tiles = useTiles();
  const c = useTheme();
  return (
    <View style={styles.example}>
      {cells.map(([text, v, joinAfter], i) => (
        <View key={i} style={styles.exampleCell}>
          <View style={[styles.exampleTile, { backgroundColor: tiles[v].bg }]}>
            <Text style={[styles.exampleText, { color: tiles[v].fg }]}>{text}</Text>
          </View>
          {joinAfter && <Text style={[styles.exampleJoin, { color: c.muted }]}>de</Text>}
        </View>
      ))}
    </View>
  );
}

function Legend({ v, text }: { v: Verdict; text: string }) {
  const tiles = useTiles();
  return (
    <View style={styles.legend}>
      <View style={[styles.swatch, { backgroundColor: tiles[v].bg }]} />
      <Rich text={text} variant="body" style={{ flex: 1 }} />
    </View>
  );
}

function Help() {
  return (
    <>
      <Txt variant="title" accessibilityRole="header">
        Como jogar
      </Txt>
      <Rich text="Todo dia, três compostos: um **ácido** 🍋, uma **base** 🧼 e um **sal** 🧂. Monte o nome IUPAC de cada um com as peças do teclado, em até **6 tentativas**." />
      <Rich text="O nome tem casas: **prefixo**, **radical** e **sufixo** (o ânion), **cátion** e **carga** em romano. Prefixo e carga podem ficar vazios: casa tracejada." />
      <Txt variant="strong">Exemplo: Fe₂(SO₄)₃</Txt>
      <Example cells={[['—', 'right'], ['sulf', 'right'], ['ito', 'close', true], ['ferro', 'right'], ['II', 'close']]} />
      <Legend v="right" text="**Certo**: a peça é essa (inclusive uma casa vazia que devia ficar vazia)." />
      <Legend v="close" text="**Quase**: é da mesma família, mas não é essa: -ito no lugar de -ato, II no lugar de III, per- no lugar de hipo-." />
      <Legend v="wrong" text="**Errado**: a peça não é essa, ou faltou uma peça na casa." />
      <Rich text="Depois de cada composto, o **porquê** do nome: o Nox, as cargas e a regra." />
      <Rich text="Um desafio novo à meia-noite. Segunda e terça são leves; sábado e domingo, pesados. No **Treino** você joga quantos quiser; no **Guia** estão as regras e a tabela de íons." />
    </>
  );
}

function Bars({ s }: { s: Stats }) {
  const c = useTheme();
  const max = Math.max(1, ...s.tries, s.losses);
  const rows = [...s.tries.map((n, i) => ({ label: String(i + 1), n })), { label: 'X', n: s.losses }];
  return (
    <View style={styles.bars} accessibilityLabel={`Tentativas: ${rows.map((r) => `${r.label}: ${r.n}`).join(', ')}`}>
      {rows.map((r) => (
        <View key={r.label} style={styles.barRow}>
          <Text style={[styles.barLabel, { color: c.text }]}>{r.label}</Text>
          <View style={{ flex: 1 }}>
            <View style={[styles.bar, { width: `${Math.max(8, (r.n / max) * 100)}%`, backgroundColor: r.n ? c.magenta : c.benchDeep }]}>
              <Text style={[styles.barValue, { color: r.n ? '#fff' : c.muted }]}>{r.n}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function Statistics() {
  const c = useTheme();
  const n = useToday();
  const save = useSave();
  const { contrast } = usePrefs();
  const countdown = useCountdown();
  const s = useMemo(() => stats(save.days, n), [save.days, n]);
  const rounds = useMemo(() => roundsOf(n, save.days[n], daily(n)), [save.days, n]);
  const done = isComplete(rounds);
  const text = shareText(n, save.days[n], s.streak, contrast ? 'contrast' : 'normal');

  return (
    <>
      <Txt variant="title" accessibilityRole="header">
        Estatísticas
      </Txt>
      <View style={styles.numbers}>
        {[
          [String(s.played), 'dias jogados'],
          [pct(s.wins, s.rounds), 'acertos'],
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

      <Card style={{ gap: 10 }}>
        <Txt variant="strong">Desafio #{n}</Txt>
        {done ? (
          <>
            <Text style={[styles.squares, { color: c.text }]} accessibilityLabel="Seu resultado de hoje">
              {text}
            </Text>
            <View style={styles.actions}>
              <Btn kind="primary" label="Compartilhar" icon={(color) => <ShareIcon color={color} />} onPress={() => share(text)} style={{ flex: 1 }} />
              <IconBtn label="Copiar resultado" onPress={() => copy(text)} style={[styles.copy, { borderColor: c.rule }]}>
                <CopyIcon color={c.text} />
              </IconBtn>
            </View>
          </>
        ) : (
          <Txt tone="muted">Termine os três compostos de hoje para ver e compartilhar seu resultado.</Txt>
        )}
        <Txt variant="small" tone="muted">
          Próximo desafio em <Text style={{ fontFamily: FONT.uiBold, color: c.text }}>{countdown}</Text>
        </Txt>
      </Card>

      <Txt variant="kicker" tone="muted">
        Tentativas por acerto
      </Txt>
      <Bars s={s} />

      <Txt variant="kicker" tone="muted">
        Por função
      </Txt>
      {CATEGORIES.map((cat) => {
        const b = s.byCategory[cat];
        return (
          <View key={cat} style={styles.catRow}>
            <Txt style={{ width: 70 }}>{CATEGORY_PLURAL[cat]}</Txt>
            <Meter value={b.rounds ? b.wins / b.rounds : 0} style={{ flex: 1 }} />
            <Txt variant="small" tone="muted" style={{ width: 64, textAlign: 'right' }}>
              {b.wins}/{b.rounds}
            </Txt>
          </View>
        );
      })}
      <Txt variant="small" tone="muted">
        A sequência conta os dias seguidos em que você terminou o desafio. São {MAX_TRIES} tentativas por composto.
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
      <Toggle label="Alto contraste (laranja e azul)" value={prefs.contrast} onChange={(contrast) => setPrefs({ contrast })} />
      <Btn label="Como jogar" onPress={() => openSheet('help')} />
      <Txt variant="small" tone="muted">
        Seus jogos ficam salvos neste aparelho.
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
  example: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  exampleCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exampleTile: { minWidth: 40, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  exampleText: { fontFamily: FONT.uiBold, fontSize: 14 },
  exampleJoin: { fontFamily: FONT.ui, fontSize: 13 },
  legend: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  swatch: { width: 22, height: 22, borderRadius: 5, marginTop: 2 },
  numbers: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { flex: 1, alignItems: 'center' },
  numberValue: { fontFamily: FONT.displayHeavy, fontSize: 30 },
  squares: { fontSize: 18, lineHeight: 26 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  copy: { borderWidth: 2, width: 52, height: 48, borderRadius: 999 },
  bars: { gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 14, fontFamily: FONT.uiBold, fontSize: 14 },
  bar: { minHeight: 22, borderRadius: 4, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 6 },
  barValue: { fontFamily: FONT.uiBold, fontSize: 13 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
