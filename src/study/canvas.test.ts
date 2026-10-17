import { describe, expect, it } from 'vitest';
import {
  type MapNode,
  addEdge,
  addMap,
  addNodes,
  anchor,
  duplicateNodes,
  edgeLine,
  edgesOf,
  emptyCanvas,
  fitView,
  freeSpot,
  intersects,
  moveNodes,
  nodesOf,
  radialLayout,
  removeMap,
  removeNodes,
  toScreen,
  toWorld,
  zoomAt,
} from './canvas.ts';

const node = (id: string, x: number, y: number, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  map: 'm',
  kind: 'note',
  x,
  y,
  w: 200,
  h: 100,
  title: id,
  text: '',
  color: 'paper',
  createdAt: 0,
  ...extra,
});

describe('canvas geometry', () => {
  it('converts between screen and world and zooms around the pointer', () => {
    const v = { x: 100, y: 50, zoom: 2 };
    expect(toScreen(v, { x: 10, y: 10 })).toEqual({ x: 120, y: 70 });
    expect(toWorld(v, { x: 120, y: 70 })).toEqual({ x: 10, y: 10 });
    const at = { x: 300, y: 200 };
    const before = toWorld(v, at);
    const z = zoomAt(v, 1.2, at);
    expect(z.zoom).toBeCloseTo(2.4);
    const after = toWorld(z, at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(v, 100, at).zoom).toBe(2.5);
  });

  it('fits everything on screen without zooming in past 100%', () => {
    const rects = [node('a', 0, 0), node('b', 1000, 600)];
    const v = fitView(rects, { w: 800, h: 600 });
    const tl = toScreen(v, { x: 0, y: 0 });
    const br = toScreen(v, { x: 1200, y: 700 });
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(800);
    expect(br.y).toBeLessThanOrEqual(600);
    expect(fitView([node('a', 0, 0)], { w: 800, h: 600 }).zoom).toBe(1);
  });

  it('starts arrows on the card borders', () => {
    const r = { x: 0, y: 0, w: 200, h: 100 };
    expect(anchor(r, { x: 500, y: 50 })).toEqual({ x: 200, y: 50 });
    expect(anchor(r, { x: 100, y: -300 })).toEqual({ x: 100, y: 0 });
    const line = edgeLine(r, { x: 400, y: 0, w: 200, h: 100 }, 0)!;
    expect(line.from).toEqual({ x: 200, y: 50 });
    expect(line.to).toEqual({ x: 400, y: 50 });
    expect(edgeLine(r, { x: 100, y: 20, w: 200, h: 100 })).toBeUndefined();
  });

  it('finds a free spot near the requested point', () => {
    const taken = [node('a', -100, -50)];
    const size = { w: 200, h: 100 };
    const spot = freeSpot(taken, size, { x: 0, y: 0 });
    expect(intersects({ ...spot, ...size }, taken[0])).toBe(false);
    expect(Math.hypot(spot.x, spot.y)).toBeLessThan(400);
    expect(freeSpot([], size, { x: 0, y: 0 })).toEqual({ x: -96, y: -48 });
  });

  it('lays a hub and spokes out without overlaps', () => {
    const sizes = [{ w: 260, h: 120 }, ...Array.from({ length: 7 }, () => ({ w: 220, h: 110 }))];
    const pts = radialLayout(sizes);
    const rects = pts.map((p, i) => ({ ...p, ...sizes[i] }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(intersects(rects[i], rects[j])).toBe(false);
    }
  });
});

describe('canvas model', () => {
  it('keeps arrows valid as cards come and go', () => {
    let c = { ...emptyCanvas('m'), maps: [{ id: 'm', name: 'Mapa', createdAt: 0, view: { x: 0, y: 0, zoom: 1 } }] };
    c = addNodes(c, [node('a', 0, 0), node('b', 400, 0), node('c', 0, 400)]);
    c = addEdge(c, { id: 'e1', map: 'm', from: 'a', to: 'b', label: 'é um' });
    c = addEdge(c, { id: 'e2', map: 'm', from: 'a', to: 'b', label: 'repetida' });
    c = addEdge(c, { id: 'e3', map: 'm', from: 'a', to: 'a', label: 'laço' });
    c = addEdge(c, { id: 'e4', map: 'm', from: 'b', to: 'c', label: '' });
    expect(Object.keys(c.edges).sort()).toEqual(['e1', 'e4']);
    c = moveNodes(c, ['a', 'b'], 10, 20);
    expect(c.nodes.a).toMatchObject({ x: 10, y: 20 });
    c = removeNodes(c, ['b']);
    expect(Object.keys(c.edges)).toEqual([]);
  });

  it('duplicates cards with the arrows between them', () => {
    let c = emptyCanvas('m');
    c = addNodes(c, [node('a', 0, 0), node('b', 400, 0), node('c', 0, 400)]);
    c = addEdge(c, { id: 'e1', map: 'm', from: 'a', to: 'b', label: 'forma' });
    c = addEdge(c, { id: 'e2', map: 'm', from: 'b', to: 'c', label: '' });
    let k = 0;
    const { canvas, ids } = duplicateNodes(c, ['a', 'b'], () => `n${k++}`);
    expect(ids).toHaveLength(2);
    expect(Object.keys(canvas.nodes)).toHaveLength(5);
    expect(edgesOf(canvas).filter((e) => ids.includes(e.from) && ids.includes(e.to))).toHaveLength(1);
  });

  it('keeps maps apart and never deletes the last one', () => {
    let c = emptyCanvas('m');
    c = addNodes(c, [node('a', 0, 0)]);
    c = addMap(c, 'm2', 'Reações');
    expect(c.current).toBe('m2');
    c = addNodes(c, [node('b', 0, 0, { map: 'm2' })]);
    expect(nodesOf(c).map((n) => n.id)).toEqual(['b']);
    c = removeMap(c, 'm2');
    expect(c.current).toBe('m');
    expect(Object.keys(c.nodes)).toEqual(['a']);
    expect(removeMap(c, 'm').maps).toHaveLength(1);
  });
});
