/**
 * The concept map: an infinite canvas. Drag the background (or two fingers) to pan, wheel or
 * pinch to zoom, drag cards to move them, drag a selected card's dot onto another card to link
 * them, double-click to write. Several maps, undo and a minimap.
 */
import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LESSONS } from '../../course/course.ts';
import { THEORY } from '../../course/theory/index.ts';
import { MOLECULES } from '../../content/molecules.ts';
import { moleculeFromSmiles } from '../../nanquim/index.ts';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_WIDTH,
  type MapNode,
  type NodeColor,
  type Point,
  type Rect,
  type View,
  addEdge,
  addMap,
  bounds,
  currentMap,
  duplicateNodes,
  edgesOf,
  estimateHeight,
  fitView,
  freeSpot,
  intersects,
  moveNodes,
  nodesOf,
  removeEdges,
  removeMap,
  removeNodes,
  renameMap,
  setView,
  spanRect,
  toWorld,
  updateEdge,
  updateNode,
  zoomAt,
} from '../../study/canvas.ts';
import { type NodeDraft, canvasStore, editCanvas, makeNode, redoCanvas, tweakCanvas, undoCanvas, useCanvas, useCanvasHistory, viewport } from '../canvas-store.ts';
import { Edges } from '../components/canvas/Edges.tsx';
import { NodeView } from '../components/canvas/NodeView.tsx';
import {
  ChainIcon,
  CloseIcon,
  CopyIcon,
  EditIcon,
  FitIcon,
  MinusIcon,
  NoteIcon,
  PathIcon,
  PlusIcon,
  TrashIcon,
  TutorIcon,
  UndoIcon,
} from '../components/Icons.tsx';
import { MoleculeView } from '../components/MoleculeView.tsx';
import { typingIn } from '../hooks.ts';
import { uid } from '../persist.ts';
import { ask } from '../tutor-store.ts';

const COLORS: NodeColor[] = ['paper', 'magenta', 'cobalt', 'green', 'amber'];
const COLOR_LABEL: Record<NodeColor, string> = { paper: 'Papel', magenta: 'Magenta', cobalt: 'Azul', green: 'Verde', amber: 'Âmbar' };

