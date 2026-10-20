/**
 * The Tutor tab (src/app/screens/TutorScreen.tsx): the open conversation, with every saved
 * conversation one tap away in a sheet.
 */
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { closeTutor, deleteThread, useTutorData, useTutorPanel } from '../../../src/app/tutor-store.ts';
import { FONT, SIZE, useTheme } from '../theme.ts';
import { ConnectionPill, TutorChat } from '../tutor/TutorChat.tsx';
import { TUTOR_PATH } from '../tutor/TutorSheet.tsx';
import { TopBar } from '../ui/Bars.tsx';
import { HistoryIcon, PlusIcon, TrashIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Press, Txt } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';

const when = (t: number) => {
  const d = new Date(t);
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
};

/** Asks before deleting; the web build (previews) has no native dialog. */
function confirmDelete(title: string, onYes: () => void) {
  const message = `Apagar a conversa “${title}”?`;
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert('Apagar conversa', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Apagar', style: 'destructive', onPress: onYes },
  ]);
}

export function TutorScreen() {
  const c = useTheme();
  const data = useTutorData();
  const panel = useTutorPanel();
  const focused = usePathname() === TUTOR_PATH;
  const { thread: param } = useLocalSearchParams<{ thread?: string }>();
  const [chosen, setChosen] = useState<string | undefined>(param);
  const [listOpen, setListOpen] = useState(false);

  // A link to a conversation (from the sheet's "Todas as conversas", or Mais) opens it here.
  useEffect(() => {
    if (param) setChosen(param);
  }, [param]);

  // Asked from this tab (a lesson link, a molecule): the conversation shows here, not in a sheet.
  useEffect(() => {
    if (!focused || !panel.open) return;
    setChosen(panel.threadId);
    closeTutor();
  }, [focused, panel.open, panel.threadId]);

  const current = chosen && data.threads[chosen] ? chosen : undefined;
  const open = (id?: string) => {
    setChosen(id);
    router.setParams({ thread: id });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bench }}>
      <TopBar />
      <View style={[styles.head, { borderBottomColor: c.benchDeep }]}>
        <Btn small label="Conversas" icon={(color) => <HistoryIcon width={18} height={18} color={color} />} onPress={() => setListOpen(true)} />
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <ConnectionPill />
        </View>
        {current && <Btn small label="Nova" icon={(color) => <PlusIcon width={18} height={18} color={color} />} onPress={() => open(undefined)} />}
      </View>
      <TutorChat key={current ?? 'new'} threadId={current} onThread={(id) => open(id)} />

      <Sheet visible={listOpen} onClose={() => setListOpen(false)}>
        <Txt variant="title" accessibilityRole="header">
          Conversas
        </Txt>
        <Btn
          kind="primary"
          wide
          label="Nova conversa"
          icon={(color) => <PlusIcon color={color} />}
          style={{ marginTop: 14 }}
          onPress={() => {
            open(undefined);
            setListOpen(false);
          }}
        />
        {data.order.length === 0 ? (
          <Txt tone="muted" style={{ marginTop: 16, marginBottom: 8 }}>
            Suas conversas ficam salvas aqui, neste aparelho.
          </Txt>
        ) : (
          <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {data.order.map((id) => {
              const t = data.threads[id];
              const here = id === current;
              return (
                <View key={id} style={[styles.thread, here && { backgroundColor: c.magentaWash }]}>
                  <Press
                    onPress={() => {
                      open(id);
                      setListOpen(false);
                    }}
                    accessibilityRole="link"
                    accessibilityState={{ selected: here }}
                    style={styles.threadLink}
                  >
                    <Text style={[styles.threadTitle, { color: c.text }]} numberOfLines={2}>
                      {t.title}
                    </Text>
                    <Text style={[styles.threadWhen, { color: c.muted }]}>{when(t.updatedAt)}</Text>
                  </Press>
                  <IconBtn
                    label={`Apagar a conversa “${t.title}”`}
                    onPress={() =>
                      confirmDelete(t.title, () => {
                        deleteThread(id);
                        if (here) open(undefined);
                      })
                    }
                  >
                    <TrashIcon width={18} height={18} color={c.muted} />
                  </IconBtn>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 2 },
  thread: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingLeft: 12 },
  threadLink: { flex: 1, paddingVertical: 10 },
  threadTitle: { fontFamily: FONT.uiBold, fontSize: SIZE.body },
  threadWhen: { fontFamily: FONT.ui, fontSize: SIZE.small },
});
