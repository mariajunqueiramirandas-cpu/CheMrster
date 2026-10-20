/**
 * The map's bottom sheets (the web's canvas dialogs): add a structure, add theory from the
 * track, build a map with the tutor, switch and manage maps, and edit a card.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { LESSONS } from '../../../src/course/course.ts';
import { THEORY } from '../../../src/course/theory/index.ts';
import { MOLECULES } from '../../../src/content/molecules.ts';
import { editCanvas, tweakCanvas, useCanvas } from '../../../src/app/canvas-store.ts';
import { uid } from '../../../src/app/persist.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { type MapNode, addMap, removeMap, renameMap } from '../../../src/study/canvas.ts';
import { FONT, useTheme } from '../theme.ts';
import { CloseIcon, EditIcon, TrashIcon } from '../ui/Icons.tsx';
import { Btn, IconBtn, Paper, Press, Txt } from '../ui/kit.tsx';
import { MoleculeView } from '../ui/MoleculeView.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { validSmiles } from './NodeCard.tsx';

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.head}>
      <Txt variant="title" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Txt>
      <IconBtn label="Fechar" onPress={onClose}>
        <CloseIcon color={c.muted} />
      </IconBtn>
    </View>
  );
}

/** A labelled text field in the app's style. */
export function Field({ label, invalid, mono, ...rest }: TextInputProps & { label?: string; invalid?: boolean; mono?: boolean }) {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? (
        <Txt variant="small" tone="muted" style={{ fontFamily: FONT.uiBold }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label ?? rest.placeholder}
        {...rest}
        style={[
          styles.input,
          { color: c.text, backgroundColor: c.surface, borderColor: invalid ? c.wrong : c.rule },
          mono && { fontFamily: FONT.mono, fontSize: 15 },
          rest.multiline && { minHeight: 110, textAlignVertical: 'top' },
          rest.style,
        ]}
      />
    </View>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function MoleculeSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (smiles: string, name: string) => void }) {
  const c = useTheme();
  const [query, setQuery] = useState('');
  const [smiles, setSmiles] = useState('');
  const [name, setName] = useState('');
  const valid = useMemo(() => validSmiles(smiles.trim()), [smiles]);
  const q = query.trim().toLowerCase();
  const list = MOLECULES.filter((m) => !q || m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q))).slice(0, 12);
  const add = () => {
    if (!valid) return;
    onAdd(smiles.trim(), name.trim());
    onClose();
  };
  return (
    <Sheet visible onClose={onClose}>
      <Head title="Adicionar estrutura" onClose={onClose} />
      <Scroll>
        <Field
          label="SMILES"
          value={smiles}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Ex.: CC(=O)O"
          onChangeText={setSmiles}
          onSubmitEditing={add}
          invalid={!!smiles && !valid}
          mono
        />
        <Field label="Nome (opcional)" value={name} placeholder="Ex.: ácido acético" onChangeText={setName} />
        {valid && (
          <Paper style={styles.preview}>
            <MoleculeView smiles={smiles.trim()} size={24} />
          </Paper>
        )}
        <Field label="Ou escolha da galeria" value={query} placeholder="Buscar por nome ou função" onChangeText={setQuery} autoCapitalize="none" />
        <View style={styles.chips}>
          {list.map((m) => {
            const on = m.smiles === smiles;
            return (
              <Press
                key={m.id}
                onPress={() => {
                  setSmiles(m.smiles);
                  setName(m.name);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { borderColor: on ? c.magenta : c.rule, backgroundColor: on ? c.magentaWash : c.surface }]}
              >
                <Text style={[styles.chipText, { color: on ? c.magenta : c.text }]}>{m.name}</Text>
              </Press>
            );
          })}
        </View>
      </Scroll>
      <Btn kind="primary" wide label="Adicionar ao mapa" disabled={!valid} onPress={add} style={{ marginTop: 10 }} />
    </Sheet>
  );
}

