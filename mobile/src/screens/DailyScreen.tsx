/**
 * Today's challenge: two acids, two bases and two salts, named one at a time by typing. After
 * the last one, the day's summary: the score, the streak, every answer, and the countdown.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DAILY_SIZE, daily, puzzleDate } from '../../../src/nomenclatura/daily.ts';
import { CATEGORY_LABEL } from '../../../src/nomenclatura/pieces.ts';
import { type Question as Q, questionsOf, stats } from '../../../src/nomenclatura/play.ts';
import { answerDaily, markHelpSeen, saveStore, useSave } from '../../../src/nomenclatura/store.ts';
import { useCountdown, useToday } from '../game/clock.ts';
import { Formula } from '../game/Formula.tsx';
import { Question } from '../game/Question.tsx';
import { openSheet } from '../game/Sheets.tsx';
import { COLUMN, FONT, GUTTER, useTheme } from '../theme.ts';
import { ArrowRightIcon, ChartIcon, CheckIcon, ChevronRightIcon, CrossIcon, FlameIcon } from '../ui/Icons.tsx';
import { Btn, Card, Press, Txt } from '../ui/kit.tsx';
import { TopBar } from '../ui/TopBar.tsx';

const dateLabel = (n: number) =>
  puzzleDate(n)
    .toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
    .replace(/\.| de/g, '');

/** One dot per compound: right, wrong, the one on screen, or still to come. Answered ones open again. */
function Progress({ questions, index, onOpen }: { questions: Q[]; index: number; onOpen: (i: number) => void }) {
  const c = useTheme();
  const done = questions.filter((q) => q.answer).length;
  return (
    <View style={styles.progress}>
      <View style={styles.dots}>
        {questions.map((q, i) => {
          const a = q.answer;
          const here = i === index;
          return (
            <Press
              key={i}
              sink={0}
              disabled={!a}
              onPress={() => onOpen(i)}
              accessibilityRole="button"
              accessibilityLabel={`Composto ${i + 1}: ${a ? (a.correct ? 'certo' : 'errado') : 'a responder'}`}
              style={[
                styles.dot,
                { borderColor: here ? c.magenta : a ? 'transparent' : c.rule, backgroundColor: a ? (a.correct ? c.right : c.wrong) : 'transparent' },
              ]}
            >
              {a ? a.correct ? <CheckIcon color="#fff" width={14} height={14} strokeWidth={3} /> : <CrossIcon color="#fff" width={14} height={14} strokeWidth={3} /> : null}
            </Press>
          );
        })}
      </View>
      <Text style={[styles.count, { color: c.muted }]}>
        {done} de {DAILY_SIZE}
      </Text>
    </View>
  );
}

function Summary({ n, questions, onOpen }: { n: number; questions: Q[]; onOpen: (i: number) => void }) {
  const c = useTheme();
  const save = useSave();
  const countdown = useCountdown();
  const streak = useMemo(() => stats(save.days, n).streak, [save.days, n]);
  const right = questions.filter((q) => q.answer?.correct).length;
  return (
    <ScrollView contentContainerStyle={styles.summary}>
      <Card style={styles.score}>
        <Txt variant="kicker" tone="magenta">
          Desafio #{n} completo
        </Txt>
        <Text style={[styles.scoreValue, { color: c.text }]}>
          {right}/{DAILY_SIZE}
        </Text>
        <Txt tone="muted" style={{ textAlign: 'center' }}>
          {right === DAILY_SIZE ? 'Todos os nomes certos!' : 'Toque num composto para rever o porquê do nome.'}
        </Txt>
        <View style={styles.streak}>
          <FlameIcon color={c.magenta} />
          <Txt variant="strong" tone="magenta">
            {streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`}
          </Txt>
        </View>
        <Txt variant="small" tone="muted">
          Próximo desafio em <Text style={{ fontFamily: FONT.uiBold, color: c.text }}>{countdown}</Text>
        </Txt>
      </Card>
      {questions.map((q, i) => {
        const a = q.answer!;
        return (
          <Press
            key={i}
            sink={1}
            onPress={() => onOpen(i)}
            accessibilityRole="button"
            accessibilityLabel={`${q.compound.name}: ${a.correct ? 'certo' : `errado, você escreveu ${a.typed}`}. Ver explicação`}
            style={[styles.row, { backgroundColor: c.surface, borderColor: c.rule }]}
          >
            {a.correct ? <CheckIcon color={c.right} /> : <CrossIcon color={c.wrong} />}
            <Formula formula={q.compound.formula} size={20} style={styles.rowFormula} />
            <View style={{ flex: 1 }}>
              <Txt variant="strong">{q.compound.name}</Txt>
              {!a.correct && (
                <Txt variant="small" tone="muted" numberOfLines={1}>
                  Você: {a.typed}
                </Txt>
              )}
            </View>
            <ChevronRightIcon color={c.muted} width={18} height={18} />
          </Press>
        );
      })}
      <View style={styles.actions}>
        <Btn label="Estatísticas" icon={(color) => <ChartIcon color={color} />} onPress={() => openSheet('stats')} style={{ flex: 1 }} />
        <Btn kind="primary" label="Treinar mais" onPress={() => router.navigate('/treino')} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

export function DailyScreen() {
  const c = useTheme();
  const n = useToday();
  const save = useSave();
  const today = useMemo(() => daily(n), [n]);
  const day = save.days[n];
  const questions = useMemo(() => questionsOf(n, day, today), [n, day, today]);
  const answered = day?.length ?? 0;
  // The question on screen; DAILY_SIZE is the summary.
  const [index, setIndex] = useState(answered);

  // A new day starts at its first open question.
  const shownDay = useRef(n);
  useEffect(() => {
    if (shownDay.current === n) return;
    shownDay.current = n;
    setIndex(saveStore.get().days[n]?.length ?? 0);
  }, [n]);

  // First visit: how it works.
  useEffect(() => {
    if (!saveStore.get().helpSeen) {
      const t = setTimeout(() => openSheet('help'), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const q = questions[index];
  const finished = answered >= DAILY_SIZE;
  // After the answer on screen: on to the next open question, back to it, or to the summary.
  const onward = finished
    ? { label: 'Ver resultado do dia', to: DAILY_SIZE }
    : index < answered - 1
      ? { label: 'Voltar ao desafio', to: answered }
      : { label: 'Próximo composto', to: answered };

  return (
    <View style={[styles.root, { backgroundColor: c.bench }]}>
      <TopBar subtitle={`Desafio #${n} · ${dateLabel(n)}`} />
      <Progress questions={questions} index={index} onOpen={setIndex} />
      {q ? (
        <Question
          key={`${n}:${index}`}
          compound={q.compound}
          kicker={`${CATEGORY_LABEL[q.compound.category]} · ${index + 1} de ${DAILY_SIZE}`}
          answer={q.answer}
          onSubmit={(typed) => {
            markHelpSeen();
            return answerDaily(n, index, q.compound, typed);
          }}
        >
          <Btn kind="primary" wide label={onward.label} icon={(color) => <ArrowRightIcon color={color} />} onPress={() => setIndex(onward.to)} />
        </Question>
      ) : (
        <Summary n={n} questions={questions} onOpen={setIndex} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingBottom: 10, width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  dots: { flex: 1, flexDirection: 'row', gap: 6 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: FONT.uiBold, fontSize: 14 },
  summary: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 32, gap: 10, width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  score: { gap: 6, alignItems: 'center' },
  scoreValue: { fontFamily: FONT.displayHeavy, fontSize: 48, lineHeight: 54 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowFormula: { minWidth: 76 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
