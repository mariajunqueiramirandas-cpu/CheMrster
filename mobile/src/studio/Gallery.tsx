/** Molecules that keep showing up in the ENEM, to open in the editor. */
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { MOLECULES, type MoleculeEntry } from '../../../src/content/molecules.ts';
import { STYLES, depict } from '../../../src/nanquim/index.ts';
import { COLUMN, FONT, GUTTER, SIZE, paperShadow, useTheme } from '../theme.ts';
import { MoleculeView } from '../ui/MoleculeView.tsx';
import { Press, Txt } from '../ui/kit.tsx';

const THUMB = 104;

export function Gallery({ current, onOpen }: { current: string; onOpen: (smiles: string) => void }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const column = Math.min(width, COLUMN) - GUTTER * 2;
  const cols = column >= 480 ? 3 : 2;
  const tile = (column - (cols - 1) * 12) / cols;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOLECULES.filter((m) => !q || m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)) || m.note?.toLowerCase().includes(q));
  }, [query]);
  return (
    <View style={styles.gallery}>
      <Txt variant="title" accessibilityRole="header">
        Moléculas que caem no ENEM
      </Txt>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por nome ou função"
        placeholderTextColor={c.muted}
        accessibilityLabel="Buscar molécula"
        autoCorrect={false}
        style={[styles.search, { borderColor: c.rule, backgroundColor: c.surface, color: c.text }]}
      />
      {list.length === 0 ? (
        <Txt tone="muted">Nenhuma molécula com esse nome ou função. Tente "éster" ou "fármaco".</Txt>
      ) : (
        <View style={styles.grid}>
          {list.map((m) => (
            <Item key={m.id} entry={m} width={tile} current={m.smiles === current} onOpen={onOpen} />
          ))}
        </View>
      )}
    </View>
  );
}

const Item = memo(function Item({ entry, width, current, onOpen }: { entry: MoleculeEntry; width: number; current: boolean; onOpen: (smiles: string) => void }) {
  const c = useTheme();
  // Thumbnails fit a 104px-tall box: tall structures narrow down instead of growing.
  const maxWidth = useMemo(() => {
    const { viewBox } = depict(entry.smiles, { conventions: 'enem', style: { ...STYLES.enem, bondLength: 22, padding: 0.45 } });
    return Math.min(width - 24, (viewBox.width * THUMB) / viewBox.height);
  }, [entry.smiles, width]);
  return (
    <Press
      onPress={() => onOpen(entry.smiles)}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={[styles.item, { width, backgroundColor: c.paper, borderColor: current ? c.magenta : 'transparent' }, paperShadow(c)]}
    >
      <View style={styles.thumb}>
        <MoleculeView smiles={entry.smiles} size={22} maxWidth={maxWidth} />
      </View>
      <Text style={styles.name}>{entry.name}</Text>
      {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
    </Press>
  );
});

const styles = StyleSheet.create({
  gallery: { gap: 10, marginTop: 36 },
  search: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderRadius: 12, fontFamily: FONT.ui, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  item: { padding: 10, borderRadius: 6, borderWidth: 3, gap: 2 },
  thumb: { height: THUMB, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { marginTop: 6, fontFamily: FONT.uiBold, fontSize: SIZE.small, color: '#1e2a36' },
  note: { fontFamily: FONT.ui, fontSize: 12, lineHeight: 16, color: '#56626f' },
});