export function TheorySheet({ onClose, onAdd }: { onClose: () => void; onAdd: (lessonId: string, index: number, title: string) => void }) {
  const c = useTheme();
  return (
    <Sheet visible onClose={onClose}>
      <Head title="Teoria da trilha" onClose={onClose} />
      <Txt tone="muted" style={{ marginBottom: 10 }}>
        Escolha um cartão: ele entra no mapa como na lição.
      </Txt>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
        {LESSONS.filter((l) => THEORY[l.id]?.length).map((l) => (
          <View key={l.id} style={{ gap: 6 }}>
            <View style={styles.lessonHead}>
              <View style={[styles.miniTile, { backgroundColor: c.magenta }]}>
                <Text style={styles.miniTileText}>{l.element.symbol}</Text>
              </View>
              <Txt variant="strong">{l.title}</Txt>
            </View>
            {THEORY[l.id].map((card, i) => (
              <Press
                key={i}
                onPress={() => {
                  onAdd(l.id, i, card.title);
                  onClose();
                }}
                accessibilityRole="button"
                style={[styles.row, { borderColor: c.rule, backgroundColor: c.surface }]}
              >
                <Txt>{card.title}</Txt>
              </Press>
            ))}
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const MAP_TOPICS = ['funções orgânicas oxigenadas', 'reações de adição e Markovnikov', 'isomeria', 'polímeros de adição e de condensação', 'hidrocarbonetos'];

export function TutorMapSheet({ onClose }: { onClose: () => void }) {
  const c = useTheme();
  const [topic, setTopic] = useState('');
  const go = (t: string) => {
    if (!t.trim()) return;
    onClose();
    ask({
      text: `Monte no meu mapa um mapa de conceitos sobre ${t.trim()}, com os conceitos-chave ligados por setas com rótulo.`,
      about: 'Mapa de conceitos',
      open: true,
    });
  };
  return (
    <Sheet visible onClose={onClose}>
      <Head title="Montar com o tutor" onClose={onClose} />
      <Txt tone="muted">O tutor cria os cartões e as setas neste mapa. Você pode mover, editar ou desfazer tudo depois.</Txt>
      <View style={styles.formRow}>
        <View style={{ flex: 1 }}>
          <Field
            value={topic}
            placeholder="Tema, ex.: ésteres e aromas"
            onChangeText={setTopic}
            onSubmitEditing={() => go(topic)}
            accessibilityLabel="Tema do mapa"
          />
        </View>
        <Btn kind="primary" label="Montar" disabled={!topic.trim()} onPress={() => go(topic)} />
      </View>
      <View style={[styles.chips, { marginTop: 12 }]}>
        {MAP_TOPICS.map((t) => (
          <Press key={t} onPress={() => go(t)} accessibilityRole="button" style={[styles.chip, { borderColor: c.cobalt, backgroundColor: c.cobaltWash }]}>
            <Text style={[styles.chipText, { color: c.cobalt }]}>{t}</Text>
          </Press>
        ))}
      </View>
    </Sheet>
  );
}

export function MapsSheet({ onClose }: { onClose: () => void }) {
  const c = useTheme();
  const canvas = useCanvas();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const create = () => {
    if (!name.trim()) return;
    editCanvas((cv) => addMap(cv, uid('m'), name.trim()));
    setName('');
    onClose();
  };
  return (
    <Sheet visible onClose={onClose}>
      <Head title="Seus mapas" onClose={onClose} />
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {canvas.maps.map((m) => {
          const count = Object.values(canvas.nodes).filter((n) => n.map === m.id).length;
          const current = m.id === canvas.current;
          return (
            <View key={m.id} style={[styles.mapRow, { borderColor: current ? c.magenta : c.rule, backgroundColor: current ? c.magentaWash : c.surface }]}>
              {renaming === m.id ? (
                <View style={{ flex: 1 }}>
                  <Field
                    autoFocus
                    value={m.name}
                    accessibilityLabel="Nome do mapa"
                    onChangeText={(v) => tweakCanvas((cv) => renameMap(cv, m.id, v))}
                    onBlur={() => setRenaming(null)}
                    onSubmitEditing={() => setRenaming(null)}
                  />
                </View>
              ) : (
                <Press
                  style={{ flex: 1, paddingVertical: 6 }}
                  accessibilityRole="button"
                  onPress={() => {
                    tweakCanvas((cv) => ({ ...cv, current: m.id }));
                    onClose();
                  }}
                >
                  <Txt variant="strong">{m.name}</Txt>
                  <Txt variant="small" tone="muted">
                    {count} {count === 1 ? 'cartão' : 'cartões'}
                  </Txt>
                </Press>
              )}
              <IconBtn label={`Renomear “${m.name}”`} onPress={() => setRenaming(m.id)}>
                <EditIcon width={18} height={18} color={c.muted} />
              </IconBtn>
              {canvas.maps.length > 1 && (
                <IconBtn
                  label={`Apagar “${m.name}”`}
                  onPress={() =>
                    Alert.alert('Apagar mapa', `Apagar o mapa “${m.name}” e seus ${count} cartões?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Apagar', style: 'destructive', onPress: () => editCanvas((cv) => removeMap(cv, m.id)) },
                    ])
                  }
                >
                  <TrashIcon width={18} height={18} color={c.wrong} />
                </IconBtn>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.formRow, { marginTop: 14 }]}>
        <View style={{ flex: 1 }}>
          <Field value={name} placeholder="Novo mapa, ex.: Reações" onChangeText={setName} onSubmitEditing={create} accessibilityLabel="Nome do novo mapa" />
        </View>
        <Btn kind="primary" label="Criar" disabled={!name.trim()} onPress={create} />
      </View>
    </Sheet>
  );
}

/** Editing a card happens in a sheet, where the keyboard has room; closing it saves. */
export function EditSheet({ node, onSave, onClose }: { node: MapNode; onSave: (patch: Partial<MapNode>) => void; onClose: () => void }) {
  const [title, setTitle] = useState(node.title);
  const [text, setText] = useState(node.text);
  const [smiles, setSmiles] = useState(node.smiles ?? '');
  const smilesOk = node.kind !== 'molecule' || validSmiles(smiles.trim());
  const done = () => {
    onSave({ title: title.trim(), text, ...(node.kind === 'molecule' ? { smiles: smiles.trim() } : {}) });
    onClose();
  };
  return (
    <Sheet visible onClose={done}>
      <Head title={node.kind === 'note' ? 'Nota' : 'Editar cartão'} onClose={done} />
      <Scroll>
        <Field
          autoFocus={!node.title}
          value={title}
          placeholder="Título"
          accessibilityLabel="Título do cartão"
          onChangeText={setTitle}
          style={{ fontFamily: FONT.display, fontSize: 18 }}
        />
        {node.kind === 'molecule' && (
          <>
            <Field
              value={smiles}
              placeholder="SMILES, ex.: CCO"
              accessibilityLabel="Estrutura em SMILES"
              autoCapitalize="none"
              autoCorrect={false}
              invalid={!smilesOk}
              onChangeText={setSmiles}
              mono
            />
            {smilesOk && smiles.trim() ? (
              <Paper style={styles.preview}>
                <MoleculeView smiles={smiles.trim()} size={20} />
              </Paper>
            ) : null}
          </>
        )}
        <Field
          value={text}
          multiline
          placeholder="Escreva aqui. **Negrito** marca os termos-chave."
          accessibilityLabel="Texto do cartão"
          onChangeText={setText}
        />
      </Scroll>
      <Btn kind="primary" wide label="Salvar" onPress={done} style={{ marginTop: 10 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  input: { borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONT.ui, fontSize: 17 },
  preview: { alignItems: 'center', padding: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: FONT.uiBold, fontSize: 14.5 },
  lessonHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniTile: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  miniTileText: { color: '#fff', fontFamily: FONT.displayHeavy, fontSize: 13 },
  row: { borderWidth: 2, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 },
});
