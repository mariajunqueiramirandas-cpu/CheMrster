/**
 * The keyboard: the pieces of names, grouped by slot, coloured by what the guesses so far have
 * shown (like Wordle's letters). A salt has too many pieces for one screen, so its keyboard has
 * an anion side and a cation side. Under the keys, the name being built and the send key.
 */
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Verdict } from '../../../src/nomenclatura/grade.ts';
import { type Category, type Guess, type Piece, SLOT_LABEL, type Slot, compose, keyboard } from '../../../src/nomenclatura/pieces.ts';
import { FONT, useTheme, useTiles } from '../theme.ts';
import { BackspaceIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Press } from '../ui/kit.tsx';

const ANION: readonly Slot[] = ['prefixo', 'radical', 'sufixo'];

type Side = 'anion' | 'cation';

function Key({ p, state, picked, onPress }: { p: Piece; state?: Verdict; picked: boolean; onPress: () => void }) {
  const c = useTheme();
  const tiles = useTiles();
  const look = state ? tiles[state] : { bg: c.surface, fg: c.text };
  const said = state === 'right' ? ', certo' : state === 'close' ? ', quase' : state === 'wrong' ? ', errado' : '';
  return (
    <Press
      onPress={(e) => {
        onPress();
        // On the web a clicked key keeps the focus and would take the next Enter for itself.
        if (Platform.OS === 'web' && !String((e.nativeEvent as { type?: string }).type).startsWith('key')) {
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
      }}
      sink={1}
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      accessibilityLabel={`${SLOT_LABEL[p.slot]} ${p.label}${said}`}
      style={[
        styles.key,
        { backgroundColor: look.bg, borderColor: picked ? c.magenta : state ? look.bg : c.rule },
        picked && styles.picked,
        state === 'wrong' && !picked ? { opacity: 0.55 } : null,
      ]}
    >
      <Text style={[styles.keyText, { color: look.fg }]}>{p.label}</Text>
    </Press>
  );
}

export function Keyboard({
  category,
  draft,
  states,
  onKey,
  onBack,
  onEnter,
}: {
  category: Category;
  draft: Guess;
  states: Map<string, Verdict>;
  onKey: (p: Piece) => void;
  onBack: () => void;
  onEnter: () => void;
}) {
  const c = useTheme();
  const { height } = useWindowDimensions();
  const [side, setSide] = useState<Side>('anion');
  const keysScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const groups = keyboard(category);
  const split = category === 'sal';
  const anionDone = draft.radical !== undefined && draft.sufixo !== undefined;

  const empty = Object.values(draft).every((v) => v === undefined);

  // Once the anion has its root and suffix, the cation side comes up by itself (once); a sent
  // guess (an empty draft) starts again on the anion side.
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (split && anionDone && draft.cation === undefined && !moved) {
      setSide('cation');
      setMoved(true);
    }
    if (!anionDone) setMoved(false);
  }, [split, anionDone, draft.cation, moved]);
  useEffect(() => {
    if (empty) setSide('anion');
  }, [empty]);
  // Each side starts at its first keys.
  useEffect(() => keysScroll.current?.scrollTo({ y: 0, animated: false }), [side]);

  const shown = split ? groups.filter((g) => ANION.includes(g.slot) === (side === 'anion')) : groups;

  return (
    <View style={[styles.wrap, { backgroundColor: c.surface, borderTopColor: c.benchDeep }]}>
      {split && (
        <View style={[styles.sides, { backgroundColor: c.benchDeep }]} accessibilityRole="tablist">
          {(['anion', 'cation'] as const).map((s) => {
            const on = s === side;
            return (
              <Press
                key={s}
                sink={1}
                onPress={() => setSide(s)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.side, on && { backgroundColor: c.surface }]}
              >
                <Text style={[styles.sideText, { color: on ? c.text : c.muted }]}>{s === 'anion' ? 'Ânion' : 'Cátion'}</Text>
              </Press>
            );
          })}
        </View>
      )}
      {/* On short screens the keys scroll, so the board above always keeps some room. */}
      <ScrollView ref={keysScroll} style={{ maxHeight: Math.max(170, height * (height < 780 ? 0.34 : 0.44)) }} contentContainerStyle={styles.groups} keyboardShouldPersistTaps="handled">
        {shown.map((g) => (
          <View key={g.slot} style={styles.group}>
            <Text style={[styles.groupLabel, { color: c.muted }]}>{SLOT_LABEL[g.slot]}</Text>
            <View style={styles.keys}>
              {g.pieces.map((p) => (
                <Key key={p.id} p={p} state={states.get(`${p.slot}:${p.id}`)} picked={draft[p.slot] === p.id} onPress={() => onKey(p)} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bottom}>
        <Text
          style={[styles.preview, { color: empty ? c.muted : c.text, fontFamily: empty ? FONT.ui : FONT.display }]}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {empty ? 'Toque nas peças para montar o nome' : compose(category, draft)}
        </Text>
        <IconBtn label="Apagar" onPress={onBack} style={[styles.back, { borderColor: c.rule }]}>
          <BackspaceIcon color={c.text} />
        </IconBtn>
        <Btn kind="primary" small label="Enviar" onPress={onEnter} style={styles.send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 2, paddingHorizontal: 10, paddingTop: 8, gap: 6 },
  sides: { flexDirection: 'row', borderRadius: 10, padding: 3, alignSelf: 'center', width: '100%', maxWidth: 360 },
  side: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  sideText: { fontFamily: FONT.uiBold, fontSize: 14 },
  groups: { gap: 6 },
  group: { gap: 3 },
  groupLabel: { fontFamily: FONT.uiBold, fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', marginLeft: 2 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  key: { minHeight: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  picked: { borderWidth: 2.5 },
  keyText: { fontFamily: FONT.uiBold, fontSize: 15 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2, paddingBottom: 6 },
  preview: { flex: 1, fontSize: 16, lineHeight: 20 },
  back: { borderWidth: 2, width: 46, height: 40 },
  send: { minWidth: 96 },
});
