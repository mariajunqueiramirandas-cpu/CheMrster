/**
 * Today's challenge: the acid, the base and the salt of the day, played in any order. When the
 * third is done, the statistics come up with the result to share.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { daily, puzzleDate } from '../../../src/nomenclatura/daily.ts';
import { MAX_TRIES } from '../../../src/nomenclatura/grade.ts';
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL, type Category } from '../../../src/nomenclatura/pieces.ts';
import { type Round as RoundData, isComplete, roundsOf } from '../../../src/nomenclatura/play.ts';
import { markHelpSeen, playGuess, saveStore, useSave } from '../../../src/nomenclatura/store.ts';
import { useToday } from '../game/clock.ts';
import { Round } from '../game/Round.tsx';
import { openSheet } from '../game/Sheets.tsx';
import { FONT, GUTTER, useTheme, useTiles } from '../theme.ts';
import { ArrowRightIcon, ChartIcon } from '../ui/Icons.tsx';
import { Btn, Press } from '../ui/kit.tsx';
import { TopBar } from '../ui/TopBar.tsx';

const dateLabel = (n: number) =>
  puzzleDate(n)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    .replace(/\.| de/g, '');

function status(r: RoundData): string {
  if (r.state.won) return `${r.state.guesses.length}/${MAX_TRIES}`;
  if (r.state.lost) return `X/${MAX_TRIES}`;
  return r.state.guesses.length ? `${r.state.guesses.length}/${MAX_TRIES}` : 'jogar';
}

function Tabs({ rounds, value, onChange }: { rounds: Record<Category, RoundData>; value: Category; onChange: (c: Category) => void }) {
  const c = useTheme();
  const tiles = useTiles();
  const { width, height } = useWindowDimensions();
  const short = height < 780;
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {CATEGORIES.map((cat) => {
        const r = rounds[cat];
        const on = cat === value;
        const look = r.state.won ? tiles.right : r.state.lost ? tiles.wrong : null;
        return (
          <Press
            key={cat}
            sink={1}
            onPress={() => onChange(cat)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${CATEGORY_LABEL[cat]}: ${r.state.won ? 'acertou' : r.state.lost ? 'errou' : 'em aberto'}`}
            style={[styles.tab, short && styles.tabShort, { borderColor: on ? c.magenta : c.rule, backgroundColor: on ? c.magentaWash : c.surface }]}
          >
            <Text style={[styles.tabLabel, { color: c.text }]}>
              {short && width < 400 ? '' : `${CATEGORY_EMOJI[cat]} `}
              {CATEGORY_LABEL[cat]}
            </Text>
            {(!short || r.state.guesses.length > 0) && (
              <View style={[styles.badge, { backgroundColor: look?.bg ?? 'transparent' }]}>
                <Text style={[styles.badgeText, { color: look?.fg ?? c.muted }]}>{status(r)}</Text>
              </View>
            )}
          </Press>
        );
      })}
    </View>
  );
}

export function DailyScreen() {
  const c = useTheme();
  const n = useToday();
  const save = useSave();
  const today = useMemo(() => daily(n), [n]);
  const rounds = useMemo(() => roundsOf(n, save.days[n], today), [n, save.days, today]);
  const firstOpen = (r: Record<Category, RoundData>) => CATEGORIES.find((cat) => !r[cat].state.done) ?? 'acido';
  const [cat, setCat] = useState<Category>(() => firstOpen(rounds));
  const complete = isComplete(rounds);

  // A new day starts on its first open round.
  const shownDay = useRef(n);
  useEffect(() => {
    if (shownDay.current === n) return;
    shownDay.current = n;
    setCat(firstOpen(roundsOf(n, saveStore.get().days[n])));
  }, [n]);

  // First visit: how to play.
  useEffect(() => {
    if (!saveStore.get().helpSeen) {
      const t = setTimeout(() => openSheet('help'), 400);
      return () => clearTimeout(t);
    }
  }, []);

  // Finishing the day here brings up the statistics, once the last tiles have turned.
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      const t = setTimeout(() => openSheet('stats'), 2600);
      wasComplete.current = true;
      return () => clearTimeout(t);
    }
    wasComplete.current = complete;
  }, [complete]);

  const next = CATEGORIES.find((k) => k !== cat && !rounds[k].state.done);
  const round = rounds[cat];

  return (
    <View style={[styles.root, { backgroundColor: c.bench }]}>
      <TopBar subtitle={`Desafio #${n} · ${dateLabel(n)}`} />
      <Tabs rounds={rounds} value={cat} onChange={setCat} />
      <Round
        key={`${n}:${cat}:${round.compound.id}`}
        compound={round.compound}
        guesses={round.state.guesses}
        onGuess={(g) => {
          markHelpSeen();
          return playGuess(n, round.compound, g);
        }}
        kicker={`${CATEGORY_LABEL[cat]} do dia`}
      >
        {next ? (
          <Btn
            kind="primary"
            wide
            label={`Próximo: ${CATEGORY_LABEL[next].toLowerCase()}`}
            icon={(color) => <ArrowRightIcon color={color} />}
            onPress={() => setCat(next)}
          />
        ) : (
          <Btn kind="primary" wide label="Ver resultado do dia" icon={(color) => <ChartIcon color={color} />} onPress={() => openSheet('stats')} />
        )}
      </Round>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: GUTTER, paddingBottom: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
  tab: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 5, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  tabShort: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 2 },
  tabLabel: { fontFamily: FONT.uiBold, fontSize: 14 },
  badge: { borderRadius: 6, paddingHorizontal: 6, minWidth: 34, alignItems: 'center' },
  badgeText: { fontFamily: FONT.uiBold, fontSize: 12 },
});
