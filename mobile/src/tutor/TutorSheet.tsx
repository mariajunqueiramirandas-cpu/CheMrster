/**
 * The tutor over any screen, lessons included (src/app/components/tutor/TutorPanel.tsx): a
 * full-height bottom sheet on the conversation at hand. On the Tutor tab the tab shows it instead.
 */
import { usePathname } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closeTutor, showThread, useTutorData, useTutorPanel } from '../../../src/app/tutor-store.ts';
import { go } from '../lib/nav.ts';
import { FONT, SIZE, useTheme } from '../theme.ts';
import { CloseIcon, HistoryIcon, PlusIcon, TutorIcon } from '../ui/Icons.tsx';
import { IconBtn } from '../ui/kit.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { ConnectionPill, TutorChat } from './TutorChat.tsx';

/** Where the Tutor tab lives; there the sheet steps aside. */
export const TUTOR_PATH = '/tutor';

export function TutorSheet() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { open, threadId } = useTutorPanel();
  const data = useTutorData();
  const pathname = usePathname();
  const onTab = pathname === TUTOR_PATH;
  const thread = threadId ? data.threads[threadId] : undefined;

  return (
    <Sheet visible={open && !onTab} onClose={closeTutor} full>
      <View style={[styles.sheet, { marginBottom: -Math.max(insets.bottom, 12) }]}>
        <View style={styles.head}>
          <View style={[styles.mark, { backgroundColor: c.cobaltWash }]}>
            <TutorIcon width={20} height={20} color={c.cobalt} />
          </View>
          <View style={styles.titles}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
                Tutor
              </Text>
              <ConnectionPill />
            </View>
            <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
              {thread ? thread.title : 'Nova conversa'}
            </Text>
          </View>
          <IconBtn label="Nova conversa" onPress={() => showThread(undefined)} style={styles.icon}>
            <PlusIcon color={c.muted} />
          </IconBtn>
          <IconBtn
            label="Todas as conversas"
            onPress={() => {
              closeTutor();
              go({ name: 'tutor', thread: threadId });
            }}
            style={styles.icon}
          >
            <HistoryIcon color={c.muted} />
          </IconBtn>
          <IconBtn label="Fechar o tutor" onPress={closeTutor} style={styles.icon}>
            <CloseIcon color={c.muted} />
          </IconBtn>
        </View>
        <View style={[styles.body, { marginHorizontal: -16, borderTopColor: c.benchDeep }]}>
          <TutorChat key={threadId ?? 'new'} threadId={threadId} onThread={showThread} bottomInset={Math.max(insets.bottom, 12)} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, marginTop: -4 },
  mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, minWidth: 0, marginLeft: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: FONT.display, fontSize: SIZE.step1, lineHeight: SIZE.step1 * 1.15 },
  sub: { fontFamily: FONT.ui, fontSize: SIZE.small },
  icon: { width: 38, height: 38 },
  body: { flex: 1, borderTopWidth: 2 },
});
