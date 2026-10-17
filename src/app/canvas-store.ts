/** The concept maps as the app keeps them, and "save to map" from anywhere in the app. */
import {
  type Canvas,
  type MapNode,
  NODE_WIDTH,
  type NodeKind,
  type Point,
  addEdge,
  addNodes,
  bounds,
  center,
  currentMap,
  emptyCanvas,
  estimateHeight,
  freeSpot,
  nodesOf,
  radialLayout,
  removeNodes,
  toWorld,
} from '../study/canvas.ts';
import type { MapCardInput, MapLinkInput } from '../tutor/tools.ts';
import { memory, persisted, uid, usePersisted } from './persist.ts';
import { href } from './router.ts';
import { toast } from './toast.ts';

export const canvasStore = persisted<Canvas>('chemrster:canvas:v1', (stored) => {
  const c = stored as Partial<Canvas> | undefined;
  if (!c || typeof c !== 'object' || !Array.isArray(c.maps) || !c.maps.length) return emptyCanvas(uid('m'));
  return { maps: c.maps, current: c.maps.some((m) => m.id === c.current) ? c.current! : c.maps[0].id, nodes: c.nodes ?? {}, edges: c.edges ?? {} };
});

export const useCanvas = () => usePersisted(canvasStore);

// Undo history: every edit that changes cards, arrows or maps; panning and zooming do not count.
const past: Canvas[] = [];
const future: Canvas[] = [];
const history = memory({ undo: 0, redo: 0 });
export const useCanvasHistory = history.use;
const syncHistory = () => history.set({ undo: past.length, redo: future.length });

/** An undoable edit. */
export function editCanvas(fn: (c: Canvas) => Canvas) {
  const prev = canvasStore.get();
  const next = fn(prev);
  if (next === prev) return;
  past.push(prev);
  if (past.length > 80) past.shift();
  future.length = 0;
  canvasStore.set(next);
  syncHistory();
}

/** A change that is not worth undoing: the view, a measured card height. */
export const tweakCanvas = (fn: (c: Canvas) => Canvas) => canvasStore.set(fn);

/** Going back in time keeps where each map is looking. */
function restore(target: Canvas, present: Canvas): Canvas {
  const views = new Map(present.maps.map((m) => [m.id, m.view]));
  const maps = target.maps.map((m) => ({ ...m, view: views.get(m.id) ?? m.view }));
  return { ...target, maps, current: maps.some((m) => m.id === present.current) ? present.current : target.current };
}

export function undoCanvas() {
  const prev = past.pop();
  if (!prev) return;
  const present = canvasStore.get();
  future.push(present);
  canvasStore.set(restore(prev, present));
  syncHistory();
}

export function redoCanvas() {
  const next = future.pop();
  if (!next) return;
  const present = canvasStore.get();
  past.push(present);
  canvasStore.set(restore(next, present));
  syncHistory();
}

/** The canvas element's size, kept by the canvas screen so cards saved elsewhere land in view. */
export const viewport = { w: 1100, h: 720 };

/** The world point in the middle of what the current map shows. */
export function viewCenter(c: Canvas): Point {
  return toWorld(currentMap(c).view, { x: viewport.w / 2, y: viewport.h / 2 });
}

export type NodeDraft = Pick<MapNode, 'kind' | 'title'> & Partial<Pick<MapNode, 'text' | 'smiles' | 'lessonId' | 'card' | 'color'>>;

export function makeNode(draft: NodeDraft, at: Point, map: string): MapNode {
  return {
    id: uid('n'),
    map,
    x: at.x,
    y: at.y,
    w: NODE_WIDTH[draft.kind],
    h: estimateHeight(draft.kind, draft.title, draft.text ?? '', !!draft.smiles),
    text: '',
    color: 'paper',
    createdAt: Date.now(),
    ...draft,
  };
}

const KIND_SAVED: Record<NodeKind, string> = {
  note: 'Nota salva no mapa',
  molecule: 'Estrutura salva no mapa',
  theory: 'Teoria salva no mapa',
  tutor: 'Resposta salva no mapa',
  question: 'Questão salva no mapa',
};

/** Adds a card to the current map, in a free spot in the middle of its view. */
export function saveToMap(draft: NodeDraft, { quiet = false, near }: { quiet?: boolean; near?: Point } = {}): string {
  const c = canvasStore.get();
  const size = { w: NODE_WIDTH[draft.kind], h: estimateHeight(draft.kind, draft.title, draft.text ?? '', !!draft.smiles) };
  const spot = freeSpot(nodesOf(c), size, near ?? viewCenter(c));
  const node = makeNode(draft, spot, c.current);
  editCanvas((s) => addNodes(s, [node]));
  if (!quiet) toast(KIND_SAVED[draft.kind], { label: 'Ver no mapa', href: href({ name: 'canvas' }) });
  return node.id;
}

/**
 * A hub-and-spokes cluster from the tutor, in free space near the view's middle (or next
 * to `anchorId`, which then points at the hub). Returns the ids created.
 */
export function addCluster(cards: MapCardInput[], links: MapLinkInput[], anchorId?: string): string[] {
  const c = canvasStore.get();
  const anchor = anchorId ? c.nodes[anchorId] : undefined;
  const map = anchor?.map ?? c.current;
  const kinds = cards.map((k): NodeKind => (k.smiles ? 'molecule' : 'note'));
  const sizes = kinds.map((k, i) => ({ w: NODE_WIDTH[k], h: estimateHeight(k, cards[i].titulo, cards[i].texto, !!cards[i].smiles) }));
  const rel = radialLayout(sizes);
  const box = bounds(rel.map((p, i) => ({ ...p, ...sizes[i] })))!;
  const target = anchor ? { x: anchor.x + anchor.w + 80 + box.w / 2, y: center(anchor).y } : viewCenter(c);
  const spot = freeSpot(nodesOf(c, map), { w: box.w, h: box.h }, target, 40);
  const nodes = cards.map((k, i) =>
    makeNode(
      { kind: kinds[i], title: k.titulo, text: k.texto, smiles: k.smiles, color: i === 0 ? 'cobalt' : 'paper' },
      { x: spot.x + rel[i].x - box.x, y: spot.y + rel[i].y - box.y },
      map,
    ),
  );
  let next = addNodes(c, nodes);
  for (const l of links) next = addEdge(next, { id: uid('e'), map, from: nodes[l.de].id, to: nodes[l.para].id, label: l.rotulo });
  // Without links, spokes hang off the hub.
  if (!links.length) for (const n of nodes.slice(1)) next = addEdge(next, { id: uid('e'), map, from: nodes[0].id, to: n.id, label: '' });
  if (anchor) next = addEdge(next, { id: uid('e'), map, from: anchor.id, to: nodes[0].id, label: '' });
  editCanvas(() => ({ ...next, current: map }));
  return nodes.map((n) => n.id);
}

export function removeFromMap(ids: string[]) {
  editCanvas((c) => removeNodes(c, ids));
}
