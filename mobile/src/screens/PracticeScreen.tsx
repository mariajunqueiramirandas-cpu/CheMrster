/**
 * Practice: as many compounds as you like, by function and difficulty, typed and explained like
 * the daily challenge. Nothing here counts toward the statistics.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Compound, TIER_LABEL, type Tier } from '../../../src/nomenclatura/catalog.ts';
import { practicePick } from '../../../src/nomenclatura/daily.ts';
import { check } from '../../../src/nomenclatura/check.ts';
import { CATEGORY_LABEL, type Category } from '../../../src/nomenclatura/pieces.ts';
import { Question } from '../game/Question.tsx';
import { FONT, GUTTER, useTheme } from '../theme.ts';
import { Segmented } from '../ui/controls.tsx';
import { ArrowRightIcon } from '../ui/Icons.tsx';
import { Btn, Press, Txt } from '../ui/kit.tsx';
import { TopBar } from '../ui/TopBar.tsx';

type Kind = Category | 'todos';
/** 0 is any difficulty. */
type Level = 0 | Tier;

const LEVELS: readonly Level[] = [0, 1, 2, 3];
const levelLabel = (l: Level) => (l ? TIER_LABEL[l] : 'Todas');

const seed = () => Math.floor(Math.random() * 2 ** 31);

export function PracticeScreen() {
  const c = useTheme();
  const [kind, setKind] = useState<Kind>('todos');
  const [level, setLevel] = useState<Level>(0);
  const [compound, setCompound] = useState<Compound>(() => practicePick(seed()));
  const [answer, setAnswer] = useState<{ typed: string; correct: boolean }>();
  const [recent, setRecent] = useState<string[]>([]);
  const [score, setScore] = useState({ played: 0, won: 0, run: 0 });

  const pick = (k: Kind, l: Level) => {
    const next = practicePick(seed(), k === 'todos' ? undefined : k, l || undefined, [...recent, compound.id]);
    setRecent((r) => [...r, compound.id].slice(-12));
    setCompound(next);
    setAnswer(undefined);
  };

  const onSubmit = (typed: string) => {
    const result = check(compound, typed);
    if (result.kind !== 'right' && result.kind !== 'wrong') return result;
    const correct = result.kind === 'right';
    setAnswer({ typed: typed.trim(), correct });
    setScore((s) => ({ played: s.played + 1, won: s.won + (correct ? 1 : 0), run: correct ? s.run + 1 : 0 }));
    return result;
  };

  const subtitle = score.played ? `Treino · ${score.won}/${score.played} acertos${score.run > 1 ? ` · ${score.run} seguidos` : ''}` : 'Treino livre';

  return (
    <View style={[styles.root, { backgroundColor: c.bench }]}>
      <TopBar subtitle={subtitle} />
      <View style={styles.filters}>
        <View style={{ flex: 1 }}>
          <Segmented<Kind>
            label="Função"
            small
            value={kind}
            onChange={(k) => {
              setKind(k);
              pick(k, level);
            }}
            options={[
              { id: 'todos', label: 'Tudo' },
              { id: 'acido', label: 'Ácidos' },
              { id: 'base', label: 'Bases' },
              { id: 'sal', label: 'Sais' },
            ]}
          />
        </View>
        <Press
          sink={1}
          onPress={() => {
            const l = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
            setLevel(l);
            pick(kind, l);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Dificuldade: ${levelLabel(level)}. Toque para trocar`}
          style={[styles.level, { backgroundColor: c.benchDeep }]}
        >
          <View style={styles.dots}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, { backgroundColor: level === 0 ? c.muted : i <= level ? c.magenta : c.rule }]} />
            ))}
          </View>
          <Text style={[styles.levelText, { color: c.text }]}>{levelLabel(level)}</Text>
        </Press>
      </View>
      <Question
        key={compound.id + recent.length}
        compound={compound}
        answer={answer}
        onSubmit={onSubmit}
        kicker={`Treino · ${CATEGORY_LABEL[compound.category].toLowerCase()}`}
      >
        <Btn kind="primary" wide label="Próximo composto" icon={(color) => <ArrowRightIcon color={color} />} onPress={() => pick(kind, level)} />
        <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
          O treino não conta nas estatísticas do desafio.
        </Txt>
      </Question>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: GUTTER, paddingBottom: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
  level: { borderRadius: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 78 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  levelText: { fontFamily: FONT.uiBold, fontSize: 13 },
});
