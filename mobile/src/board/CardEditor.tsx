/** Everything about one board card, in a bottom sheet: title, column, lesson, due date, colour, notes, checklist. */
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LESSON_BY_ID, LESSONS } from '../../../src/course/course.ts';
import { type BoardCard, COLUMNS, COLUMN_TITLE, type ColumnId, addCard, columnOf, moveCard, removeCard, updateCard } from '../../../src/study/board.ts';
import { editBoard, useBoard } from '../../../src/app/board-store.ts';
import { uid } from '../../../src/app/persist.ts';
import { dayKey } from '../../../src/app/store.ts';
import { toast } from '../../../src/app/toast.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { go } from '../lib/nav.ts';
import { FONT, type Palette, useTheme } from '../theme.ts';
import { CheckIcon, CloseIcon, TrashIcon, TutorIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Press, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { COLORS, colorOf } from './BoardCardView.tsx';

/** YYYY-MM-DD, `days` from today. */
const isoIn = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const [y, m, day] = dayKey(d).split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Columns as a row of segments; the current one is filled. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const c = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: c.benchDeep }]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Press
            key={o.id}
            onPress={() => onChange(o.id)}
            sink={0}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && { backgroundColor: c.surface }]}
          >
            <Text style={[styles.segmentText, { color: on ? c.text : c.muted }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="kicker" tone="muted">
        {label}
      </Txt>
      {children}
    </View>
  );
}

function Chip({ c, on, label, onPress }: { c: Palette; on: boolean; label: string; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      sink={1}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={[styles.chip, { borderColor: on ? c.magenta : c.rule, backgroundColor: on ? c.magentaWash : c.surface }]}
    >
      <Text style={[styles.chipText, { color: on ? c.magenta : c.text }]}>{label}</Text>
    </Press>
  );
}

