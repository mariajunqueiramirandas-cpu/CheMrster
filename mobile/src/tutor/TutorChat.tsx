/**
 * A conversation with the tutor (src/app/components/tutor/TutorChat.tsx): the messages,
 * what is streaming, and the box to write in.
 */
import * as Clipboard from 'expo-clipboard';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LESSON_BY_ID } from '../../../src/course/course.ts';
import { plainText } from '../../../src/tutor/markup.ts';
import type { Part, Thread, Turn, TutorTurn } from '../../../src/tutor/types.ts';
import { masteryAll, weakSpots } from '../../../src/study/progress.ts';
import { saveToMap } from '../../../src/app/canvas-store.ts';
import { dueLessons, useProgress } from '../../../src/app/store.ts';
import { toast } from '../../../src/app/toast.ts';
import {
  answerExercise,
  ask,
  closeTutor,
  isBusy,
  retry,
  stopReply,
  undoSaved,
  useConnection,
  useLiveTurns,
  useTutorData,
} from '../../../src/app/tutor-store.ts';
import { haptic, prefersReducedMotion } from '../lib/haptics.ts';
import { go } from '../lib/nav.ts';
import { COLUMN, FONT, SIZE, useTheme } from '../theme.ts';
import { CopyIcon, PinIcon, SendIcon, StopIcon, TutorIcon, UndoIcon } from '../ui/Icons.tsx';
import { Btn, Press } from '../ui/kit.tsx';
import { Markup } from './Markup.tsx';
import { MiniExercise } from './MiniExercise.tsx';

const TOOL_LABEL: Record<string, [running: string, done: string]> = {
  analisar_molecula: ['Analisando a estrutura…', 'Consultou o motor químico'],
  reagir: ['Calculando a reação…', 'Calculou a reação'],
  propor_exercicio: ['Preparando uma questão…', 'Questão pronta'],
  salvar_no_mapa: ['Montando cartões no mapa…', 'Cartões no mapa'],
  planejar_tarefas: ['Organizando o quadro…', 'Tarefas no quadro'],
};

/** Chips for the tools whose result has no card of its own. */
const QUIET_WHEN_DONE = new Set(['propor_exercicio', 'salvar_no_mapa', 'planejar_tarefas']);

/** Leaves the tutor for another screen: the sheet closes first. */
const leaveTo = (route: Parameters<typeof go>[0]) => {
  closeTutor();
  go(route);
};

/** "IA conectada" or "Modo offline"; opens Ajustes, where the key goes. */
export function ConnectionPill() {
  const c = useTheme();
  const conn = useConnection();
  if (!conn.checked && conn.kind === 'offline') {
    return (
      <View style={[styles.pill, { backgroundColor: c.benchDeep }]}>
        <View style={[styles.pillDot, { backgroundColor: c.muted }]} />
        <Text style={[styles.pillText, { color: c.muted }]}>Conectando…</Text>
      </View>
    );
  }
  const ai = conn.kind !== 'offline';
  const color = ai ? c.right : c.muted;
  return (
    <Press
      onPress={() => leaveTo({ name: 'settings' })}
      accessibilityRole="link"
      accessibilityLabel={ai ? 'IA conectada. Abrir Ajustes' : 'Modo offline. Abrir Ajustes'}
      hitSlop={6}
      style={[styles.pill, { backgroundColor: ai ? c.rightWash : c.benchDeep }]}
    >
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{ai ? 'IA conectada' : 'Modo offline'}</Text>
    </Press>
  );
}

/** A dot that breathes while a tool runs. */
function Pulse({ color, on }: { color: string; on: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on || prefersReducedMotion()) return v.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(v, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [on, v]);
  return <Animated.View style={[styles.chipDot, { backgroundColor: color, opacity: v }]} />;
}

