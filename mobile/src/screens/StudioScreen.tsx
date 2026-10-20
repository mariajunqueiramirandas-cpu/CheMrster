/**
 * Estruturas (src/app/screens/StudioScreen.tsx): type a SMILES and see it drawn as in a printed
 * book, read what the engine says about it, run the ENEM reactions on it, or pick one from
 * the gallery. On the web the drawing downloads or prints; here it is shared as an SVG file.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View, useWindowDimensions } from 'react-native';
import { saveToMap } from '../../../src/app/canvas-store.ts';
import { toast } from '../../../src/app/toast.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { functionalGroups } from '../../../src/chem/analysis.ts';
import { MOLECULES } from '../../../src/content/molecules.ts';
import { subscript } from '../../../src/course/kit.ts';
import { type Annotation, type FormulaKind, STYLES, moleculeFromSmiles, renderSVG } from '../../../src/nanquim/index.ts';
import { Field, Segmented, Toggle } from '../settings/controls.tsx';
import { shareText } from '../settings/files.ts';
import { Analysis } from '../studio/Analysis.tsx';
import { Gallery } from '../studio/Gallery.tsx';
import { ReactionLab } from '../studio/ReactionLab.tsx';
import { COLUMN, GUTTER, useTheme } from '../theme.ts';
import { BackBar } from '../ui/Bars.tsx';
import { DownloadIcon, PinIcon, TutorIcon } from '../ui/Icons.tsx';
import { type MoleculeLook, MoleculeView } from '../ui/MoleculeView.tsx';
import { Btn, Paper, Txt } from '../ui/kit.tsx';

const FORMULAS: Array<{ id: FormulaKind; label: string }> = [
  { id: 'skeletal', label: 'Bastão' },
  { id: 'condensed', label: 'Condensada' },
  { id: 'plana', label: 'Plana' },
  { id: 'structural', label: 'Completa' },
];

const LOOKS: Array<{ id: MoleculeLook; label: string }> = [
  { id: 'enem', label: 'ENEM' },
  { id: 'textbook', label: 'Livro' },
  { id: 'acs', label: 'Revista' },
];

/** Short names the booklets write next to marked groups (2024 Q112: "nitro", "éter"). */
const SHORT_NAME: Partial<Record<string, string>> = {
  nitrocomposto: 'nitro',
  'haleto orgânico': 'haleto',
  'sal orgânico': 'carboxilato',
};

/** ENEM-style group marks: a dashed outline and the group's name, as in 2024 Q112. */
function groupAnnotations(smiles: string): Annotation[] {
  const mol = moleculeFromSmiles(smiles);
  return functionalGroups(mol).map((g) => ({ atoms: g.atoms, label: SHORT_NAME[g.id] ?? g.id }));
}

const DEFAULT = MOLECULES.find((m) => m.id === 'capsaicina')!.smiles;

export function StudioScreen({ initialSmiles }: { initialSmiles?: string }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const [text, setText] = useState(initialSmiles || DEFAULT);
  const [formula, setFormula] = useState<FormulaKind>('skeletal');
  const [circles, setCircles] = useState(false);
  const [colored, setColored] = useState(false);
  const [look, setLook] = useState<MoleculeLook>('enem');
  const [marked, setMarked] = useState(false);
  const smiles = useDeferredValue(text.trim());
  const scroll = useRef<ScrollViewInstance>(null);
  const column = Math.min(width, COLUMN) - GUTTER * 2;

  useEffect(() => {
    if (initialSmiles) setText(initialSmiles);
  }, [initialSmiles]);

  const parsed = useMemo(() => {
    if (!smiles) return { error: 'Digite um SMILES para desenhar.' } as const;
    try {
      return { mol: moleculeFromSmiles(smiles) } as const;
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) } as const;
    }
  }, [smiles]);
  const ok = 'mol' in parsed;

  const entry = MOLECULES.find((m) => m.smiles === smiles);
  const annotations = useMemo(() => (marked && ok ? groupAnnotations(smiles) : undefined), [marked, ok, smiles]);

  const open = (next: string) => {
    setText(next);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  const share = async () => {
    const svg = renderSVG(smiles, {
      formula,
      aromaticCircles: circles,
      conventions: look === 'enem' ? 'enem' : 'textbook',
      style: { ...STYLES[look], ink: '#000000', palette: colored ? 'color' : 'mono' },
      annotations,
      caption: entry?.name,
      title: entry?.name,
      scale: look === 'textbook' ? 1 : 2,
    });
    try {
      await shareText(`${entry?.id ?? 'estrutura'}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`, 'image/svg+xml', 'Compartilhar estrutura');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível compartilhar o desenho.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bench }}>
      <BackBar title="Estruturas" />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Txt tone="muted">Escreva um SMILES e veja a molécula desenhada como num livro impresso.</Txt>

          <Field
            label="SMILES"
            mono
            value={text}
            onChangeText={setText}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            invalid={!ok}
          />

          <Paper style={styles.paper}>
            {ok ? (
              <MoleculeView
                key={`${smiles}-${formula}-${look}`}
                smiles={smiles}
                formula={formula}
                size={look === 'acs' ? 30 : 42}
                look={look}
                aromaticCircles={circles}
                colored={colored}
                annotations={annotations}
                caption={entry?.name}
                animate
                title={entry?.name}
                maxWidth={column - 32}
              />
            ) : (
              <Txt style={{ color: '#c2302a', textAlign: 'center' }} accessibilityLiveRegion="polite">
                {parsed.error}
              </Txt>
            )}
          </Paper>

          <Segmented label="Tipo de fórmula" options={FORMULAS} value={formula} onChange={setFormula} columns={column >= 480 ? 4 : 2} />
          <Segmented label="Estilo do desenho" options={LOOKS} value={look} onChange={setLook} />
          <View style={styles.toggles}>
            <Toggle value={marked} onChange={setMarked} label="Marcar funções orgânicas" />
            <Toggle value={circles} onChange={setCircles} label="Anel aromático com círculo" />
            <Toggle value={colored} onChange={setColored} label="Heteroátomos coloridos" />
          </View>
          <View style={styles.actions}>
            <Btn
              kind="tutor"
              label="Perguntar ao tutor"
              disabled={!ok}
              icon={(color) => <TutorIcon color={color} width={20} height={20} />}
              onPress={() =>
                ask({
                  text: `Me explica esta estrutura${entry ? ` (${entry.name})` : ''}: funções, cadeia e o que o ENEM costuma perguntar sobre ela.`,
                  screen: { kind: 'molecule', smiles, name: entry?.name },
                  about: `Estrutura: ${entry?.name ?? smiles}`,
                  open: true,
                })
              }
            />
            <Btn
              label="Salvar no mapa"
              disabled={!ok}
              icon={(color) => <PinIcon color={color} width={20} height={20} />}
              onPress={() => saveToMap({ kind: 'molecule', title: entry?.name ?? subscript(moleculeFromSmiles(smiles).formula()), smiles, text: entry?.note ?? '' })}
            />
            <Btn label="Compartilhar SVG" disabled={!ok} icon={(color) => <DownloadIcon color={color} width={20} height={20} />} onPress={share} />
          </View>

          {ok && <Analysis smiles={smiles} />}
          {ok && <ReactionLab key={smiles} smiles={smiles} onOpen={open} />}

          <Gallery current={smiles} onOpen={open} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 48 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center', gap: 18 },
  paper: { minHeight: 260, alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16 },
  toggles: { gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
