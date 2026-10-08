import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Raster } from '../src/engine/raster.js';
import { proj, unproj, sortBoxes, boxPolys } from '../src/engine/iso.js';
import { packHex } from '../src/engine/color.js';
import { findPath, nearestFree } from '../src/game/pathfind.js';
import { ITEMS, rotateBox, footprintSize } from '../src/game/catalog.js';
import { computeLayout, renderScene, renderThumb } from '../src/game/scene.js';
import { demoRoom } from '../src/game/demo.js';
import { createAvatar } from '../src/game/avatar.js';

test('proyección e inversa son consistentes', () => {
  const o = { x: 100, y: 50 };
  for (const [x, y] of [[0, 0], [3.5, 1.25], [7, 9]]) {
    const [sx, sy] = proj(o, x, y, 0);
    const p = unproj(o, sx, sy, 0);
    assert.ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
  }
});

test('el rasterizador no deja huecos entre caras vecinas', () => {
  const r = new Raster(64, 64);
  const red = packHex('#ff0000');
  const blue = packHex('#0000ff');
  r.fill([0, 0, 32, 0, 32, 64, 0, 64], red);
  r.fill([32, 0, 64, 0, 64, 64, 32, 64], blue);
  assert.ok(r.color.every((c) => c === red || c === blue));
  assert.equal(r.color.filter((c) => c === red).length, 32 * 64);
});

test('orden de pintado: lo de atrás primero', () => {
  const back = { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 };
  const front = { x0: 1, y0: 1, z0: 0, x1: 2, y1: 2, z1: 1 };
  const top = { x0: 0, y0: 0, z0: 1, x1: 1, y1: 1, z1: 1.5 };
  const boxes = [front, top, back];
  const o = { x: 64, y: 64 };
  const order = sortBoxes(boxes, boxes.map((b) => boxPolys(o, b))).map((i) => boxes[i]);
  assert.ok(order.indexOf(back) < order.indexOf(front));
  assert.ok(order.indexOf(back) < order.indexOf(top));
});

test('A* encuentra caminos y respeta obstáculos', () => {
  const w = 5;
  const d = 5;
  const g = new Uint8Array(w * d);
  for (let y = 0; y < 4; y++) g[y * w + 2] = 1; // pared con hueco abajo
  const path = findPath(g, w, d, 0, 0, 4, 0);
  assert.ok(path);
  assert.deepEqual(path.at(-1), { x: 4, y: 0 });
  assert.ok(path.every((p) => !g[p.y * w + p.x]));
  assert.equal(path.length, 12);
  g[4 * w + 2] = 1;
  assert.equal(findPath(g, w, d, 0, 0, 4, 0), null);
  const nf = nearestFree(g, w, d, 2, 2);
  assert.equal(Math.abs(nf.x - 2) + Math.abs(nf.y - 2), 1, 'la celda libre más cercana está a 1 paso');
});

test('catálogo: ids únicos, cajas dentro de la huella y colores definidos', () => {
  const ids = new Set();
  for (const def of ITEMS) {
    assert.ok(!ids.has(def.id), `id repetido ${def.id}`);
    assert.ok(def.id > 0 && def.id < 256, 'el id debe entrar en un byte');
    ids.add(def.id);
    assert.ok(def.variants.length >= 1 && def.variants.length <= 8, `${def.key}: 1 a 8 variantes`);
    const W = def.layer === 'deco' ? 1 : def.w;
    const D = def.layer === 'deco' ? 1 : def.d ?? 1;
    for (const b of def.boxes) {
      assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && b.z1 >= b.z0, `${def.key}: caja inválida`);
      if (def.layer !== 'wall') {
        assert.ok(b.x0 >= -1e-9 && b.y0 >= -1e-9 && b.x1 <= W + 1e-9 && b.y1 <= D + 1e-9, `${def.key}: caja fuera de la huella`);
      } else {
        assert.ok(b.x0 >= 0 && b.x1 <= def.w + 1e-9, `${def.key}: fuera del ancho`);
      }
      if (b.c[0] !== '#') for (const v of def.variants) assert.ok(v[b.c] || def.variants[0][b.c], `${def.key}: falta color ${b.c}`);
    }
  }
});

test('rotar 4 veces vuelve al original', () => {
  const box = { x0: 0.1, y0: 0.2, x1: 1.7, y1: 0.9 };
  let b = box;
  for (let i = 0; i < 4; i++) b = rotateBox(b, 2, 1, 1);
  for (const k of ['x0', 'y0', 'x1', 'y1']) assert.ok(Math.abs(b[k] - box[k]) < 1e-9);
  assert.deepEqual(footprintSize({ w: 2, d: 3 }, 1), { w: 3, d: 2 });
});

test('renderiza la escena de ejemplo de día y de noche', () => {
  const room = demoRoom();
  const L = computeLayout(room);
  const r = new Raster(L.w, L.h);
  for (const night of [false, true]) {
    renderScene(r, room, L, { night, avatar: createAvatar(4, 5), time: 1, selected: 0, hover: 1, grid: true });
    const opaque = r.color.filter((c) => c >>> 24).length;
    assert.ok(opaque > r.w * r.h * 0.3, 'la escena cubre buena parte del lienzo');
  }
  // Cada objeto colocado es seleccionable (aparece en el id-buffer)
  renderScene(r, room, L, {});
  const ids = new Set(r.id);
  const missing = room.items.map((_, i) => i + 1).filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], 'todos los objetos son visibles y clickeables');
});

test('todas las miniaturas del catálogo se generan', () => {
  const r = new Raster(4, 4);
  for (const def of ITEMS) {
    const { w, h } = renderThumb(r, def);
    assert.ok(w > 4 && h > 4, def.key);
  }
});
