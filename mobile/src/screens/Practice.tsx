/**
 * The exercise player shared by lessons and reviews (src/app/screens/Practice.tsx): one
 * question at a time, check, explanation, and missed questions coming back at the end.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Answer, hasAnswer, isCorrect } from '../../../src/course/answers.ts';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import type { ChoiceExercise, Exercise, MolSpec, PickStructureExercise, TapAtomsExercise } from '../../../src/course/types.ts';
import { saveToMap } from '../../../src/app/canvas-store.ts';
import { type AttemptSource, recordAttempt } from '../../../src/app/store.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { haptic, prefersReducedMotion } from '../lib/haptics.ts';
import { COLUMN, FONT, GUTTER, type Palette, SIZE, paperShadow, useTheme } from '../theme.ts';
import { CheckIcon, CloseIcon, CrossIcon, HintIcon, PinIcon, TutorIcon } from '../ui/Icons.tsx';
import { type AtomMark, MoleculeView } from '../ui/MoleculeView.tsx';
import { SchemeView, SpecView, isWide } from '../ui/SchemeView.tsx';
import { Btn, IconBtn, Meter, Paper, Press, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';

export interface PracticeItem {
  key: string;
  lessonId: string;
  exercise: Exercise;
  retry?: boolean;
}

export interface PracticeResult {
  /** First-try accuracy over all questions. */
  accuracy: number;
  /** First-try accuracy per lesson (reviews mix several). */
  byLesson: Record<string, number>;
}

/** The page's usable width, for drawings that must fit it. */
function useColumn() {
  const { width } = useWindowDimensions();
  return Math.min(width, COLUMN) - GUTTER * 2;
}