/** Three dots while the tutor thinks. */
function Typing() {
  const c = useTheme();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={styles.typing} accessibilityLabel="O tutor está escrevendo">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: c.cobalt,
              opacity: t.interpolate({
                inputRange: [0, i * 0.2, i * 0.2 + 0.2, i * 0.2 + 0.4, 1],
                outputRange: [0.3, 0.3, 1, 0.3, 0.3],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

function PartView({ part, turn, threadId, last, width }: { part: Part; turn: TutorTurn; threadId: string; last: boolean; width: number }) {
  const c = useTheme();
  switch (part.type) {
    case 'text':
      return <Markup text={part.text} streaming={turn.status === 'streaming' && last} maxWidth={width} />;
    case 'tool': {
      if (part.status === 'done' && QUIET_WHEN_DONE.has(part.name)) return null;
      const [running, done] = TOOL_LABEL[part.name] ?? ['Trabalhando…', 'Pronto'];
      return (
        <View style={styles.chip}>
          <Pulse color={part.status === 'error' ? c.wrong : c.cobalt} on={part.status === 'running'} />
          <Text style={[styles.chipText, { color: c.muted }]}>
            {part.status === 'running' ? running : part.status === 'error' ? `Não deu: ${part.detail ?? 'erro'}` : done}
          </Text>
          {part.status === 'done' && part.detail ? (
            <Text style={[styles.chipDetail, { backgroundColor: c.benchDeep, color: c.text }]}>{part.detail}</Text>
          ) : null}
        </View>
      );
    }
    case 'exercise':
      return <MiniExercise part={part} width={width} disabled={isBusy(threadId)} onAnswer={(a) => answerExercise(threadId, turn.id, part.id, a)} />;
    case 'saved':
      return (
        <View style={[styles.saved, { borderColor: part.undone ? c.rule : c.cobalt }]}>
          <Text style={[styles.savedText, { color: part.undone ? c.muted : c.text }]}>
            {part.undone ? `Desfeito: ${part.summary}` : `Criado: ${part.summary}`}
          </Text>
          {!part.undone && (
            <View style={styles.row}>
              <Btn small label={part.target === 'map' ? 'Ver no mapa' : 'Ver no quadro'} onPress={() => leaveTo({ name: part.target === 'map' ? 'canvas' : 'board' })} />
              <Btn
                small
                kind="quiet"
                label="Desfazer"
                icon={(color) => <UndoIcon width={16} height={16} color={color} />}
                onPress={() => undoSaved(threadId, turn.id, part.id)}
              />
            </View>
          )}
        </View>
      );
    case 'notice':
      return (
        <View
          style={[
            styles.notice,
            part.tone === 'error' ? { backgroundColor: c.wrongWash, borderLeftWidth: 4, borderLeftColor: c.wrong } : { backgroundColor: c.benchDeep },
          ]}
          accessibilityRole={part.tone === 'error' ? 'alert' : undefined}
        >
          <Text style={[styles.noticeText, { color: c.text }]}>{part.text}</Text>
          {part.action === 'settings' && <Btn small label="Abrir Ajustes" onPress={() => leaveTo({ name: 'settings' })} />}
          {part.action === 'retry' && last && <Btn small label="Tentar de novo" onPress={() => retry(threadId)} />}
        </View>
      );
  }
}

function replyText(turn: TutorTurn): string {
  return turn.parts
    .filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n\n')
    .trim();
}

function Tag({ text }: { text: string }) {
  const c = useTheme();
  return <Text style={[styles.tag, { borderColor: c.rule, color: c.muted }]}>{text}</Text>;
}

function MsgAction({ icon, label, onPress }: { icon: (color: string) => ReactNode; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Press onPress={onPress} style={styles.msgAction} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      {icon(c.muted)}
      <Text style={[styles.msgActionText, { color: c.muted }]}>{label}</Text>
    </Press>
  );
}

function TutorMessage({ turn, threadId, isLast, width }: { turn: TutorTurn; threadId: string; isLast: boolean; width: number }) {
  const c = useTheme();
  const text = replyText(turn);
  const streaming = turn.status === 'streaming';
  const thinking = streaming && !turn.parts.some((p) => p.type === 'text' && p.text.trim());
  const body = width - 40;
  const save = () => {
    const firstLine = plainText(text).split('\n')[0];
    saveToMap({ kind: 'tutor', title: firstLine.length > 60 ? `${firstLine.slice(0, 58)}…` : firstLine || 'Resposta do tutor', text });
  };
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(plainText(text));
      toast('Resposta copiada');
    } catch {
      toast('Não foi possível copiar');
    }
  };
  return (
    <View style={styles.tutorMsg} accessibilityState={{ busy: streaming }}>
      <View style={[styles.mark, { backgroundColor: c.cobaltWash }]}>
        <TutorIcon width={18} height={18} color={c.cobalt} />
      </View>
      <View style={styles.msgBody}>
        {turn.parts.map((p, i) => (
          <PartView key={'id' in p ? p.id : i} part={p} turn={turn} threadId={threadId} last={i === turn.parts.length - 1 && isLast} width={body} />
        ))}
        {thinking && <Typing />}
        {!streaming && !!text && (
          <View style={styles.msgActions}>
            {turn.mode === 'offline' && <Tag text="da apostila" />}
            {turn.status === 'stopped' && <Tag text="interrompida" />}
            <MsgAction icon={(color) => <PinIcon width={16} height={16} color={color} />} label="Salvar no mapa" onPress={save} />
            <MsgAction icon={(color) => <CopyIcon width={16} height={16} color={color} />} label="Copiar" onPress={copy} />
          </View>
        )}
      </View>
    </View>
  );
}

function TurnView({ turn, threadId, isLast, width }: { turn: Turn; threadId: string; isLast: boolean; width: number }) {
  const c = useTheme();
  if (turn.role === 'assistant') return <TutorMessage turn={turn} threadId={threadId} isLast={isLast} width={width} />;
  return (
    <View style={styles.userMsg}>
      {turn.about ? <Text style={[styles.about, { color: c.muted }]}>{turn.about}</Text> : null}
      <Text style={[styles.bubble, { backgroundColor: c.magentaWash, color: c.text }]} selectable>
        {turn.text}
      </Text>
    </View>
  );
}

/** Ways to start, picked from where the learner stands. */
function useSuggestions(): string[] {
  const progress = useProgress();
  return useMemo(() => {
    const weak = weakSpots(masteryAll(progress))[0];
    const due = dueLessons(progress)[0];
    const out: string[] = [];
    if (weak) out.push(`Me testa em ${LESSON_BY_ID[weak.id].title.toLowerCase()}`);
    else if (due) out.push(`Revisa comigo ${LESSON_BY_ID[due.id].title.toLowerCase()}`);
    out.push('Monte um plano de estudos para esta semana');
    out.push('Faça um mapa mental das funções oxigenadas');
    out.push('O que é um carbono quiral?');
    if (!weak) out.push('Qual a diferença entre aldeído e cetona?');
    return out.slice(0, 4);
  }, [progress]);
}

function Empty({ onSend }: { onSend: (text: string) => void }) {
  const c = useTheme();
  const connection = useConnection();
  const suggestions = useSuggestions();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { backgroundColor: c.cobaltWash }]}>
        <TutorIcon width={30} height={30} color={c.cobalt} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]} accessibilityRole="header">
        O que vamos estudar?
      </Text>
      <Text style={[styles.emptyText, { color: c.muted }]}>
        Pergunte qualquer coisa de química orgânica. O tutor confere as estruturas com o mesmo motor que corrige as questões, pode te testar aqui mesmo e
        salvar o que importa no seu mapa e no seu quadro.
      </Text>
      {connection.kind === 'offline' && connection.checked && (
        <Text style={[styles.emptyNote, { backgroundColor: c.benchDeep, color: c.text }]}>
          Modo offline: as respostas vêm da apostila do app.{' '}
          <Text style={{ color: c.cobalt, fontFamily: FONT.uiBold }} onPress={() => leaveTo({ name: 'settings' })} accessibilityRole="link">
            Conecte a IA em Ajustes
          </Text>{' '}
          para conversar livremente.
        </Text>
      )}
      <View style={styles.chips}>
        {suggestions.map((s) => (
          <Press key={s} onPress={() => onSend(s)} accessibilityRole="button" style={[styles.suggestion, { borderColor: c.rule, backgroundColor: c.surface }]}>
            <Text style={[styles.suggestionText, { color: c.text }]}>{s}</Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

export function TutorChat({
  threadId,
  onThread,
  bottomInset = 0,
  autoFocus,
}: {
  threadId?: string;
  onThread: (id: string) => void;
  /** Room to leave under the composer (the home indicator, when nothing else covers it). */
  bottomInset?: number;
  autoFocus?: boolean;
}) {
  const c = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const data = useTutorData();
  const liveTurns = useLiveTurns();
  const thread: Thread | undefined = threadId ? data.threads[threadId] : undefined;
  const liveTurn = thread ? liveTurns[thread.id] : undefined;
  const turns: Turn[] = thread ? [...thread.turns, ...(liveTurn ? [liveTurn] : [])] : [];
  const busy = !!liveTurn;
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollViewInstance>(null);
  const stick = useRef(true);
  const [width, setWidth] = useState(Math.min(windowWidth, COLUMN) - 32);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    haptic('tap');
    stick.current = true;
    const id = ask({ text: t, thread: thread?.id });
    setDraft('');
    if (id && id !== thread?.id) onThread(id);
  };

  return (
    <KeyboardAvoidingView style={styles.chat} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onLayout={(e) => setWidth(Math.min(e.nativeEvent.layout.width, COLUMN) - 32)}
        // Follow the reply as it streams, unless the learner scrolled up to read.
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          stick.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        }}
        onContentSizeChange={() => {
          if (stick.current && turns.length) scroller.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={styles.column}>
          {turns.length === 0 ? (
            <Empty onSend={send} />
          ) : (
            <View style={styles.log} accessibilityLiveRegion="polite">
              {turns.map((t, i) => (
                <TurnView key={t.id} turn={t} threadId={thread!.id} isLast={i === turns.length - 1} width={width} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={[styles.composer, { borderTopColor: c.benchDeep, backgroundColor: c.bench, paddingBottom: 10 + bottomInset }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={busy ? 'O tutor está respondendo…' : 'Pergunte ao tutor'}
          placeholderTextColor={c.muted}
          multiline
          autoFocus={autoFocus}
          accessibilityLabel="Mensagem para o tutor"
          style={[styles.input, { borderColor: c.rule, backgroundColor: c.surface, color: c.text }]}
          selectionColor={c.cobalt}
        />
        {busy ? (
          <Press onPress={() => stopReply(thread!.id)} accessibilityRole="button" accessibilityLabel="Parar a resposta" style={[styles.send, { backgroundColor: c.text }]}>
            <StopIcon color={c.bench} />
          </Press>
        ) : (
          <Press
            onPress={() => send(draft)}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !draft.trim() }}
            style={[styles.send, { backgroundColor: draft.trim() ? c.cobalt : c.benchDeep }]}
          >
            <SendIcon color={draft.trim() ? '#fff' : c.muted} />
          </Press>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chat: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, flexGrow: 1 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center' },
  log: { gap: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: FONT.uiBold, fontSize: 12 },
  userMsg: { alignSelf: 'flex-end', alignItems: 'flex-end', gap: 4, maxWidth: '86%' },
  about: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  bubble: {
    fontFamily: FONT.ui,
    fontSize: SIZE.body,
    lineHeight: SIZE.body * 1.45,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  tutorMsg: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  mark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  msgBody: { flex: 1, minWidth: 0, gap: 12, paddingTop: 3 },
  chip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: FONT.ui, fontSize: SIZE.small },
  chipDetail: { fontFamily: FONT.ui, fontSize: SIZE.small, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },
  typing: { flexDirection: 'row', gap: 5, height: 24, alignItems: 'center' },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  msgActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2, marginTop: -4 },
  msgAction: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 4 },
  msgActionText: { fontFamily: FONT.uiBold, fontSize: SIZE.small },
  tag: { fontFamily: FONT.ui, fontSize: 12, paddingVertical: 1, paddingHorizontal: 8, borderWidth: 1, borderRadius: 999 },
  saved: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 2, borderStyle: 'dashed', borderRadius: 14 },
  savedText: { fontFamily: FONT.uiBold, fontSize: 16, flexGrow: 1, flexBasis: 160 },
  notice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  noticeText: { fontFamily: FONT.ui, fontSize: 16, lineHeight: 22, flexGrow: 1, flexBasis: 200 },
  empty: { alignItems: 'center', gap: 12, marginTop: 20, maxWidth: 520, alignSelf: 'center' },
  emptyMark: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONT.display, fontSize: SIZE.step2, lineHeight: SIZE.step2 * 1.2, textAlign: 'center' },
  emptyText: { fontFamily: FONT.ui, fontSize: SIZE.body, lineHeight: SIZE.body * 1.5, textAlign: 'center' },
  emptyNote: { fontFamily: FONT.ui, fontSize: SIZE.small, lineHeight: SIZE.small * 1.45, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, overflow: 'hidden', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 },
  suggestion: { minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 2, borderRadius: 999 },
  suggestionText: { fontFamily: FONT.uiBold, fontSize: SIZE.small + 0.5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, paddingHorizontal: 12, borderTopWidth: 2 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 160,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 18,
    fontFamily: FONT.ui,
    fontSize: SIZE.body,
    textAlignVertical: 'center',
  },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
