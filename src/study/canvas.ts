/**
 * The concept map: an infinite canvas of cards (notes, structures, theory, tutor answers,
 * missed questions) joined by labelled arrows. Pure model and geometry; the screen draws it.
 *
 * Coordinates: cards live in world units; the view maps them to the screen as
 * screen = world × zoom + (x, y).
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

export interface View extends Point {
  zoom: number;
}

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const toScreen = (v: View, p: Point): Point => ({ x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y });
export const toWorld = (v: View, p: Point): Point => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom });

/** Zooms by `factor` keeping the world point under `at` (a screen point) where it is. */
export function zoomAt(v: View, factor: number, at: Point): View {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const k = zoom / v.zoom;
  return { zoom, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k };
}

export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function bounds(rects: Rect[]): Rect | undefined {
  if (!rects.length) return undefined;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** The view that shows every rect, never zooming past `maxZoom`. */
export function fitView(rects: Rect[], viewport: { w: number; h: number }, padding = 56, maxZoom = 1): View {
  const b = bounds(rects);
  if (!b) return { x: viewport.w / 2, y: viewport.h / 2, zoom: 1 };
  const zoom = clamp(Math.min((viewport.w - 2 * padding) / b.w, (viewport.h - 2 * padding) / b.h), MIN_ZOOM, maxZoom);
  return { zoom, x: viewport.w / 2 - (b.x + b.w / 2) * zoom, y: viewport.h / 2 - (b.y + b.h / 2) * zoom };
}

export const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/** The rectangle spanned by two corners, in any order. */
export function spanRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Where the line from the centre of `r` towards `p` leaves `r`, `gap` further out. */
export function anchor(r: Rect, p: Point, gap = 0): Point {
  const c = center(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(dx ? (r.w / 2 + gap) / Math.abs(dx) : Infinity, dy ? (r.h / 2 + gap) / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** An arrow between two cards, border to border; none when they overlap. */
export function edgeLine(a: Rect, b: Rect, gap = 6): { from: Point; to: Point } | undefined {
  if (intersects(grow(a, gap), grow(b, gap))) return undefined;
  return { from: anchor(a, center(b), gap), to: anchor(b, center(a), gap) };
}

export const snap = (v: number, grid = 8) => Math.round(v / grid) * grid;

/**
 * The top-left corner nearest to centring a `size` box on `near` where it overlaps no
 * rect (with `gap` around them), searched ring by ring on a coarse grid.
 */
export function freeSpot(rects: Rect[], size: { w: number; h: number }, near: Point, gap = 24): Point {
  const start = { x: snap(near.x - size.w / 2), y: snap(near.y - size.h / 2) };
  const blocked = rects.map((r) => grow(r, gap));
  const fits = (p: Point) => !blocked.some((r) => intersects(r, { ...p, ...size }));
  if (fits(start)) return start;
  const step = 48;
  for (let ring = 1; ring <= 80; ring++) {
    const candidates: Point[] = [];
    for (let i = -ring; i <= ring; i++) {
      candidates.push({ x: i, y: -ring }, { x: i, y: ring });
      if (i > -ring && i < ring) candidates.push({ x: -ring, y: i }, { x: ring, y: i });
    }
    candidates.sort((a, b) => Math.hypot(a.x, a.y * 1.6) - Math.hypot(b.x, b.y * 1.6));
    for (const c of candidates) {
      const p = { x: start.x + c.x * step, y: start.y + c.y * step };
      if (fits(p)) return p;
    }
  }
  return start;
}

/**
 * A hub with spokes: the first box centred at the origin, the rest on an ellipse around
 * it, far enough apart not to touch. Returns top-left corners relative to the hub's centre.
 */
export function radialLayout(sizes: Array<{ w: number; h: number }>, gap = 90): Point[] {
  if (!sizes.length) return [];
  const [hub, ...spokes] = sizes;
  const out: Point[] = [{ x: -hub.w / 2, y: -hub.h / 2 }];
  if (!spokes.length) return out;
  const w = Math.max(...spokes.map((s) => s.w));
  const h = Math.max(...spokes.map((s) => s.h));
  const n = spokes.length;
  // Wide enough that neighbours on the ring clear each other, and the hub.
  const rx = Math.max(hub.w / 2 + w / 2 + gap, (n * (w + gap)) / (2 * Math.PI));
  const ry = Math.max(hub.h / 2 + h / 2 + gap, rx * 0.72);
  spokes.forEach((s, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    out.push({ x: Math.cos(a) * rx - s.w / 2, y: Math.sin(a) * ry - s.h / 2 });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Model

export type NodeKind = 'note' | 'molecule' | 'theory' | 'tutor' | 'question';
export type NodeColor = 'paper' | 'magenta' | 'cobalt' | 'green' | 'amber';

export const NODE_WIDTH: Record<NodeKind, number> = { note: 240, molecule: 220, theory: 340, tutor: 320, question: 300 };
/** A first guess at a card's height, until the screen measures it. */
export const NODE_HEIGHT: Record<NodeKind, number> = { note: 120, molecule: 200, theory: 280, tutor: 200, question: 180 };

/** A closer guess from the content: lines of title and text at the card's width, plus a drawing. */
export function estimateHeight(kind: NodeKind, title: string, text: string, drawing: boolean): number {
  if (kind === 'theory') return NODE_HEIGHT.theory;
  const inner = NODE_WIDTH[kind] - 28;
  const lines = (s: string, px: number) => s.split('\n').reduce((n, p) => n + Math.max(1, Math.ceil(p.length / (inner / px))), 0);
  const titleH = title ? lines(title, 10) * 22 + 8 : 0;
  const textH = text ? lines(text.replace(/\*\*/g, ''), 7.4) * 21 + 8 : 0;
  return Math.round(44 + titleH + textH + (drawing ? 150 : 0));
}

export interface MapNode extends Rect {
  id: string;
  map: string;
  kind: NodeKind;
  title: string;
  /** Short paragraphs; **double asterisks** mark key terms. */
  text: string;
  smiles?: string;
  /** For theory cards: the lesson and which of its cards. */
  lessonId?: string;
  card?: number;
  color: NodeColor;
  createdAt: number;
}

export interface MapEdge {
  id: string;
  map: string;
  from: string;
  to: string;
  /** Written over the arrow, like a reagent: "é um", "+ HBr", "oxida a". */
  label: string;
}

export interface MapMeta {
  id: string;
  name: string;
  createdAt: number;
  view: View;
}

export interface Canvas {
  maps: MapMeta[];
  current: string;
  nodes: Record<string, MapNode>;
  edges: Record<string, MapEdge>;
}

export function emptyCanvas(mapId: string, now = Date.now()): Canvas {
  return { maps: [{ id: mapId, name: 'Meu mapa', createdAt: now, view: { x: 0, y: 0, zoom: 1 } }], current: mapId, nodes: {}, edges: {} };
}

export const nodesOf = (c: Canvas, map = c.current) => Object.values(c.nodes).filter((n) => n.map === map);
export const edgesOf = (c: Canvas, map = c.current) => Object.values(c.edges).filter((e) => e.map === map);
export const currentMap = (c: Canvas) => c.maps.find((m) => m.id === c.current) ?? c.maps[0];

export function addNodes(c: Canvas, nodes: MapNode[]): Canvas {
  return { ...c, nodes: { ...c.nodes, ...Object.fromEntries(nodes.map((n) => [n.id, n])) } };
}

export function updateNode(c: Canvas, id: string, patch: Partial<Omit<MapNode, 'id' | 'map'>>): Canvas {
  const node = c.nodes[id];
  if (!node) return c;
  return { ...c, nodes: { ...c.nodes, [id]: { ...node, ...patch } } };
}

export function moveNodes(c: Canvas, ids: string[], dx: number, dy: number): Canvas {
  if (!dx && !dy) return c;
  const nodes = { ...c.nodes };
  for (const id of ids) if (nodes[id]) nodes[id] = { ...nodes[id], x: nodes[id].x + dx, y: nodes[id].y + dy };
  return { ...c, nodes };
}

/** Removes cards and every arrow touching them. */
export function removeNodes(c: Canvas, ids: string[]): Canvas {
  const gone = new Set(ids);
  const nodes = Object.fromEntries(Object.entries(c.nodes).filter(([id]) => !gone.has(id)));
  const edges = Object.fromEntries(Object.entries(c.edges).filter(([, e]) => !gone.has(e.from) && !gone.has(e.to)));
  return { ...c, nodes, edges };
}

/** Adds an arrow unless it would join a card to itself or repeat an existing arrow. */
export function addEdge(c: Canvas, edge: MapEdge): Canvas {
  const from = c.nodes[edge.from];
  const to = c.nodes[edge.to];
  if (!from || !to || edge.from === edge.to || from.map !== to.map) return c;
  if (Object.values(c.edges).some((e) => e.from === edge.from && e.to === edge.to)) return c;
  return { ...c, edges: { ...c.edges, [edge.id]: { ...edge, map: from.map } } };
}

export function updateEdge(c: Canvas, id: string, patch: Partial<Pick<MapEdge, 'label'>>): Canvas {
  const edge = c.edges[id];
  if (!edge) return c;
  return { ...c, edges: { ...c.edges, [id]: { ...edge, ...patch } } };
}

export function removeEdges(c: Canvas, ids: string[]): Canvas {
  const gone = new Set(ids);
  return { ...c, edges: Object.fromEntries(Object.entries(c.edges).filter(([id]) => !gone.has(id))) };
}

/** Copies cards, and the arrows between them, `offset` away. Returns the copies' ids too. */
export function duplicateNodes(c: Canvas, ids: string[], makeId: () => string, offset = 32): { canvas: Canvas; ids: string[] } {
  const map = new Map<string, string>();
  const copies: MapNode[] = [];
  for (const id of ids) {
    const n = c.nodes[id];
    if (!n) continue;
    const copy = { ...n, id: makeId(), x: n.x + offset, y: n.y + offset, createdAt: Date.now() };
    map.set(id, copy.id);
    copies.push(copy);
  }
  let next = addNodes(c, copies);
  for (const e of Object.values(c.edges)) {
    const from = map.get(e.from);
    const to = map.get(e.to);
    if (from && to) next = addEdge(next, { ...e, id: makeId(), from, to });
  }
  return { canvas: next, ids: copies.map((n) => n.id) };
}

export function addMap(c: Canvas, id: string, name: string, now = Date.now()): Canvas {
  return { ...c, maps: [...c.maps, { id, name, createdAt: now, view: { x: 0, y: 0, zoom: 1 } }], current: id };
}

export function renameMap(c: Canvas, id: string, name: string): Canvas {
  return { ...c, maps: c.maps.map((m) => (m.id === id ? { ...m, name } : m)) };
}

/** Deletes a map with its cards and arrows; the last map is never deleted. */
export function removeMap(c: Canvas, id: string): Canvas {
  if (c.maps.length <= 1) return c;
  const maps = c.maps.filter((m) => m.id !== id);
  const nodes = Object.fromEntries(Object.entries(c.nodes).filter(([, n]) => n.map !== id));
  const edges = Object.fromEntries(Object.entries(c.edges).filter(([, e]) => e.map !== id));
  return { maps, nodes, edges, current: c.current === id ? maps[0].id : c.current };
}

export function setView(c: Canvas, id: string, view: View): Canvas {
  return { ...c, maps: c.maps.map((m) => (m.id === id ? { ...m, view } : m)) };
}