export function Practice({
  items,
  source,
  onExit,
  onFinish,
  label,
}: {
  items: PracticeItem[];
  source: AttemptSource;
  onExit: () => void;
  onFinish: (result: PracticeResult) => void;
  /** Shown above the prompt, e.g. the lesson a review question comes from. */
  label?: (item: PracticeItem) => string | undefined;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState(items);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [solved, setSolved] = useState(0);
  const [firstTry, setFirstTry] = useState<Record<string, number>>({});
  const [leaving, setLeaving] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  // One stray tap on close (or the back gesture) should not throw away a lesson half done.
  const started = solved > 0 || verdict !== null || index > 0;
  const exit = useCallback(() => (started ? setLeaving(true) : onExit()), [started, onExit]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => sub.remove();
  }, [exit]);
  const choose = useCallback((a: Answer) => {
    haptic('tap');
    setAnswer(a);
  }, []);

  const item = queue[index];
  const exercise = item?.exercise;
  const total = items.length;
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [item?.key]);

  // Each question slides in from the side; the verdict rises from the bottom edge.
  const enter = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [item?.key, enter]);

  const check = () => {
    if (!exercise || verdict !== null || !hasAnswer(answer)) return;
    const ok = isCorrect(exercise, answer);
    recordAttempt({ lesson: item.lessonId, kind: exercise.kind, ok, retry: item.retry, ms: Date.now() - shownAt.current, source });
    setVerdict(ok);
    haptic(ok ? 'success' : 'error');
    if (!prefersReducedMotion()) {
      rise.setValue(0);
      Animated.timing(rise, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
    if (ok) {
      setSolved((s) => s + 1);
      if (!item.retry) setFirstTry((f) => ({ ...f, [item.lessonId]: (f[item.lessonId] ?? 0) + 1 }));
    } else {
      // Missed questions come back at the end.
      setQueue((q) => [...q, { ...item, key: `${item.key}r${q.length}`, retry: true }]);
    }
  };

  const next = () => {
    if (verdict === null) return;
    if (index + 1 >= queue.length) {
      const counts: Record<string, number> = {};
      for (const it of items) counts[it.lessonId] = (counts[it.lessonId] ?? 0) + 1;
      const byLesson = Object.fromEntries(Object.entries(counts).map(([id, n]) => [id, (firstTry[id] ?? 0) / n]));
      const right = Object.values(firstTry).reduce((s, n) => s + n, 0);
      onFinish({ accuracy: total ? right / total : 1, byLesson });
      return;
    }
    setIndex(index + 1);
    setAnswer(null);
    setVerdict(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (!item) return null;
  const tag = label?.(item);
  const footBg = verdict === null ? c.bench : verdict ? c.rightWash : c.wrongWash;

  return (
    <View style={[styles.root, { backgroundColor: c.bench, paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <IconBtn label="Sair" onPress={exit}>
          <CloseIcon color={c.muted} />
        </IconBtn>
        <Meter value={solved / total} height={14} style={{ flex: 1 }} />
        <Text style={[styles.count, { color: c.muted }]}>
          {Math.min(solved + (verdict === null ? 1 : 0), total)}/{total}
        </Text>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.main}>
        <Animated.View
          style={[
            styles.column,
            { opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] },
          ]}
        >
          {(item.retry || tag) && (
            <Text style={[styles.retry, { color: c.magenta }]}>
              {item.retry ? 'Vamos rever esta.' : ''}
              {item.retry && tag ? ' · ' : ''}
              {tag ? <Text style={{ color: c.muted }}>{tag}</Text> : null}
            </Text>
          )}
          <Txt variant="title" accessibilityRole="header">
            {exercise.prompt}
          </Txt>
          {exercise.kind === 'choice' && <ChoiceView exercise={exercise} answer={answer as number | null} onAnswer={choose} verdict={verdict} />}
          {exercise.kind === 'pick' && <PickView exercise={exercise} answer={answer as number | null} onAnswer={choose} verdict={verdict} />}
          {exercise.kind === 'tap' && (
            <TapView exercise={exercise} answer={(answer as number[] | null) ?? []} onAnswer={choose} verdict={verdict} />
          )}
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.foot,
          { backgroundColor: footBg, borderTopColor: verdict === null ? c.benchDeep : 'transparent', paddingBottom: insets.bottom + 14 },
        ]}
      >
        {verdict === null ? (
          <View style={styles.column}>
            {exercise.kind === 'tap' && (
              <Txt variant="small" tone="muted" style={{ marginBottom: 10 }}>
                Toque nos átomos para marcar. Toque de novo para desmarcar.
              </Txt>
            )}
            <View style={styles.footRow}>
              <Btn
                kind="tutor"
                label="Dica"
                icon={(color) => <HintIcon color={color} width={20} height={20} />}
                onPress={() =>
                  ask({
                    text: 'Me dá uma dica, sem entregar a resposta?',
                    screen: { kind: 'question', lessonId: item.lessonId, exercise },
                    about: aboutQuestion(item),
                    open: true,
                  })
                }
              />
              <Btn kind="primary" label="Verificar" disabled={!hasAnswer(answer)} onPress={check} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <Animated.View
            style={[styles.column, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.verdict}>
              <View style={[styles.verdictIcon, { backgroundColor: verdict ? c.right : c.wrong }]}>
                {verdict ? <CheckIcon color="#fff" strokeWidth={3} /> : <CrossIcon color="#fff" strokeWidth={3} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.verdictTitle, { color: verdict ? c.right : c.wrong }]}>{verdict ? 'Correto' : correctAnswerText(exercise)}</Text>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  <Txt variant="small" style={{ fontSize: 15, lineHeight: 21 }}>
                    {exercise.explain}
                  </Txt>
                </ScrollView>
                <View style={styles.verdictActions}>
                  <LinkBtn
                    c={c}
                    tone={c.cobalt}
                    icon={<TutorIcon width={18} height={18} color={c.cobalt} />}
                    label={verdict ? 'Entender melhor' : 'Por que errei?'}
                    onPress={() =>
                      ask({
                        text: verdict ? 'Por que essa é a resposta certa? Quero entender o raciocínio.' : 'Por que eu errei? Me explica o raciocínio certo.',
                        screen: { kind: 'question', lessonId: item.lessonId, exercise, chosen: answer ?? undefined, correct: verdict },
                        about: aboutQuestion(item),
                        open: true,
                      })
                    }
                  />
                  <LinkBtn c={c} tone={c.text} icon={<PinIcon width={18} height={18} color={c.text} />} label="Salvar no mapa" onPress={() => saveQuestion(item)} />
                </View>
              </View>
            </View>
            <Btn kind="primary" wide label="Continuar" onPress={next} style={{ marginTop: 12 }} />
          </Animated.View>
        )}
      </View>
      <Sheet visible={leaving} onClose={() => setLeaving(false)}>
        <Txt variant="title">Sair agora?</Txt>
        <Txt tone="muted" style={{ marginTop: 8 }}>
          O que você respondeu até aqui conta para o seu progresso, mas a lição só fica concluída quando você chega ao fim.
        </Txt>
        <View style={{ gap: 10, marginTop: 20 }}>
          <Btn kind="primary" wide label="Continuar estudando" onPress={() => setLeaving(false)} />
          <Btn
            kind="danger"
            wide
            label="Sair da lição"
            onPress={() => {
              setLeaving(false);
              onExit();
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function LinkBtn({ c, tone, icon, label, onPress }: { c: Palette; tone: string; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={styles.link} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      {icon}
      <Text style={[styles.linkText, { color: tone, textDecorationColor: c.rule }]}>{label}</Text>
    </Press>
  );
}

const aboutQuestion = (item: PracticeItem) => `Questão de ${LESSON_BY_ID[item.lessonId]?.title ?? 'química'}`;

/** A question worth keeping goes to the concept map with its answer and explanation. */
function saveQuestion(item: PracticeItem) {
  const ex = item.exercise;
  const answer =
    ex.kind === 'choice' ? `**${ex.options[ex.answer]}**` : ex.kind === 'pick' ? 'a estrutura desenhada no cartão' : `átomos ${ex.answer.map((a) => a + 1).join(', ')}`;
  saveToMap({
    kind: 'question',
    title: ex.prompt,
    text: `Resposta: ${answer}\n\n${ex.explain}`,
    smiles: ex.kind === 'pick' ? ex.options[ex.answer].smiles : ex.molecule?.smiles,
    lessonId: item.lessonId,
  });
}

function correctAnswerText(ex: Exercise): string {
  if (ex.kind === 'choice') return `Resposta correta: ${ex.options[ex.answer]}`;
  if (ex.kind === 'pick') return 'A estrutura correta está marcada';
  return 'Os átomos certos estão marcados';
}

/** The question's structure or reaction, on paper. */
function Prompt({ molecule, scheme, size }: { molecule?: MolSpec; scheme?: ChoiceExercise['scheme']; size: number }) {
  const column = useColumn();
  return (
    <>
      {scheme && (
        <Paper style={styles.prompt}>
          <SchemeView scheme={scheme} animate maxWidth={column - 36} />
        </Paper>
      )}
      {molecule && (
        <Paper style={styles.prompt}>
          <SpecView spec={molecule} size={molecule.polymer ? 30 : size} animate maxWidth={column - 36} />
        </Paper>
      )}
    </>
  );
}

type OptionState = 'idle' | 'chosen' | 'right' | 'wrong';

function optionState(i: number, answer: number | null, correct: number, verdict: boolean | null): OptionState {
  if (verdict !== null) {
    if (i === correct) return 'right';
    if (answer === i) return 'wrong';
    return 'idle';
  }
  return answer === i ? 'chosen' : 'idle';
}

function optionLook(c: Palette, s: OptionState) {
  switch (s) {
    case 'chosen':
      return { border: c.magenta, bg: c.magentaWash, key: c.magenta };
    case 'right':
      return { border: c.right, bg: c.rightWash, key: c.right };
    case 'wrong':
      return { border: c.wrong, bg: c.wrongWash, key: c.wrong };
    default:
      return { border: c.rule, bg: c.surface, key: c.muted };
  }
}

function OptionKey({ n, color, border }: { n: number; color: string; border: string }) {
  return (
    <View style={[styles.key, { borderColor: border }]}>
      <Text style={[styles.keyText, { color }]}>{n}</Text>
    </View>
  );
}

function ChoiceView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: ChoiceExercise;
  answer: number | null;
  onAnswer: (n: number) => void;
  verdict: boolean | null;
}) {
  const c = useTheme();
  const locked = verdict !== null;
  // Short answers (numbers, cis/trans, Sim/Não, reagents) sit side by side.
  const row =
    (exercise.options.length === 2 && exercise.options.every((o) => o.length <= 22)) ||
    (exercise.options.length <= 4 && exercise.options.every((o) => o.length <= 4));
  return (
    <>
      <Prompt molecule={exercise.molecule} scheme={exercise.scheme} size={44} />
      <View style={[styles.options, row && styles.optionsRow]} accessibilityRole="radiogroup" accessibilityLabel="Alternativas">
        {exercise.options.map((opt, i) => {
          const s = optionState(i, answer, exercise.answer, verdict);
          const l = optionLook(c, s);
          return (
            <Press
              key={opt}
              tap={false}
              disabled={locked}
              onPress={() => onAnswer(i)}
              accessibilityRole="radio"
              accessibilityState={{ checked: answer === i, disabled: locked }}
              accessibilityLabel={opt}
              style={[styles.option, row && styles.optionInRow, { borderColor: l.border, backgroundColor: l.bg, shadowColor: l.border }]}
            >
              <OptionKey n={i + 1} color={l.key} border={s === 'idle' ? c.rule : l.border} />
              <Text style={[styles.optionText, { color: c.text }, row && { flexShrink: 1 }]}>{opt}</Text>
            </Press>
          );
        })}
      </View>
    </>
  );
}

function PickView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: PickStructureExercise;
  answer: number | null;
  onAnswer: (n: number) => void;
  verdict: boolean | null;
}) {
  const c = useTheme();
  const column = useColumn();
  const locked = verdict !== null;
  const wide = useMemo(() => exercise.options.some((o) => isWide(o)), [exercise]);
  const cols = wide || column < 300 ? 1 : 2;
  const tile = (column - (cols - 1) * 12) / cols;
  return (
    <>
      <Prompt molecule={exercise.molecule} scheme={exercise.scheme} size={40} />
      <View style={styles.picks} accessibilityRole="radiogroup" accessibilityLabel="Estruturas">
        {exercise.options.map((opt, i) => {
          const s = optionState(i, answer, exercise.answer, verdict);
          const l = optionLook(c, s);
          return (
            <Press
              key={`${opt.smiles}-${opt.formula ?? ''}`}
              tap={false}
              disabled={locked}
              onPress={() => onAnswer(i)}
              accessibilityRole="radio"
              accessibilityState={{ checked: answer === i, disabled: locked }}
              accessibilityLabel={`Estrutura ${i + 1}`}
              style={[styles.pick, { width: tile, backgroundColor: c.paper, borderColor: s === 'idle' ? 'transparent' : l.border }, paperShadow(c)]}
            >
              <View style={styles.pickKey}>
                <OptionKey n={i + 1} color={s === 'idle' ? '#56626f' : l.key} border={s === 'idle' ? '#c3ccd4' : l.border} />
              </View>
              <MoleculeView smiles={opt.smiles} formula={opt.formula} polymer={opt.polymer} size={28} maxWidth={tile - 30} />
            </Press>
          );
        })}
      </View>
    </>
  );
}

function TapView({
  exercise,
  answer,
  onAnswer,
  verdict,
}: {
  exercise: TapAtomsExercise;
  answer: number[];
  onAnswer: (a: number[]) => void;
  verdict: boolean | null;
}) {
  const column = useColumn();
  const toggle = (atom: number) => {
    if (verdict !== null) return;
    onAnswer(answer.includes(atom) ? answer.filter((a) => a !== atom) : [...answer, atom]);
  };
  const marks: Record<number, AtomMark> = {};
  if (verdict === null) {
    for (const a of answer) marks[a] = 'selected';
  } else {
    for (const a of answer) marks[a] = exercise.answer.includes(a) ? 'correct' : 'wrong';
    for (const a of exercise.answer) if (!answer.includes(a)) marks[a] = 'missed';
  }
  return (
    <Paper style={[styles.prompt, { minHeight: 220 }]}>
      <MoleculeView
        smiles={exercise.molecule.smiles}
        formula={exercise.molecule.formula}
        polymer={exercise.molecule.polymer}
        size={52}
        animate
        tappable={exercise.tappable}
        marks={marks}
        onAtomTap={toggle}
        maxWidth={column - 36}
      />
    </Paper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER - 6, paddingVertical: 6 },
  count: { minWidth: 48, textAlign: 'right', fontFamily: FONT.uiBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  main: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 24 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center', gap: 18 },
  retry: { fontFamily: FONT.uiBold, fontSize: 15 },
  prompt: { alignItems: 'center', justifyContent: 'center', minHeight: 170, padding: 18, overflow: 'hidden' },
  options: { gap: 10 },
  optionsRow: { flexDirection: 'row' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 12,
    borderBottomWidth: 5,
  },
  optionInRow: { flex: 1, justifyContent: 'center' },
  optionText: { fontFamily: FONT.uiBold, fontSize: SIZE.body, lineHeight: SIZE.body * 1.3, flexShrink: 1 },
  key: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: FONT.uiBold, fontSize: 13 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pick: { minHeight: 130, alignItems: 'center', justifyContent: 'center', paddingTop: 30, paddingBottom: 14, paddingHorizontal: 12, borderRadius: 6, borderWidth: 3 },
  pickKey: { position: 'absolute', top: 8, left: 8 },
  foot: { paddingTop: 14, paddingHorizontal: GUTTER, borderTopWidth: 2 },
  footRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  verdict: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  verdictIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  verdictTitle: { fontFamily: FONT.display, fontSize: SIZE.step1, lineHeight: SIZE.step1 * 1.2 },
  verdictActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  linkText: { fontFamily: FONT.uiBold, fontSize: 15, textDecorationLine: 'underline' },
});
