/**
 * The study board (src/app/screens/BoardScreen.tsx): four columns of cards. On a phone one
 * column shows at a time (tabs above, or swipe sideways); a long press moves a card. Cards
 * linked to a lesson show how well it is known and move by themselves after practice.
 */
import { useScrollToTop } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from 'react-native';
import { type BoardCard, COLUMNS, COLUMN_TITLE, type ColumnId, columnOf, moveCard } from '../../../src/study/board.ts';
import { masteryAll } from '../../../src/study/progress.ts';
import { createCard, editBoard, seedBoard, syncOnVisit, useBoard } from '../../../src/app/board-store.ts';
import { useProgress } from '../../../src/app/store.ts';
import { toast } from '../../../src/app/toast.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { BoardCardView } from '../board/BoardCardView.tsx';
import { CardEditor } from '../board/CardEditor.tsx';
import { haptic } from '../lib/haptics.ts';
import { COLUMN, FONT, GUTTER, useTheme } from '../theme.ts';
import { TopBar } from '../ui/Bars.tsx';
import { PlusIcon, TutorIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Press, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';

function boardSummary(cards: Record<string, BoardCard>, columns: Record<ColumnId, string[]>): string {
  return COLUMNS.map((c) => `${c.title}: ${columns[c.id].map((id) => cards[id]?.title).filter(Boolean).join('; ') || 'vazio'}`).join(' | ');
}

export function BoardScreen() {
  const c = useTheme();
  const board = useBoard();
  const progress = useProgress();
  const mastery = useMemo(() => masteryAll(progress), [progress]);
  const [column, setColumn] = useState<ColumnId>('todo');
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  useScrollToTop(scroll);
  const total = Object.keys(board.cards).length;

  useEffect(() => {
    const moved = syncOnVisit();
    if (moved) toast(moved === 1 ? '1 lição voltou para Revisar' : `${moved} lições voltaram para Revisar`);
  }, []);

  const placeCard = (id: string, col: ColumnId, index: number) => {
    const from = columnOf(board, id);
    editBoard((b) => moveCard(b, id, col, index));
    const limit = COLUMNS.find((x) => x.id === col)?.limit;
    if (limit && from !== col && board.columns[col].length >= limit) toast(`${COLUMN_TITLE[col]} passou de ${limit} cartões: foco em poucos de cada vez ajuda a fixar.`);
    else if (from !== col) toast(`“${board.cards[id]?.title}” foi para ${COLUMN_TITLE[col]}`, { label: 'Ver', run: () => setColumn(col) });
  };

  // Swiping sideways over the list goes to the next or previous column.
  const step = useRef((_: number) => {});
  step.current = (dir: number) => {
    const i = COLUMNS.findIndex((x) => x.id === column) + dir;
    if (i < 0 || i >= COLUMNS.length) return;
    haptic('tap');
    setAdding(false);
    setColumn(COLUMNS[i].id);
  };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) step.current(1);
        else if (g.dx > 60) step.current(-1);
      },
    }),
  ).current;

  const planWithTutor = () =>
    ask({
      text: 'Organize meu quadro de estudos para esta semana: o que revisar, o que estudar e o que reforçar.',
      screen: { kind: 'board', summary: boardSummary(board.cards, board.columns) },
      open: true,
    });

  const seed = () => {
    const ids = seedBoard();
    toast(ids.length ? `${ids.length} ${ids.length === 1 ? 'lição entrou' : 'lições entraram'} no quadro` : 'As próximas lições já estão no quadro');
  };

  const col = COLUMNS.find((x) => x.id === column)!;
  const ids = board.columns[column];

  return (
    <View style={{ flex: 1, backgroundColor: c.bench }}>
      <TopBar />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.head}>
            <Txt variant="display" accessibilityRole="header">
              Quadro de estudos
            </Txt>
            <Txt tone="muted">Toque num cartão para abrir e segure para movê-lo entre as colunas. Os cartões de lição andam sozinhos quando você pratica.</Txt>
            <View style={styles.actions}>
              <Btn small label="Lições da trilha" icon={(color) => <PlusIcon width={18} height={18} color={color} />} onPress={seed} />
              <Btn small kind="tutor" label="Planejar com o tutor" icon={(color) => <TutorIcon width={18} height={18} color={color} />} onPress={planWithTutor} />
            </View>
          </View>

          {total === 0 && !adding ? (
            <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.rule }]}>
              <Txt variant="title">Um quadro para organizar a semana</Txt>
              <Txt tone="muted">Comece com as próximas lições e as revisões que estão vencendo, ou peça ao tutor um plano que leva em conta seus pontos fracos.</Txt>
              <View style={{ gap: 10, marginTop: 6 }}>
                <Btn kind="primary" wide label="Montar com a trilha" onPress={seed} />
                <Btn kind="tutor" wide label="Planejar com o tutor" icon={(color) => <TutorIcon color={color} />} onPress={planWithTutor} />
                <Btn
                  wide
                  label="Nova tarefa"
                  onPress={() => {
                    setColumn('todo');
                    setAdding(true);
                  }}
                />
              </View>
            </View>
          ) : (
            <View {...pan.panHandlers}>
              <View style={[styles.tabs, { backgroundColor: c.benchDeep }]} accessibilityRole="tablist">
                {COLUMNS.map((x) => {
                  const on = x.id === column;
                  const n = board.columns[x.id].length;
                  const over = !!x.limit && n > x.limit;
                  return (
                    <Press
                      key={x.id}
                      sink={0}
                      onPress={() => {
                        setAdding(false);
                        setColumn(x.id);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${x.title}, ${n} ${n === 1 ? 'cartão' : 'cartões'}`}
                      style={[styles.tab, on && { backgroundColor: c.surface }]}
                    >
                      <Text style={[styles.tabTitle, { color: on ? c.text : c.muted }]} numberOfLines={1}>
                        {x.title}
                      </Text>
                      <Text style={[styles.tabCount, { color: over ? c.wrong : on ? c.magenta : c.muted }]}>
                        {n}
                        {x.limit ? `/${x.limit}` : ''}
                      </Text>
                    </Press>
                  );
                })}
              </View>

              <View style={styles.colHead}>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{col.title}</Txt>
                  <Txt variant="small" tone="muted">
                    {col.hint}
                  </Txt>
                </View>
                <IconBtn label={`Nova tarefa em ${col.title}`} onPress={() => setAdding(true)} style={{ backgroundColor: c.surface }}>
                  <PlusIcon color={c.text} />
                </IconBtn>
              </View>

              <View style={styles.cards}>
                {adding && <NewCard column={column} onDone={() => setAdding(false)} />}
                {ids.map((id) => {
                  const card = board.cards[id];
                  if (!card) return null;
                  return (
                    <BoardCardView
                      key={id}
                      card={card}
                      level={card.lessonId ? mastery[card.lessonId] : undefined}
                      onPress={() => setEditing(id)}
                      onLongPress={() => {
                        haptic('success');
                        setMoving(id);
                      }}
                    />
                  );
                })}
                {ids.length === 0 && !adding && (
                  <View style={[styles.colEmpty, { borderColor: c.rule }]}>
                    <Txt variant="small" tone="muted">
                      Nenhum cartão aqui. Toque em + para criar ou segure um cartão de outra coluna para trazê-lo.
                    </Txt>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {editing && board.cards[editing] && <CardEditor card={board.cards[editing]} onClose={() => setEditing(null)} />}
      {moving && board.cards[moving] && (
        <MoveSheet
          card={board.cards[moving]}
          from={columnOf(board, moving) ?? 'todo'}
          index={board.columns[columnOf(board, moving) ?? 'todo'].indexOf(moving)}
          size={board.columns[columnOf(board, moving) ?? 'todo'].length}
          onMove={(to, index) => placeCard(moving, to, index)}
          onClose={() => setMoving(null)}
        />
      )}
    </View>
  );
}

function NewCard({ column, onDone }: { column: ColumnId; onDone: () => void }) {
  const c = useTheme();
  const [title, setTitle] = useState('');
  const add = () => {
    if (title.trim()) createCard(column, { title: title.trim() }, 0);
    setTitle('');
    onDone();
  };
  return (
    <View style={[styles.newCard, { backgroundColor: c.surface, borderColor: c.magenta }]}>
      <TextInput
        autoFocus
        value={title}
        onChangeText={setTitle}
        placeholder="Ex.: refazer questões de isomeria"
        placeholderTextColor={c.muted}
        onSubmitEditing={add}
        returnKeyType="done"
        accessibilityLabel="Título da tarefa"
        style={[styles.newInput, { color: c.text }]}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn small kind="primary" label="Adicionar" disabled={!title.trim()} onPress={add} />
        <Btn small kind="quiet" label="Cancelar" onPress={onDone} />
      </View>
    </View>
  );
}

/** A long press on a card: where should it go? */
function MoveSheet({
  card,
  from,
  index,
  size,
  onMove,
  onClose,
}: {
  card: BoardCard;
  from: ColumnId;
  index: number;
  size: number;
  onMove: (to: ColumnId, index: number) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const move = (to: ColumnId, at: number) => {
    onMove(to, at);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose}>
      <Txt variant="kicker" tone="muted">
        Mover cartão
      </Txt>
      <Txt variant="title" numberOfLines={2} style={{ marginTop: 2 }}>
        {card.title}
      </Txt>
      <View style={{ gap: 8, marginTop: 16 }}>
        {COLUMNS.map((x) => {
          const here = x.id === from;
          return (
            <Press
              key={x.id}
              disabled={here}
              onPress={() => move(x.id, 0)}
              accessibilityRole="button"
              accessibilityState={{ disabled: here }}
              style={[styles.moveRow, { borderColor: here ? c.magenta : c.rule, backgroundColor: here ? c.magentaWash : c.surface }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.moveTitle, { color: c.text }]}>{x.title}</Text>
                <Txt variant="small" tone="muted">
                  {here ? 'Está aqui' : x.hint}
                </Txt>
              </View>
            </Press>
          );
        })}
      </View>
      <View style={styles.moveOrder}>
        <Btn small label="Para o topo" disabled={index <= 0} onPress={() => move(from, 0)} style={{ flex: 1 }} />
        <Btn small label="Subir" disabled={index <= 0} onPress={() => move(from, index - 1)} style={{ flex: 1 }} />
        <Btn small label="Descer" disabled={index >= size - 1} onPress={() => move(from, index + 1)} style={{ flex: 1 }} />
      </View>
      <Btn kind="quiet" wide label="Fechar" onPress={onClose} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingBottom: 48 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  head: { gap: 8, paddingTop: 8, paddingBottom: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  empty: { gap: 8, padding: 18, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed' },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 3, gap: 3 },
  tab: { flex: 1, borderRadius: 11, paddingVertical: 7, paddingHorizontal: 2, alignItems: 'center' },
  tabTitle: { fontFamily: FONT.uiBold, fontSize: 12.5 },
  tabCount: { fontFamily: FONT.uiBold, fontSize: 15 },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 12 },
  cards: { gap: 10, minHeight: 200 },
  colEmpty: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 18, alignItems: 'center' },
  newCard: { borderWidth: 2, borderRadius: 12, padding: 12, gap: 10 },
  newInput: { fontFamily: FONT.ui, fontSize: 16, paddingVertical: 6 },
  moveRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  moveTitle: { fontFamily: FONT.uiBold, fontSize: 16 },
  moveOrder: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
