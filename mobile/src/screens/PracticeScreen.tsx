/**
 * Practice: as many compounds as you like, by function and difficulty, typed and explained like
 * the daily challenge. Nothing here counts toward the statistics.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Compound, TIER_LABEL, type Tier } from '../../../src/nomenclatura/catalog.ts';
import { practicePick } from '../../../src/nomenclatura/daily.ts';
import { check } from '../../../src/nomenclatura/check.ts';
import { CATEGORY_LABEL, type Category } from '../../../src/nomenclatura/pieces.ts';
import { Question } from '../game/Question.tsx';
import { GUTTER, useTheme } from '../theme.ts';
import { Segmented } from '../ui/controls.tsx';
import { ArrowRightIcon } from '../ui/Icons.tsx';
import { Btn, Txt } from '../ui/kit.tsx';
import { TopBar } from '../ui/TopBar.tsx';

type Kind = Category | 'todos';
/** 0 is any difficulty. */
type Level = 0 | Tier;

const LEVELS: readonly Level[] = [0, 1, 2, 3];
const levelLabel = (l: Level) => (l ? TIER_LABEL[l] : 'Todas');

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'todos', label: 'Tudo' },
  { id: 'acido', label: 'Ácidos' },
  { id: 'base', label: 'Bases' },
  { id: 'sal', label: 'Sais' },
  { id: 'organico', label: 'Orgânicos' },
];

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
        <Segmented<Kind>
          label="Função"
          small
          fit
          value={kind}
          onChange={(k) => {
            setKind(k);
            pick(k, level);
          }}
          options={KINDS}
        />
        <Segmented<`${Level}`>
          label="Dificuldade"
          small
          value={`${level}`}
          onChange={(v) => {
            const l = Number(v) as Level;
            setLevel(l);
            pick(kind, l);
          }}
          options={LEVELS.map((l) => ({ id: `${l}`, label: levelLabel(l) }))}
        />
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
  filters: { gap: 6, paddingHorizontal: GUTTER, paddingBottom: 8, width: '100%', maxWidth: 600, alignSelf: 'center' },
});
