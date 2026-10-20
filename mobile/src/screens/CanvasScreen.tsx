/**
 * The concept map (src/app/screens/CanvasScreen.tsx): an infinite canvas. One finger on the
 * bench pans, two fingers zoom, a card follows the finger that drags it, a selected card's
 * dot dragged onto another card links them, and two taps write a note. Several maps and undo.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_WIDTH,
  type MapNode,
  type NodeColor,
  type Point,
  type Rect,
  type View as MapView,
  addEdge,
  currentMap,
  duplicateNodes,
  edgeLine,
  edgesOf,
  estimateHeight,
  fitView,
  freeSpot,
  moveNodes,
  nodesOf,
  removeEdges,
  removeNodes,
  setView,
  toScreen,
  toWorld,
  updateEdge,
  updateNode,
  zoomAt,
} from '../../../src/study/canvas.ts';
import {
  type NodeDraft,
  canvasStore,
  editCanvas,
  makeNode,
  redoCanvas,
  tweakCanvas,
  undoCanvas,
  useCanvas,
  useCanvasHistory,
  viewport,
} from '../../../src/app/canvas-store.ts';
import { uid } from '../../../src/app/persist.ts';
import { ask } from '../../../src/app/tutor-store.ts';
import { Edges, distToSegment } from '../canvas/Edges.tsx';
import { BAND, NodeCard, handleOf } from '../canvas/NodeCard.tsx';
import { EditSheet, MapsSheet, MoleculeSheet, TheorySheet, TutorMapSheet } from '../canvas/sheets.tsx';
import { haptic } from '../lib/haptics.ts';
import { FONT, type Palette, useTheme } from '../theme.ts';
import { TopBar } from '../ui/Bars.tsx';
import {
  ChainIcon,
  CopyIcon,
  EditIcon,
  FitIcon,
  type IconProps,
  MinusIcon,
  NoteIcon,
  PathIcon,
  PlusIcon,
  TrashIcon,
  TutorIcon,
  UndoIcon,
} from '../ui/Icons.tsx';
import { Btn, Press, Txt } from '../ui/kit.tsx';

const COLORS: NodeColor[] = ['paper', 'magenta', 'cobalt', 'green', 'amber'];
const COLOR_LABEL: Record<NodeColor, string> = { paper: 'Papel', magenta: 'Magenta', cobalt: 'Azul', green: 'Verde', amber: 'Âmbar' };
const KIND_NAME: Record<MapNode['kind'], string> = { note: 'nota', molecule: 'estrutura', theory: 'teoria', tutor: 'resposta do tutor', question: 'questão' };

/** The gesture in progress, kept in a ref so the end of a drag sees its latest offset. */
type Drag =
  | { mode: 'pan'; view0: MapView; t0: Point }
  | { mode: 'move'; ids: string[]; dx: number; dy: number }
  | { mode: 'connect'; from: string; to: Point }
  | { mode: 'none' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function CanvasScreen() {
  const c = useTheme();
  const canvas = useCanvas();
  const map = currentMap(canvas);
  const nodes = useMemo(() => nodesOf(canvas), [canvas]);
  const edges = useMemo(() => edgesOf(canvas), [canvas]);
  const history = useCanvasHistory();

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setViewState] = useState<MapView>(map.view);
  const viewRef = useRef(view);
  viewRef.current = view;

  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const [pending, setPending] = useState<{ from: string; to: Point } | null>(null);
  const [dialog, setDialog] = useState<'molecule' | 'theory' | 'tutor' | 'maps' | null>(null);

  // A map shows its own saved view, or fits its cards, once the canvas knows its size.
  useEffect(() => {
    if (!size) return;
    const own = nodesOf(canvasStore.get(), map.id);
    const fresh = map.view.x === 0 && map.view.y === 0 && map.view.zoom === 1;
    const pad = Math.min(56, size.w * 0.06);
    setViewState(fresh && own.length ? fitView(own, size, pad) : fresh ? { x: size.w / 2 - 120, y: size.h / 3 - 60, zoom: 1 } : map.view);
    setSelected([]);
    setSelectedEdge(null);
    setEditing(null);
  }, [map.id, !!size]);

  // The view is saved a moment after it stops moving, not on every frame.
  useEffect(() => {
    const t = setTimeout(() => tweakCanvas((cv) => setView(cv, map.id, view)), 350);
    return () => clearTimeout(t);
  }, [view, map.id]);

  // Cards grow with their content; their measured height keeps arrows on their borders.
  const heights = useRef<Record<string, number>>({});
  const flushHeights = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMeasure = useCallback((id: string, h: number) => {
    heights.current[id] = h;
    if (flushHeights.current) return;
    flushHeights.current = setTimeout(() => {
      flushHeights.current = null;
      const all = heights.current;
      heights.current = {};
      tweakCanvas((cv) => {
        let next = cv;
        for (const [nid, nh] of Object.entries(all)) if (next.nodes[nid] && Math.abs(next.nodes[nid].h - nh) > 1) next = updateNode(next, nid, { h: nh });
        return next;
      });
    }, 0);
  }, []);

  const rects = useMemo(() => {
    const out: Record<string, Rect> = {};
    for (const n of nodes) {
      const moving = drag?.ids.includes(n.id);
      out[n.id] = { x: n.x + (moving ? drag!.dx : 0), y: n.y + (moving ? drag!.dy : 0), w: n.w, h: n.h };
    }
    return out;
  }, [nodes, drag]);

  // ---- hit testing (the canvas takes every touch; cards only draw) ----

  const world = (p: Point) => toWorld(viewRef.current, p);
  const nodeAt = (p: Point): MapNode | undefined => {
    const w = world(p);
    const all = nodesOf(canvasStore.get());
    for (let i = all.length - 1; i >= 0; i--) {
      const n = all[i];
      if (w.x >= n.x && w.x <= n.x + n.w && w.y >= n.y && w.y <= n.y + n.h) return n;
    }
    return undefined;
  };
  const edgeAt = (p: Point): string | undefined => {
    const cv = canvasStore.get();
    let best: { id: string; d: number } | undefined;
    for (const e of edgesOf(cv)) {
      const a = cv.nodes[e.from];
      const b = cv.nodes[e.to];
      if (!a || !b) continue;
      const line = edgeLine(a, b, 8);
      if (!line) continue;
      const d = distToSegment(p, toScreen(viewRef.current, line.from), toScreen(viewRef.current, line.to));
      if (d < 16 && (!best || d < best.d)) best = { id: e.id, d };
    }
    return best?.id;
  };

  // ---- actions ----

  /** A card where it was asked for (two taps), or in the free space nearest the middle of the view. */
  const addNode = useCallback(
    (draft: NodeDraft, at?: Point, edit = false) => {
      const sz = { w: NODE_WIDTH[draft.kind], h: estimateHeight(draft.kind, draft.title, draft.text ?? '', !!draft.smiles) };
      const spot = at
        ? { x: Math.round(at.x - sz.w / 2), y: Math.round(at.y - 24) }
        : freeSpot(nodesOf(canvasStore.get(), map.id), sz, toWorld(viewRef.current, { x: viewport.w / 2, y: viewport.h / 2 }));
      const node = makeNode(draft, spot, map.id);
      editCanvas((cv) => ({ ...cv, nodes: { ...cv.nodes, [node.id]: node } }));
      setSelected([node.id]);
      setSelectedEdge(null);
      if (edit) setEditing(node.id);
      return node.id;
    },
    [map.id],
  );

  const removeSelection = () => {
    if (selected.length) editCanvas((cv) => removeNodes(cv, selected));
    else if (selectedEdge) editCanvas((cv) => removeEdges(cv, [selectedEdge]));
    setSelected([]);
    setSelectedEdge(null);
  };

  const duplicate = () => {
    if (!selected.length) return;
    let ids: string[] = [];
    editCanvas((cv) => {
      const r = duplicateNodes(cv, selected, () => uid('n'));
      ids = r.ids;
      return r.canvas;
    });
    setSelected(ids);
  };

  const fit = () => {
    if (!size) return;
    const pad = Math.min(56, size.w * 0.06);
    setViewState(nodes.length ? fitView(nodes, size, pad) : { ...viewRef.current, zoom: 1 });
  };
  const zoomBy = (f: number) => size && setViewState((v) => zoomAt(v, f, { x: size.w / 2, y: size.h / 2 }));

  const askAbout = (n: MapNode, expand: boolean) =>
    ask({
      text: expand
        ? `Expanda o cartão “${n.title || 'sem título'}” no meu mapa: crie cartões com os conceitos ligados a ele.`
        : `Me explica melhor o cartão “${n.title || 'sem título'}”.`,
      about: `Cartão do mapa: ${n.title || KIND_NAME[n.kind]}`,
      screen: { kind: 'map-card', title: n.title, text: n.text, smiles: n.smiles, nodeId: n.id },
      open: true,
    });

  // ---- gestures ----
  // The handlers read the latest state through this ref, so the gesture objects never change.

  const g = useRef<Drag>({ mode: 'none' });
  const pinch = useRef<{ world: Point; zoom0: number } | null>(null);
  const lastT = useRef<Point>({ x: 0, y: 0 });
  const lastTap = useRef<{ t: number; p: Point; node?: string } | null>(null);
  const live = useRef({ selected, editing, nodeAt, edgeAt, addNode, world });
  live.current = { selected, editing, nodeAt, edgeAt, addNode, world };

  const handlers = useRef({
    panStart(start: Point, t: Point) {
      lastT.current = t;
      if (pinch.current) return;
      const { selected: sel, nodeAt: at } = live.current;
      // A selected card's dot starts a link.
      if (sel.length === 1) {
        const n = canvasStore.get().nodes[sel[0]];
        if (n && dist(toScreen(viewRef.current, handleOf(n)), start) < 26) {
          g.current = { mode: 'connect', from: n.id, to: live.current.world(start) };
          setPending({ from: n.id, to: live.current.world(start) });
          haptic('tap');
          return;
        }
      }
      const hit = at(start);
      if (hit) {
        const ids = sel.includes(hit.id) ? sel : [hit.id];
        if (!sel.includes(hit.id)) setSelected(ids);
        setSelectedEdge(null);
        g.current = { mode: 'move', ids, dx: 0, dy: 0 };
        return;
      }
      g.current = { mode: 'pan', view0: viewRef.current, t0: { x: 0, y: 0 } };
    },
    panMove(p: Point, t: Point) {
      lastT.current = t;
      const d = g.current;
      if (pinch.current) return;
      if (d.mode === 'pan') {
        setViewState({ ...d.view0, x: d.view0.x + t.x - d.t0.x, y: d.view0.y + t.y - d.t0.y });
      } else if (d.mode === 'move') {
        const z = viewRef.current.zoom;
        d.dx = t.x / z;
        d.dy = t.y / z;
        setDrag({ ids: d.ids, dx: d.dx, dy: d.dy });
      } else if (d.mode === 'connect') {
        d.to = live.current.world(p);
        setPending({ from: d.from, to: d.to });
      }
    },
    panEnd(p: Point, canceled: boolean) {
      const d = g.current;
      g.current = { mode: 'none' };
      if (d.mode === 'move') {
        if (!canceled && (d.dx || d.dy)) editCanvas((cv) => moveNodes(cv, d.ids, Math.round(d.dx), Math.round(d.dy)));
        setDrag(null);
      } else if (d.mode === 'connect') {
        setPending(null);
        const target = canceled ? undefined : live.current.nodeAt(p);
        if (target && target.id !== d.from) {
          const id = uid('e');
          editCanvas((cv) => addEdge(cv, { id, map: canvasStore.get().current, from: d.from, to: target.id, label: '' }));
          setSelected([]);
          setSelectedEdge(id);
          haptic('success');
        }
      }
    },
    pinchStart(focal: Point) {
      // Two fingers take over from one: a card being dragged stays where it was.
      if (g.current.mode === 'move') setDrag(null);
      if (g.current.mode === 'connect') setPending(null);
      g.current = { mode: 'none' };
      pinch.current = { world: toWorld(viewRef.current, focal), zoom0: viewRef.current.zoom };
    },
    pinchMove(focal: Point, scale: number) {
      const s = pinch.current;
      if (!s) return;
      const zoom = clamp(s.zoom0 * scale, MIN_ZOOM, MAX_ZOOM);
      setViewState({ zoom, x: focal.x - s.world.x * zoom, y: focal.y - s.world.y * zoom });
    },
    pinchEnd() {
      pinch.current = null;
      // The finger left on the glass keeps panning from here, without a jump.
      g.current = { mode: 'pan', view0: viewRef.current, t0: lastT.current };
    },
    tap(p: Point) {
      const { nodeAt: at, edgeAt: edgeHit, addNode: add, world: w } = live.current;
      const hit = at(p);
      const now = Date.now();
      const prev = lastTap.current;
      const twice = !!prev && now - prev.t < 340 && dist(prev.p, p) < 28 && prev.node === hit?.id;
      lastTap.current = twice ? null : { t: now, p, node: hit?.id };
      if (hit) {
        setSelected([hit.id]);
        setSelectedEdge(null);
        if (twice && hit.kind !== 'theory') {
          haptic('tap');
          setEditing(hit.id);
        }
        return;
      }
      const edge = edgeHit(p);
      if (edge) {
        setSelectedEdge(edge);
        setSelected([]);
        return;
      }
      setSelected([]);
      setSelectedEdge(null);
      if (twice) {
        haptic('tap');
        add({ kind: 'note', title: '' }, w(p), true);
      }
    },
  }).current;

  const panGesture = usePanGesture(
    useMemo(
      () => ({
        disableReanimated: true,
        minDistance: 6,
        onActivate: (e: { x: number; y: number; translationX: number; translationY: number }) =>
          handlers.panStart({ x: e.x - e.translationX, y: e.y - e.translationY }, { x: e.translationX, y: e.translationY }),
        onUpdate: (e: { x: number; y: number; translationX: number; translationY: number }) =>
          handlers.panMove({ x: e.x, y: e.y }, { x: e.translationX, y: e.translationY }),
        onDeactivate: (e: { x: number; y: number; canceled: boolean }) => handlers.panEnd({ x: e.x, y: e.y }, e.canceled),
      }),
      [handlers],
    ),
  );
  const pinchGesture = usePinchGesture(
    useMemo(
      () => ({
        disableReanimated: true,
        onActivate: (e: { focalX: number; focalY: number }) => handlers.pinchStart({ x: e.focalX, y: e.focalY }),
        onUpdate: (e: { focalX: number; focalY: number; scale: number }) => handlers.pinchMove({ x: e.focalX, y: e.focalY }, e.scale),
        onDeactivate: () => handlers.pinchEnd(),
      }),
      [handlers],
    ),
  );
  const tapGesture = useTapGesture(
    useMemo(() => ({ disableReanimated: true, maxDistance: 10, onActivate: (e: { x: number; y: number }) => handlers.tap({ x: e.x, y: e.y }) }), [handlers]),
  );
  const gestures = useSimultaneousGestures(panGesture, pinchGesture, tapGesture);

  const single = selected.length === 1 ? canvas.nodes[selected[0]] : undefined;
  const edge = selectedEdge ? canvas.edges[selectedEdge] : undefined;
  const editNode = editing ? canvas.nodes[editing] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: c.bench }}>
      <TopBar />
      <View style={{ flex: 1 }}>
        <GestureDetector gesture={gestures}>
          <View
            style={[styles.surface, { backgroundColor: c.bench }]}
            collapsable={false}
            accessibilityLabel={`Mapa de conceitos “${map.name}”, ${nodes.length} cartões`}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              viewport.w = width;
              viewport.h = height;
              setSize({ w: width, h: height });
            }}
          >
            {size && (
              <Edges
                view={view}
                size={size}
                rects={rects}
                edges={edges}
                selected={selectedEdge ?? undefined}
                pending={pending && rects[pending.from] ? { from: rects[pending.from], to: pending.to } : undefined}
                c={c}
              />
            )}
            <View
              pointerEvents="none"
              style={[styles.world, { transformOrigin: 'left top', transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.zoom }] }]}
            >
              {nodes.map((n) => (
                <NodeCard
                  key={n.id}
                  node={n}
                  selected={selected.includes(n.id)}
                  dx={drag?.ids.includes(n.id) ? drag.dx : 0}
                  dy={drag?.ids.includes(n.id) ? drag.dy : 0}
                  onMeasure={onMeasure}
                />
              ))}
            </View>
          </View>
        </GestureDetector>

        {nodes.length === 0 && (
          <View style={styles.emptyWrap} pointerEvents="box-none">
            <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.rule }]}>
              <Txt variant="title">{map.name}</Txt>
              <Txt tone="muted">
                Um quadro infinito para ligar o que você aprende. Salve aqui cartões de teoria, estruturas, respostas do tutor e questões que errou, e ligue um
                conceito ao outro com setas.
              </Txt>
              <View style={styles.emptyActions}>
                <Btn
                  kind="primary"
                  label="Nova nota"
                  icon={(col) => <NoteIcon color={col} width={20} height={20} />}
                  onPress={() => addNode({ kind: 'note', title: '' }, undefined, true)}
                />
                <Btn
                  kind="tutor"
                  label="Montar com o tutor"
                  icon={(col) => <TutorIcon color={col} width={20} height={20} />}
                  onPress={() => setDialog('tutor')}
                />
                <Btn label="Teoria da trilha" icon={(col) => <PathIcon color={col} width={20} height={20} />} onPress={() => setDialog('theory')} />
              </View>
              <Txt variant="small" tone="muted">
                Dica: toque duas vezes em qualquer lugar para criar uma nota. Dois dedos aproximam e afastam.
              </Txt>
            </View>
          </View>
        )}

        {/* Maps and what to add, along the top. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.toolsScroll}
          contentContainerStyle={styles.tools}
          keyboardShouldPersistTaps="handled"
        >
          <Press
            onPress={() => setDialog('maps')}
            accessibilityRole="button"
            accessibilityLabel={`Mapa: ${map.name}. Trocar de mapa`}
            style={[styles.mapSwitch, bar(c)]}
          >
            <Text style={[styles.mapName, { color: c.text }]} numberOfLines={1}>
              {map.name}
            </Text>
            <Text style={[styles.mapCount, { color: c.muted }]}>{canvas.maps.length > 1 ? `${canvas.maps.length} mapas` : 'mapas'}</Text>
          </Press>
          <View style={[styles.toolGroup, bar(c)]}>
            <Tool c={c} icon={NoteIcon} label="Nota" onPress={() => addNode({ kind: 'note', title: '' }, undefined, true)} />
            <Tool c={c} icon={ChainIcon} label="Estrutura" onPress={() => setDialog('molecule')} />
            <Tool c={c} icon={PathIcon} label="Teoria" onPress={() => setDialog('theory')} />
            <Tool c={c} icon={TutorIcon} label="Tutor" tutor onPress={() => setDialog('tutor')} />
          </View>
        </ScrollView>

        <View style={styles.bottom} pointerEvents="box-none">
          {(single || selected.length > 1 || edge) && (
            <View style={[styles.selectionWrap, bar(c)]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selection} keyboardShouldPersistTaps="handled">
                {edge ? (
                  <>
                    <TextInput
                      value={edge.label}
                      autoFocus={!edge.label}
                      placeholder="Rótulo da seta: é um, + HBr…"
                      placeholderTextColor={c.muted}
                      accessibilityLabel="Rótulo da seta"
                      onChangeText={(v) => tweakCanvas((cv) => updateEdge(cv, edge.id, { label: v }))}
                      onSubmitEditing={() => setSelectedEdge(null)}
                      style={[styles.edgeInput, { color: c.text, borderColor: c.rule, backgroundColor: c.bench }]}
                    />
                    <Tool
                      c={c}
                      label="Inverter o sentido"
                      text="⇄"
                      onPress={() => editCanvas((cv) => ({ ...cv, edges: { ...cv.edges, [edge.id]: { ...edge, from: edge.to, to: edge.from } } }))}
                    />
                    <Tool c={c} icon={TrashIcon} label="Apagar a seta" danger onPress={removeSelection} />
                  </>
                ) : (
                  <>
                    {COLORS.map((col) => {
                      const on = selected.every((id) => canvas.nodes[id]?.color === col);
                      return (
                        <Press
                          key={col}
                          onPress={() => editCanvas((cv) => selected.reduce((acc, id) => updateNode(acc, id, { color: col }), cv))}
                          accessibilityRole="button"
                          accessibilityLabel={`Cor: ${COLOR_LABEL[col]}`}
                          accessibilityState={{ selected: on }}
                          hitSlop={4}
                          style={[styles.dotRing, on && { borderColor: c.text }]}
                        >
                          <View style={[styles.dot, { backgroundColor: BAND[col] ?? '#ffffff', borderColor: BAND[col] ?? c.rule }]} />
                        </Press>
                      );
                    })}
                    <View style={[styles.sep, { backgroundColor: c.rule }]} />
                    {single && single.kind !== 'theory' && <Tool c={c} icon={EditIcon} label="Editar" onPress={() => setEditing(single.id)} />}
                    {single && (
                      <>
                        <Tool c={c} icon={TutorIcon} label="Perguntar" tutor onPress={() => askAbout(single, false)} />
                        <Tool c={c} icon={PlusIcon} label="Expandir" tutor onPress={() => askAbout(single, true)} />
                      </>
                    )}
                    <Tool c={c} icon={CopyIcon} label="Duplicar" iconOnly onPress={duplicate} />
                    <Tool c={c} icon={TrashIcon} label="Apagar" iconOnly danger onPress={removeSelection} />
                  </>
                )}
              </ScrollView>
            </View>
          )}
          <View style={[styles.zoom, bar(c)]}>
            <Tool c={c} icon={UndoIcon} label="Desfazer" iconOnly disabled={!history.undo} onPress={undoCanvas} />
            <Tool c={c} icon={UndoIcon} label="Refazer" iconOnly mirror disabled={!history.redo} onPress={redoCanvas} />
            <View style={[styles.sep, { backgroundColor: c.rule }]} />
            <Tool c={c} icon={MinusIcon} label="Afastar" iconOnly onPress={() => zoomBy(1 / 1.25)} />
            <Tool
              c={c}
              label="Voltar a 100%"
              text={`${Math.round(view.zoom * 100)}%`}
              onPress={() => size && setViewState((v) => zoomAt(v, 1 / v.zoom, { x: size.w / 2, y: size.h / 2 }))}
            />
            <Tool c={c} icon={PlusIcon} label="Aproximar" iconOnly onPress={() => zoomBy(1.25)} />
            <Tool c={c} icon={FitIcon} label="Ver tudo" iconOnly onPress={fit} />
          </View>
        </View>
      </View>

      {dialog === 'molecule' && <MoleculeSheet onClose={() => setDialog(null)} onAdd={(smiles, name) => addNode({ kind: 'molecule', title: name, smiles })} />}
      {dialog === 'theory' && (
        <TheorySheet onClose={() => setDialog(null)} onAdd={(lessonId, index, title) => addNode({ kind: 'theory', title, lessonId, card: index })} />
      )}
      {dialog === 'tutor' && <TutorMapSheet onClose={() => setDialog(null)} />}
      {dialog === 'maps' && <MapsSheet onClose={() => setDialog(null)} />}
      {editNode && editNode.kind !== 'theory' && (
        <EditSheet
          key={editNode.id}
          node={editNode}
          onSave={(patch) => editCanvas((cv) => updateNode(cv, editNode.id, patch))}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

const bar = (c: Palette) => ({ backgroundColor: c.surface, borderColor: c.rule });

/** A toolbar button: icon with a label, icon only, or a short text. */
function Tool({
  c,
  icon: Icon,
  label,
  text,
  onPress,
  disabled,
  iconOnly,
  tutor,
  danger,
  mirror,
}: {
  c: Palette;
  icon?: (p: IconProps) => ReactNode;
  label: string;
  text?: string;
  onPress: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
  tutor?: boolean;
  danger?: boolean;
  mirror?: boolean;
}) {
  const color = disabled ? c.rule : danger ? c.wrong : tutor ? c.cobalt : c.text;
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={[styles.tool, !iconOnly && !text && styles.toolLabelled]}
    >
      {Icon ? (
        <View style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
          <Icon color={color} width={20} height={20} />
        </View>
      ) : null}
      {text ? <Text style={[styles.toolText, { color }]}>{text}</Text> : null}
      {!iconOnly && !text ? <Text style={[styles.toolText, { color }]}>{label}</Text> : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  surface: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  world: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible' },
  toolsScroll: { position: 'absolute', top: 8, left: 0, right: 0, flexGrow: 0 },
  tools: { paddingHorizontal: 10, gap: 8, alignItems: 'center' },
  mapSwitch: { maxWidth: 170, minHeight: 48, justifyContent: 'center', paddingVertical: 2, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2 },
  toolGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingVertical: 2, borderRadius: 16, borderWidth: 2 },
  mapName: { fontFamily: FONT.uiBold, fontSize: 14.5 },
  mapCount: { fontFamily: FONT.ui, fontSize: 12 },
  tool: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toolLabelled: { paddingHorizontal: 10 },
  toolText: { fontFamily: FONT.uiBold, fontSize: 14.5 },
  bottom: { position: 'absolute', left: 10, right: 10, bottom: 10, alignItems: 'flex-end', gap: 8 },
  // Wider than a small phone: it scrolls sideways inside its bar instead of running off the edge.
  selectionWrap: { maxWidth: '100%', borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  zoom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 16, borderWidth: 2 },
  sep: { width: 2, height: 24, marginHorizontal: 4, borderRadius: 1 },
  dotRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  edgeInput: { width: 220, height: 40, borderWidth: 2, borderRadius: 10, paddingHorizontal: 10, fontFamily: FONT.ui, fontSize: 15 },
  emptyWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 16 },
  empty: { maxWidth: 440, gap: 12, padding: 18, borderRadius: 18, borderWidth: 2 },
  emptyActions: { gap: 8, alignItems: 'flex-start' },
});
