/** A question the tutor put in the chat, answered right there (src/app/components/tutor/MiniExercise.tsx). */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import type { Exercise } from '../../../src/course/types.ts';
import type { Part } from '../../../src/tutor/types.ts';
import { FONT, type Palette, SIZE, paperShadow, useTheme } from '../theme.ts';
import { CheckIcon, CrossIcon } from '../ui/Icons.tsx';
import { type AtomMark, MoleculeView } from '../ui/MoleculeView.tsx';
import { SchemeView, SpecView } from '../ui/SchemeView.tsx';
import { Btn, Paper, Press } from '../ui/kit.tsx';

type ExercisePart = Extract<Part, { type: 'exercise' }>;
type OptionState = 'idle' | 'chosen' | 'right' | 'wrong';

function optionState(i: number, ex: Exercise, answer: ExercisePart['answer']): OptionState {
  if (answer === undefined || ex.kind === 'tap') return 'idle';
  if (i === ex.answer) return 'right';
  if (answer === i) return 'wrong';
  return 'idle';
}

function look(c: Palette, s: OptionState) {
  if (s === 'right') return { border: c.right, bg: c.rightWash, key: c.right };
  if (s === 'wrong') return { border: c.wrong, bg: c.wrongWash, key: c.wrong };
  if (s === 'chosen') return { border: c.magenta, bg: c.magentaWash, key: c.magenta };
  return { border: c.rule, bg: c.surface, key: c.muted };
}