/** The gesture in progress, kept in a ref so pointer-up sees the latest offset even before React re-renders. */
type Gesture =
  | { mode: 'pan'; start: Point; view0: View; moved: boolean }
  | { mode: 'move'; start: Point; ids: string[]; moved: boolean; dx: number; dy: number }
  | { mode: 'marquee'; start: Point; end: Point }
  | { mode: 'connect'; from: string }
  | { mode: 'pinch'; d0: number; world: Point; zoom0: number };

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function CanvasScreen() {
  const canvas = useCanvas();
  const map = currentMap(canvas);
  const nodes = useMemo(() => nodesOf(canvas), [canvas]);
  const edges = useMemo(() => edgesOf(canvas), [canvas]);
  const nodeIds = nodes.map((n) => n.id).join(' ');
  const history = useCanvasHistory();

  const surface = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View>(map.view);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [size, setSize] = useState({ w: viewport.w, h: viewport.h });

  const [selected, setSelected] = useState<string[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  const [pending, setPending] = useState<{ from: string; to: Point } | null>(null);
  const [dialog, setDialog] = useState<'molecule' | 'theory' | 'tutor' | 'maps' | null>(null);

  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());

  // A new map shows its own saved view, or fits its cards.
  useEffect(() => {
    const own = nodesOf(canvas, map.id);
    const fresh = map.view.x === 0 && map.view.y === 0 && map.view.zoom === 1;
    setViewState(fresh && own.length ? fitView(own, viewport) : fresh ? { x: viewport.w / 2 - 200, y: viewport.h / 2 - 120, zoom: 1 } : map.view);
    setSelected([]);
    setSelectedEdge(null);
    setEditing(null);
  }, [map.id]);

  // The view is saved a moment after it stops moving, not on every frame.
  useEffect(() => {
    const t = setTimeout(() => tweakCanvas((c) => setView(c, map.id, view)), 350);
    return () => clearTimeout(t);
  }, [view, map.id]);

  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      viewport.w = width;
      viewport.h = height;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cards grow with their content; their measured height keeps arrows on their borders.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const heights: Record<string, number> = {};
      for (const entry of entries) {
        const t = entry.target as HTMLElement;
        if (t.dataset.node) heights[t.dataset.node] = t.offsetHeight;
      }
      tweakCanvas((cv) => {
        let next = cv;
        for (const [id, h] of Object.entries(heights)) if (next.nodes[id] && Math.abs(next.nodes[id].h - h) > 1) next = updateNode(next, id, { h });
        return next;
      });
    });
    for (const n of el.querySelectorAll<HTMLElement>('[data-node]')) ro.observe(n);
    return () => ro.disconnect();
  }, [nodeIds]);

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = surface.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (p: Point) => toWorld(viewRef.current, p);

  const rects = useMemo(() => {
    const out: Record<string, Rect> = {};
    for (const n of nodes) {
      const moving = drag?.ids.includes(n.id);
      out[n.id] = { x: n.x + (moving ? drag!.dx : 0), y: n.y + (moving ? drag!.dy : 0), w: n.w, h: n.h };
    }
    return out;
  }, [nodes, drag]);

  // ---- gestures ----

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const t = e.target as HTMLElement;
    if (t.closest('.node-editor')) return;
    // No text selection or native image drag while working the canvas.
    if (e.pointerType === 'mouse') e.preventDefault();
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: 'pinch', d0: dist(a, b), world: world(mid(a, b)), zoom0: viewRef.current.zoom };
      setDrag(null);
      setMarquee(null);
      setPending(null);
      return;
    }
    const handle = t.closest<HTMLElement>('[data-handle]');
    const nodeEl = t.closest<HTMLElement>('[data-node]');
    const edgeEl = t.closest<SVGElement>('[data-edge]');
    if (e.button === 1) {
      gesture.current = { mode: 'pan', start: p, view0: viewRef.current, moved: true };
      return;
    }
    if (handle) {
      gesture.current = { mode: 'connect', from: handle.dataset.handle! };
      setPending({ from: handle.dataset.handle!, to: world(p) });
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.node!;
      if (editing === id) return;
      if (editing) setEditing(null);
      setSelectedEdge(null);
      let ids = selected;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        ids = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
        setSelected(ids);
      } else if (!selected.includes(id)) {
        ids = [id];
        setSelected(ids);
      }
      gesture.current = { mode: 'move', start: p, ids: ids.includes(id) ? ids : [id], moved: false, dx: 0, dy: 0 };
      return;
    }
    if (edgeEl) {
      setSelectedEdge(edgeEl.dataset.edge!);
      setSelected([]);
      setEditing(null);
      gesture.current = null;
      return;
    }
    if (e.shiftKey && e.pointerType === 'mouse') {
      gesture.current = { mode: 'marquee', start: p, end: p };
      setMarquee({ a: p, b: p });
      return;
    }
    gesture.current = { mode: 'pan', start: p, view0: viewRef.current, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    switch (g.mode) {
      case 'pinch': {
        const pts = [...pointers.current.values()];
        if (pts.length < 2) return;
        const m = mid(pts[0], pts[1]);
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.zoom0 * dist(pts[0], pts[1])) / g.d0));
        setViewState({ zoom, x: m.x - g.world.x * zoom, y: m.y - g.world.y * zoom });
        return;
      }
      case 'pan': {
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) < 3) return;
        g.moved = true;
        setViewState({ ...g.view0, x: g.view0.x + dx, y: g.view0.y + dy });
        return;
      }
      case 'move': {
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) < 4) return;
        g.moved = true;
        const z = viewRef.current.zoom;
        g.dx = dx / z;
        g.dy = dy / z;
        setDrag({ ids: g.ids, dx: g.dx, dy: g.dy });
        return;
      }
      case 'marquee':
        g.end = p;
        setMarquee({ a: g.start, b: p });
        return;
      case 'connect':
        setPending({ from: g.from, to: world(p) });
        return;
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>, cancel = false) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (cancel) {
      setDrag(null);
      setMarquee(null);
      setPending(null);
      return;
    }
    if (g.mode === 'pan' && !g.moved) {
      setSelected([]);
      setSelectedEdge(null);
      setEditing(null);
    }
    if (g.mode === 'move') {
      if (g.moved) editCanvas((c) => moveNodes(c, g.ids, Math.round(g.dx), Math.round(g.dy)));
      setDrag(null);
    }
    if (g.mode === 'marquee') {
      const area = spanRect(world(g.start), world(g.end));
      setSelected(nodes.filter((n) => intersects(n, area)).map((n) => n.id));
      setMarquee(null);
    }
    if (g.mode === 'connect') {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-node]')?.dataset.node;
      setPending(null);
      if (target && target !== g.from) {
        const id = uid('e');
        editCanvas((c) => addEdge(c, { id, map: map.id, from: g.from, to: target, label: '' }));
        setSelected([]);
        setSelectedEdge(id);
      }
    }
  };

  // Wheel pans; Ctrl/⌘ + wheel (and trackpad pinch) zooms around the pointer.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.node-editor textarea')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      // Wheels report lines or big pixel steps, trackpads small ones: clamp so one notch is about 25%.
      const unit = e.deltaMode === 1 ? 16 : 1;
      if (e.ctrlKey || e.metaKey) {
        const d = Math.max(-28, Math.min(28, e.deltaY * unit));
        setViewState((v) => zoomAt(v, Math.exp(-d * 0.01), at));
      } else setViewState((v) => ({ ...v, x: v.x - e.deltaX * unit, y: v.y - e.deltaY * unit }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ---- actions ----

  /** A card where it was asked for (a double click), or in the free space nearest the middle of the view. */
  const addNode = useCallback(
    (draft: NodeDraft, at?: Point, edit = false) => {
      const size = { w: NODE_WIDTH[draft.kind], h: estimateHeight(draft.kind, draft.title, draft.text ?? '', !!draft.smiles) };
      const spot = at
        ? { x: Math.round(at.x - size.w / 2), y: Math.round(at.y - 24) }
        : freeSpot(nodesOf(canvasStore.get(), map.id), size, toWorld(viewRef.current, { x: viewport.w / 2, y: viewport.h / 2 }));
      const node = makeNode(draft, spot, map.id);
      editCanvas((cv) => ({ ...cv, nodes: { ...cv.nodes, [node.id]: node } }));
      setSelected([node.id]);
      setSelectedEdge(null);
      if (edit) setEditing(node.id);
      return node.id;
    },
    [map.id],
  );

  const removeSelection = useCallback(() => {
    if (selected.length) editCanvas((c) => removeNodes(c, selected));
    else if (selectedEdge) editCanvas((c) => removeEdges(c, [selectedEdge]));
    setSelected([]);
    setSelectedEdge(null);
    setEditing(null);
  }, [selected, selectedEdge]);

  const duplicate = useCallback(() => {
    if (!selected.length) return;
    let ids: string[] = [];
    editCanvas((c) => {
      const r = duplicateNodes(c, selected, () => uid('n'));
      ids = r.ids;
      return r.canvas;
    });
    setSelected(ids);
  }, [selected]);

  const fit = useCallback(() => {
    const pad = Math.min(56, viewport.w * 0.06);
    setViewState(nodes.length ? fitView(nodes, { w: viewport.w, h: viewport.h }, pad) : { ...viewRef.current, zoom: 1 });
  }, [nodes]);

  const zoomBy = (f: number) => setViewState((v) => zoomAt(v, f, { x: viewport.w / 2, y: viewport.h / 2 }));

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingIn(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoCanvas();
        else undoCanvas();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoCanvas();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(nodes.map((n) => n.id));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.length || selectedEdge) {
          e.preventDefault();
          removeSelection();
        }
      } else if (e.key === 'Escape') {
        setSelected([]);
        setSelectedEdge(null);
      } else if (e.key === 'Enter' && selected.length === 1) {
        e.preventDefault();
        setEditing(selected[0]);
      } else if (e.key.startsWith('Arrow') && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 40 : 8;
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key] ?? [0, 0];
        editCanvas((c) => moveNodes(c, selected, dx, dy));
      } else if (!mod && (e.key === '+' || e.key === '=')) zoomBy(1.2);
      else if (!mod && e.key === '-') zoomBy(1 / 1.2);
      else if (!mod && e.key === '0') fit();
      else if (!mod && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addNode({ kind: 'note', title: '' }, undefined, true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, selectedEdge, nodes, duplicate, removeSelection, fit, addNode]);

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('.node-editor')) return;
    const nodeEl = t.closest<HTMLElement>('[data-node]');
    if (nodeEl) {
      setEditing(nodeEl.dataset.node!);
      return;
    }
    if (t.closest('[data-edge]')) return;
    addNode({ kind: 'note', title: '' }, world(local(e)), true);
  };

  const onNodeFocus = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s : [id]));
    setSelectedEdge(null);
    // Focus scrolls the clipped surface to reveal the card; undo that and pan the view instead.
    const el = surface.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
    const n = canvasStore.get().nodes[id];
    if (!n) return;
    const v = viewRef.current;
    const a = { x: n.x * v.zoom + v.x, y: n.y * v.zoom + v.y };
    const b = { x: (n.x + n.w) * v.zoom + v.x, y: (n.y + n.h) * v.zoom + v.y };
    if (a.x < 0 || a.y < 0 || b.x > viewport.w || b.y > viewport.h) {
      setViewState({ ...v, x: viewport.w / 2 - (n.x + n.w / 2) * v.zoom, y: viewport.h / 2 - (n.y + n.h / 2) * v.zoom });
    }
  }, []);

  const single = selected.length === 1 ? canvas.nodes[selected[0]] : undefined;
  const edge = selectedEdge ? canvas.edges[selectedEdge] : undefined;
  const grid = 24 * view.zoom * (view.zoom < 0.5 ? 4 : 1);

  const askAbout = (n: MapNode, expand: boolean) =>
    ask({
      text: expand
        ? `Expanda o cartão “${n.title || 'sem título'}” no meu mapa: crie cartões com os conceitos ligados a ele.`
        : `Me explica melhor o cartão “${n.title || 'sem título'}”.`,
      about: `Cartão do mapa: ${n.title || KIND_NAME[n.kind]}`,
      screen: { kind: 'map-card', title: n.title, text: n.text, smiles: n.smiles, nodeId: n.id },
      open: true,
    });

  return (
    <div className="canvas">
      <div
        ref={surface}
        className={`canvas-surface${pending ? ' is-linking' : ''}`}
        style={{ '--grid': `${grid}px`, '--gx': `${view.x}px`, '--gy': `${view.y}px` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e)}
        onPointerCancel={(e) => onPointerUp(e, true)}
        onDoubleClick={onDoubleClick}
        role="application"
        aria-label={`Mapa de conceitos “${map.name}”, ${nodes.length} cartões`}
      >
        <div className="canvas-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <Edges rects={rects} edges={edges} selected={selectedEdge ?? undefined} pending={pending ? { from: rects[pending.from], to: pending.to } : undefined} />
          {nodes.map((n) => (
            <NodeView
              key={n.id}
              node={n}
              selected={selected.includes(n.id)}
              editing={editing === n.id}
              dx={drag?.ids.includes(n.id) ? drag.dx : 0}
              dy={drag?.ids.includes(n.id) ? drag.dy : 0}
              onSave={(patch) => editCanvas((c) => updateNode(c, n.id, patch))}
              onStopEditing={() => setEditing(null)}
              onFocus={onNodeFocus}
            />
          ))}
        </div>
        {marquee && (
          <div
            className="marquee"
            style={{
              left: Math.min(marquee.a.x, marquee.b.x),
              top: Math.min(marquee.a.y, marquee.b.y),
              width: Math.abs(marquee.a.x - marquee.b.x),
              height: Math.abs(marquee.a.y - marquee.b.y),
            }}
          />
        )}
      </div>

      {nodes.length === 0 && (
        <div className="canvas-empty">
          <h1>{map.name}</h1>
          <p>
            Um quadro infinito para ligar o que você aprende. Salve aqui cartões de teoria, estruturas, respostas do tutor e questões que
            errou, e ligue um conceito ao outro com setas.
          </p>
          <div className="canvas-empty-actions">
            <button type="button" className="btn btn--primary" onClick={() => addNode({ kind: 'note', title: '' }, undefined, true)}>
              <NoteIcon /> Nova nota
            </button>
            <button type="button" className="btn btn--tutor" onClick={() => setDialog('tutor')}>
              <TutorIcon /> Montar com o tutor
            </button>
            <button type="button" className="btn" onClick={() => setDialog('theory')}>
              <PathIcon /> Teoria da trilha
            </button>
          </div>
          <p className="canvas-empty-hint">Dica: dê dois cliques em qualquer lugar para criar uma nota.</p>
        </div>
      )}

      <div className="canvas-tools canvas-ui" role="toolbar" aria-label="Ferramentas do mapa">
        <button type="button" className="map-switch" onClick={() => setDialog('maps')} aria-haspopup="dialog">
          <span>{map.name}</span>
          <span className="map-switch-count">{canvas.maps.length > 1 ? `${canvas.maps.length} mapas` : 'mapas'}</span>
        </button>
        <span className="tools-sep" aria-hidden="true" />
        <button type="button" className="tool" onClick={() => addNode({ kind: 'note', title: '' }, undefined, true)} title="Nova nota (N)">
          <NoteIcon /> <span>Nota</span>
        </button>
        <button type="button" className="tool" onClick={() => setDialog('molecule')} title="Adicionar estrutura">
          <ChainIcon /> <span>Estrutura</span>
        </button>
        <button type="button" className="tool" onClick={() => setDialog('theory')} title="Adicionar teoria da trilha">
          <PathIcon /> <span>Teoria</span>
        </button>
        <button type="button" className="tool tool--tutor" onClick={() => setDialog('tutor')} title="Montar um mapa com o tutor">
          <TutorIcon /> <span>Tutor</span>
        </button>
      </div>

      {(single || selected.length > 1 || edge) && (
        <div className="canvas-selection canvas-ui" role="toolbar" aria-label="Seleção">
          {edge ? (
            <>
              <label className="edge-edit">
                <span className="sr-only">Rótulo da seta</span>
                <input
                  autoFocus={!edge.label}
                  value={edge.label}
                  placeholder="Rótulo da seta: é um, + HBr…"
                  onChange={(e) => tweakCanvas((c) => updateEdge(c, edge.id, { label: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedEdge(null)}
                />
              </label>
              <button
                type="button"
                className="tool"
                onClick={() => editCanvas((c) => ({ ...c, edges: { ...c.edges, [edge.id]: { ...edge, from: edge.to, to: edge.from } } }))}
                title="Inverter o sentido"
              >
                ⇄
              </button>
              <button type="button" className="tool tool--danger" onClick={removeSelection} aria-label="Apagar a seta" title="Apagar (Delete)">
                <TrashIcon />
              </button>
            </>
          ) : (
            <>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot color-dot--${c === 'paper' ? 'none' : c}`}
                  aria-label={`Cor: ${COLOR_LABEL[c]}`}
                  aria-pressed={selected.every((id) => canvas.nodes[id]?.color === c)}
                  onClick={() => editCanvas((cv) => selected.reduce((acc, id) => updateNode(acc, id, { color: c }), cv))}
                />
              ))}
              <span className="tools-sep" aria-hidden="true" />
              {single && single.kind !== 'theory' && (
                <button type="button" className="tool" onClick={() => setEditing(single.id)} title="Editar (Enter)">
                  <EditIcon /> <span>Editar</span>
                </button>
              )}
              {single && (
                <>
                  <button type="button" className="tool tool--tutor" onClick={() => askAbout(single, false)} title="Perguntar ao tutor">
                    <TutorIcon /> <span>Perguntar</span>
                  </button>
                  <button type="button" className="tool tool--tutor" onClick={() => askAbout(single, true)} title="O tutor cria cartões ligados a este">
                    <PlusIcon /> <span>Expandir</span>
                  </button>
                </>
              )}
              <button type="button" className="tool" onClick={duplicate} aria-label="Duplicar" title="Duplicar (Ctrl+D)">
                <CopyIcon />
              </button>
              <button type="button" className="tool tool--danger" onClick={removeSelection} aria-label="Apagar" title="Apagar (Delete)">
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      )}

      <div className="canvas-zoom canvas-ui" role="toolbar" aria-label="Zoom e histórico">
        <button type="button" className="tool" onClick={undoCanvas} disabled={!history.undo} aria-label="Desfazer" title="Desfazer (Ctrl+Z)">
          <UndoIcon />
        </button>
        <button type="button" className="tool tool--redo" onClick={redoCanvas} disabled={!history.redo} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)">
          <UndoIcon />
        </button>
        <span className="tools-sep" aria-hidden="true" />
        <button type="button" className="tool" onClick={() => zoomBy(1 / 1.25)} aria-label="Afastar" title="Afastar (-)">
          <MinusIcon />
        </button>
        <button type="button" className="tool tool--zoom" onClick={() => setViewState((v) => zoomAt(v, 1 / v.zoom, { x: size.w / 2, y: size.h / 2 }))} title="Voltar a 100%">
          {Math.round(view.zoom * 100)}%
        </button>
        <button type="button" className="tool" onClick={() => zoomBy(1.25)} aria-label="Aproximar" title="Aproximar (+)">
          <PlusIcon />
        </button>
        <button type="button" className="tool" onClick={fit} aria-label="Ver tudo" title="Ver tudo (0)">
          <FitIcon />
        </button>
      </div>

      {nodes.length > 0 && <Minimap nodes={nodes} view={view} size={size} onJump={(p) => setViewState((v) => ({ ...v, x: size.w / 2 - p.x * v.zoom, y: size.h / 2 - p.y * v.zoom }))} />}

      {dialog === 'molecule' && <MoleculeDialog onClose={() => setDialog(null)} onAdd={(smiles, name) => addNode({ kind: 'molecule', title: name, smiles })} />}
      {dialog === 'theory' && <TheoryDialog onClose={() => setDialog(null)} onAdd={(lessonId, index, title) => addNode({ kind: 'theory', title, lessonId, card: index })} />}
      {dialog === 'tutor' && <TutorMapDialog onClose={() => setDialog(null)} />}
      {dialog === 'maps' && <MapsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

const KIND_NAME: Record<MapNode['kind'], string> = { note: 'nota', molecule: 'estrutura', theory: 'teoria', tutor: 'resposta do tutor', question: 'questão' };

// ---------------------------------------------------------------------------

function Minimap({ nodes, view, size, onJump }: { nodes: MapNode[]; view: View; size: { w: number; h: number }; onJump: (p: Point) => void }) {
  const W = 168;
  const H = 112;
  const seen = { ...toWorld(view, { x: 0, y: 0 }), w: size.w / view.zoom, h: size.h / view.zoom };
  const all = bounds([...nodes, seen])!;
  const k = Math.min(W / all.w, H / all.h);
  const ox = (W - all.w * k) / 2 - all.x * k;
  const oy = (H - all.h * k) / 2 - all.y * k;
  const jump = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onJump({ x: (e.clientX - r.left - ox) / k, y: (e.clientY - r.top - oy) / k });
  };
  return (
    <svg
      className="minimap canvas-ui"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => e.buttons && jump(e)}
      role="img"
      aria-label="Miniatura do mapa"
    >
      {nodes.map((n) => (
        <rect key={n.id} className={`mini-node mini-node--${n.color}`} x={n.x * k + ox} y={n.y * k + oy} width={Math.max(2, n.w * k)} height={Math.max(2, n.h * k)} rx={1.5} />
      ))}
      <rect className="mini-view" x={seen.x * k + ox} y={seen.y * k + oy} width={seen.w * k} height={seen.h * k} rx={2} />
    </svg>
  );
}

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return ref;
}

function MoleculeDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (smiles: string, name: string) => void }) {
  const ref = useDialog();
  const [query, setQuery] = useState('');
  const [smiles, setSmiles] = useState('');
  const [name, setName] = useState('');
  const valid = useMemo(() => {
    if (!smiles.trim()) return false;
    try {
      return moleculeFromSmiles(smiles.trim()).atoms.length > 0;
    } catch {
      return false;
    }
  }, [smiles]);
  const q = query.trim().toLowerCase();
  const list = MOLECULES.filter((m) => !q || m.name.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q))).slice(0, 12);
  const add = () => {
    if (!valid) return;
    onAdd(smiles.trim(), name.trim());
    ref.current?.close();
  };
  return (
    <dialog ref={ref} className="sheet canvas-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="mol-dialog-title">
      <header className="canvas-dialog-head">
        <h2 id="mol-dialog-title">Adicionar estrutura</h2>
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fechar">
          <CloseIcon />
        </button>
      </header>
      <label className="field">
        <span className="field-label">SMILES</span>
        <input className="field-input" value={smiles} autoFocus spellCheck={false} placeholder="Ex.: CC(=O)O" onChange={(e) => setSmiles(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-invalid={!!smiles && !valid} />
      </label>
      <label className="field">
        <span className="field-label">Nome (opcional)</span>
        <input className="field-input field-input--plain" value={name} placeholder="Ex.: ácido acético" onChange={(e) => setName(e.target.value)} />
      </label>
      {valid && (
        <figure className="paper canvas-dialog-preview">
          <MoleculeView smiles={smiles.trim()} size={24} />
        </figure>
      )}
      <label className="field">
        <span className="field-label">Ou escolha da galeria</span>
        <input className="field-input field-input--search" type="search" value={query} placeholder="Buscar por nome ou função" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="pick-list">
        {list.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={m.smiles === smiles ? 'is-on' : ''}
              onClick={() => {
                setSmiles(m.smiles);
                setName(m.name);
              }}
            >
              {m.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="sheet-actions">
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={add}>
          Adicionar ao mapa
        </button>
      </div>
    </dialog>
  );
}

function TheoryDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (lessonId: string, index: number, title: string) => void }) {
  const ref = useDialog();
  return (
    <dialog ref={ref} className="sheet canvas-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="theory-dialog-title">
      <header className="canvas-dialog-head">
        <h2 id="theory-dialog-title">Teoria da trilha</h2>
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fechar">
          <CloseIcon />
        </button>
      </header>
      <p className="canvas-dialog-note">Escolha um cartão: ele entra no mapa como na lição.</p>
      <div className="theory-pick">
        {LESSONS.filter((l) => THEORY[l.id]?.length).map((l) => (
          <section key={l.id}>
            <h3>
              <span className="mini-tile">{l.element.symbol}</span> {l.title}
            </h3>
            <ul>
              {THEORY[l.id].map((card, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(l.id, i, card.title);
                      ref.current?.close();
                    }}
                  >
                    {card.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}

const MAP_TOPICS = ['funções orgânicas oxigenadas', 'reações de adição e Markovnikov', 'isomeria', 'polímeros de adição e de condensação', 'hidrocarbonetos'];

function TutorMapDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog();
  const [topic, setTopic] = useState('');
  const go = (t: string) => {
    if (!t.trim()) return;
    ref.current?.close();
    ask({ text: `Monte no meu mapa um mapa de conceitos sobre ${t.trim()}, com os conceitos-chave ligados por setas com rótulo.`, about: 'Mapa de conceitos', open: true });
  };
  return (
    <dialog ref={ref} className="sheet canvas-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="tutor-map-title">
      <header className="canvas-dialog-head">
        <h2 id="tutor-map-title">Montar com o tutor</h2>
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fechar">
          <CloseIcon />
        </button>
      </header>
      <p className="canvas-dialog-note">O tutor cria os cartões e as setas neste mapa. Você pode mover, editar ou desfazer tudo depois.</p>
      <form
        className="tutor-map-form"
        onSubmit={(e) => {
          e.preventDefault();
          go(topic);
        }}
      >
        <input className="field-input field-input--plain" autoFocus value={topic} placeholder="Tema, ex.: ésteres e aromas" onChange={(e) => setTopic(e.target.value)} aria-label="Tema do mapa" />
        <button type="submit" className="btn btn--primary" disabled={!topic.trim()}>
          Montar
        </button>
      </form>
      <div className="chips-row chips-row--start">
        {MAP_TOPICS.map((t) => (
          <button key={t} type="button" className="suggestion" onClick={() => go(t)}>
            {t}
          </button>
        ))}
      </div>
    </dialog>
  );
}

function MapsDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog();
  const canvas = useCanvas();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <dialog ref={ref} className="sheet canvas-dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()} aria-labelledby="maps-title">
      <header className="canvas-dialog-head">
        <h2 id="maps-title">Seus mapas</h2>
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fechar">
          <CloseIcon />
        </button>
      </header>
      <ul className="maps-list">
        {canvas.maps.map((m) => {
          const count = Object.values(canvas.nodes).filter((n) => n.map === m.id).length;
          return (
            <li key={m.id} className={m.id === canvas.current ? 'is-current' : ''}>
              {renaming === m.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRenaming(null);
                  }}
                >
                  <input
                    className="field-input field-input--plain"
                    autoFocus
                    value={m.name}
                    aria-label="Nome do mapa"
                    onChange={(e) => tweakCanvas((c) => renameMap(c, m.id, e.target.value))}
                    onBlur={() => setRenaming(null)}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="maps-open"
                  onClick={() => {
                    tweakCanvas((c) => ({ ...c, current: m.id }));
                    ref.current?.close();
                  }}
                >
                  <strong>{m.name}</strong>
                  <span>
                    {count} {count === 1 ? 'cartão' : 'cartões'}
                  </span>
                </button>
              )}
              <button type="button" className="icon-btn" onClick={() => setRenaming(m.id)} aria-label={`Renomear “${m.name}”`}>
                <EditIcon width={18} height={18} />
              </button>
              {canvas.maps.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Apagar “${m.name}”`}
                  onClick={() => {
                    if (confirm(`Apagar o mapa “${m.name}” e seus ${count} cartões?`)) editCanvas((c) => removeMap(c, m.id));
                  }}
                >
                  <TrashIcon width={18} height={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="tutor-map-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          editCanvas((c) => addMap(c, uid('m'), name.trim()));
          setName('');
          ref.current?.close();
        }}
      >
        <input className="field-input field-input--plain" value={name} placeholder="Novo mapa, ex.: Reações" onChange={(e) => setName(e.target.value)} aria-label="Nome do novo mapa" />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Criar
        </button>
      </form>
    </dialog>
  );
}