export function CardEditor({ card, onClose }: { card: BoardCard; onClose: () => void }) {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const board = useBoard();
  const col = columnOf(board, card.id) ?? 'todo';
  const [item, setItem] = useState('');
  const [dueText, setDueText] = useState(card.due ?? '');
  const patch = (p: Partial<BoardCard>) => editBoard((b) => updateCard(b, card.id, p));
  const lesson = card.lessonId ? LESSON_BY_ID[card.lessonId] : undefined;
  const setDue = (due: string | undefined) => {
    setDueText(due ?? '');
    patch({ due });
  };
  const input = [styles.input, { backgroundColor: c.surface, borderColor: c.rule, color: c.text }];

  const addItem = () => {
    if (!item.trim()) return;
    patch({ checklist: [...card.checklist, { id: uid('i'), text: item.trim(), done: false }] });
    setItem('');
  };

  return (
    <Sheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.78 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18, paddingBottom: 8 }}>
        <View style={styles.head}>
          <TextInput
            value={card.title}
            onChangeText={(title) => patch({ title })}
            style={[styles.title, { color: c.text, borderBottomColor: c.rule }]}
            accessibilityLabel="Título"
            multiline
          />
          <IconBtn label="Fechar" onPress={onClose}>
            <CloseIcon color={c.muted} />
          </IconBtn>
        </View>

        <Segmented
          label="Coluna"
          value={col}
          options={COLUMNS.map((x) => ({ id: x.id, label: x.title }))}
          onChange={(to: ColumnId) => editBoard((b) => moveCard(b, card.id, to, 0))}
        />

        <Field label="Lição ligada">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup">
            <Chip c={c} on={!card.lessonId} label="Nenhuma" onPress={() => patch({ lessonId: undefined })} />
            {LESSONS.filter((l) => l.generate).map((l) => (
              <Chip key={l.id} c={c} on={card.lessonId === l.id} label={`${l.element.symbol} · ${l.title}`} onPress={() => patch({ lessonId: l.id })} />
            ))}
          </ScrollView>
        </Field>

        <Field label="Prazo">
          <View style={styles.wrap}>
            <Chip c={c} on={!card.due} label="Sem prazo" onPress={() => setDue(undefined)} />
            <Chip c={c} on={card.due === isoIn(0)} label="Hoje" onPress={() => setDue(isoIn(0))} />
            <Chip c={c} on={card.due === isoIn(1)} label="Amanhã" onPress={() => setDue(isoIn(1))} />
            <Chip c={c} on={card.due === isoIn(7)} label="Em 1 semana" onPress={() => setDue(isoIn(7))} />
          </View>
          <TextInput
            value={dueText}
            onChangeText={(t) => {
              setDueText(t);
              if (ISO.test(t) && !Number.isNaN(new Date(`${t}T12:00`).getTime())) patch({ due: t });
              else if (!t) patch({ due: undefined });
            }}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={c.muted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            style={input}
            accessibilityLabel="Prazo (ano-mês-dia)"
          />
        </Field>

        <Field label="Cor">
          <View style={styles.colors} accessibilityRole="radiogroup">
            {COLORS.map((x) => {
              const on = card.color === x.id;
              const fill = colorOf(c, x.id);
              return (
                <Press
                  key={x.id}
                  onPress={() => patch({ color: x.id })}
                  sink={1}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={x.label}
                  style={[styles.dot, { backgroundColor: fill ?? c.surface, borderColor: fill ? 'transparent' : c.rule }, on && { borderColor: c.text, borderWidth: 3 }]}
                >
                  {on ? <CheckIcon width={16} height={16} color={fill ? '#fff' : c.text} strokeWidth={3} /> : <View />}
                </Press>
              );
            })}
          </View>
        </Field>

        <Field label="Anotações">
          <TextInput
            value={card.notes}
            onChangeText={(notes) => patch({ notes })}
            multiline
            style={[input, { minHeight: 84, textAlignVertical: 'top' }]}
            accessibilityLabel="Anotações"
          />
        </Field>

        <Field label="Checklist">
          {card.checklist.map((x) => (
            <View key={x.id} style={styles.checkRow}>
              <Press
                onPress={() => patch({ checklist: card.checklist.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: x.done }}
                accessibilityLabel={x.text}
                style={styles.checkLabel}
              >
                <View style={[styles.box, { borderColor: x.done ? c.right : c.rule, backgroundColor: x.done ? c.right : 'transparent' }]}>
                  {x.done ? <CheckIcon width={14} height={14} color="#fff" strokeWidth={3} /> : null}
                </View>
                <Text style={[styles.checkText, { color: x.done ? c.muted : c.text }, x.done && styles.struck]}>{x.text}</Text>
              </Press>
              <IconBtn label={`Remover “${x.text}”`} onPress={() => patch({ checklist: card.checklist.filter((y) => y.id !== x.id) })}>
                <CloseIcon width={18} height={18} color={c.muted} />
              </IconBtn>
            </View>
          ))}
          <View style={styles.checkAdd}>
            <TextInput
              value={item}
              onChangeText={setItem}
              placeholder="Novo item"
              placeholderTextColor={c.muted}
              onSubmitEditing={addItem}
              submitBehavior="submit"
              returnKeyType="done"
              style={[input, { flex: 1 }]}
              accessibilityLabel="Novo item da checklist"
            />
            <Btn small label="Adicionar" disabled={!item.trim()} onPress={addItem} />
          </View>
        </Field>

        <View style={{ gap: 10 }}>
          {lesson && (
            <Btn
              kind="primary"
              wide
              label={`Praticar ${lesson.title}`}
              onPress={() => {
                onClose();
                go({ name: 'lesson', id: lesson.id });
              }}
            />
          )}
          <Btn
            kind="tutor"
            wide
            label="Perguntar ao tutor"
            icon={(color) => <TutorIcon color={color} />}
            onPress={() => {
              onClose();
              ask({
                text: `Me ajuda com esta tarefa: “${card.title}”.${card.notes ? ` Anotações: ${card.notes}` : ''}`,
                about: `Cartão do quadro: ${card.title}`,
                screen: {
                  kind: 'board',
                  summary: `Cartão “${card.title}” na coluna ${COLUMN_TITLE[col]}${lesson ? `, ligado à lição ${lesson.title} [${lesson.id}]` : ''}${card.due ? `, prazo ${card.due}` : ''}.`,
                },
                open: true,
              });
            }}
          />
          <Btn
            kind="danger"
            wide
            label="Apagar"
            icon={(color) => <TrashIcon width={18} height={18} color={color} />}
            onPress={() => {
              const index = board.columns[col].indexOf(card.id);
              onClose();
              editBoard((b) => removeCard(b, card.id));
              // Undo puts back this card where it was, leaving later changes alone.
              toast('Cartão apagado', { label: 'Desfazer', run: () => editBoard((b) => (b.cards[card.id] ? b : addCard(b, col, card, index))) });
            }}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: FONT.display, fontSize: 22, paddingVertical: 6, borderBottomWidth: 2 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentText: { fontFamily: FONT.uiBold, fontSize: 13 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontFamily: FONT.uiBold, fontSize: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONT.ui, fontSize: 16 },
  colors: { flexDirection: 'row', gap: 12 },
  dot: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, fontFamily: FONT.ui, fontSize: 16 },
  struck: { textDecorationLine: 'line-through' },
  checkAdd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