/** `width` is the room the question has in the chat. */
export function MiniExercise({
  part,
  onAnswer,
  disabled,
  width,
}: {
  part: ExercisePart;
  onAnswer: (answer: number | number[]) => void;
  disabled?: boolean;
  width: number;
}) {
  const c = useTheme();
  const { exercise: ex, answer } = part;
  const [atoms, setAtoms] = useState<number[]>([]);
  const lesson = LESSON_BY_ID[part.lessonId];
  const locked = answer !== undefined || !!disabled;
  const inner = width - 32;

  let marks: Record<number, AtomMark> | undefined;
  if (ex.kind === 'tap') {
    marks = {};
    if (answer === undefined) for (const a of atoms) marks[a] = 'selected';
    else {
      const picked = answer as number[];
      for (const a of picked) marks[a] = ex.answer.includes(a) ? 'correct' : 'wrong';
      for (const a of ex.answer) if (!picked.includes(a)) marks[a] = 'missed';
    }
  }

  const border = answer === undefined ? c.rule : part.correct ? c.right : c.wrong;
  return (
    <View style={[styles.box, { borderColor: border, backgroundColor: c.surface }]} accessibilityLabel="Questão do tutor">
      <View style={styles.kicker}>
        <View style={[styles.tile, { backgroundColor: c.magenta }]}>
          <Text style={styles.tileText}>{lesson?.element.symbol}</Text>
        </View>
        <Text style={[styles.kickerText, { color: c.muted }]}>Questão de {lesson?.title ?? 'química'}</Text>
      </View>
      <Text style={[styles.prompt, { color: c.text }]}>{ex.prompt}</Text>
      {ex.kind !== 'tap' && ex.scheme && (
        <Paper style={styles.figure}>
          <SchemeView scheme={ex.scheme} size={20} maxWidth={inner - 24} />
        </Paper>
      )}
      {ex.kind !== 'tap' && ex.molecule && (
        <Paper style={styles.figure}>
          <SpecView spec={ex.molecule} size={ex.molecule.polymer ? 22 : 28} maxWidth={inner - 24} />
        </Paper>
      )}
      {ex.kind === 'tap' && (
        <Paper style={[styles.figure, { minHeight: 150 }]}>
          <MoleculeView
            smiles={ex.molecule.smiles}
            formula={ex.molecule.formula}
            polymer={ex.molecule.polymer}
            size={34}
            tappable={ex.tappable}
            marks={marks}
            maxWidth={inner - 24}
            onAtomTap={(a) => !locked && setAtoms((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
          />
        </Paper>
      )}

      {ex.kind === 'choice' && (
        <View style={styles.options} accessibilityLabel="Alternativas">
          {ex.options.map((opt, i) => {
            const s = answer === i && optionState(i, ex, answer) === 'idle' ? 'chosen' : optionState(i, ex, answer);
            const l = look(c, s);
            return (
              <Press
                key={opt}
                disabled={locked}
                onPress={() => onAnswer(i)}
                accessibilityRole="button"
                accessibilityState={{ disabled: locked, selected: answer === i }}
                style={[styles.option, { borderColor: l.border, backgroundColor: l.bg }]}
              >
                <View style={[styles.key, { borderColor: s === 'idle' ? c.rule : l.border }]}>
                  <Text style={[styles.keyText, { color: l.key }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.optionText, { color: c.text }]}>{opt}</Text>
              </Press>
            );
          })}
        </View>
      )}

      {ex.kind === 'pick' && (
        <View style={styles.picks} accessibilityLabel="Estruturas">
          {ex.options.map((opt, i) => {
            const s = optionState(i, ex, answer);
            const l = look(c, s);
            const tile = (inner - 10) / 2;
            return (
              <Press
                key={`${opt.smiles}-${i}`}
                disabled={locked}
                onPress={() => onAnswer(i)}
                accessibilityRole="button"
                accessibilityLabel={`Estrutura ${i + 1}`}
                style={[styles.pick, { width: tile, backgroundColor: c.paper, borderColor: s === 'idle' ? 'transparent' : l.border }, paperShadow(c)]}
              >
                <View style={[styles.key, styles.pickKey, { borderColor: s === 'idle' ? '#c3ccd4' : l.border }]}>
                  <Text style={[styles.keyText, { color: s === 'idle' ? '#56626f' : l.key }]}>{i + 1}</Text>
                </View>
                <MoleculeView smiles={opt.smiles} formula={opt.formula} polymer={opt.polymer} size={20} maxWidth={tile - 20} />
              </Press>
            );
          })}
        </View>
      )}

      {ex.kind === 'tap' && answer === undefined && (
        <Btn kind="primary" label="Verificar" disabled={!atoms.length || disabled} onPress={() => onAnswer([...atoms].sort((a, b) => a - b))} style={{ alignSelf: 'flex-start' }} />
      )}

      {answer !== undefined && (
        <View style={styles.verdict} accessibilityLiveRegion="polite">
          <View style={[styles.verdictIcon, { backgroundColor: part.correct ? c.right : c.wrong }]}>
            {part.correct ? <CheckIcon width={16} height={16} color="#fff" strokeWidth={3} /> : <CrossIcon width={16} height={16} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={[styles.verdictText, { color: c.text }]}>
            {part.correct ? 'Correto' : ex.kind === 'tap' ? 'Os átomos certos estão marcados' : 'A resposta certa está marcada'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 14, borderWidth: 2, borderRadius: 16 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerText: { fontFamily: FONT.uiBold, fontSize: SIZE.small, flexShrink: 1 },
  tile: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: '#fff', fontFamily: FONT.displayHeavy, fontSize: 12.5 },
  prompt: { fontFamily: FONT.display, fontSize: SIZE.step1, lineHeight: SIZE.step1 * 1.2 },
  figure: { alignItems: 'center', justifyContent: 'center', padding: 12 },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 2, borderRadius: 12, borderBottomWidth: 4 },
  optionText: { fontFamily: FONT.uiBold, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  key: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: FONT.uiBold, fontSize: 12 },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pick: { minHeight: 100, alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 10, paddingHorizontal: 8, borderRadius: 6, borderWidth: 3 },
  pickKey: { position: 'absolute', top: 6, left: 6 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verdictText: { fontFamily: FONT.uiBold, fontSize: 16, flexShrink: 1 },
});
