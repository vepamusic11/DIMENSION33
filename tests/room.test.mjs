import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, makeItem, canPlace, encodeRoom, decodeRoom, resizeRoom, blockedGrid, surfaceAt, SIDE_L, SIDE_R, toBase64Url, fromBase64Url } from '../src/game/room.js';
import { ITEMS_BY_KEY, WALL_STYLES } from '../src/game/catalog.js';
import { demoRoom } from '../src/game/demo.js';

const def = (k) => ITEMS_BY_KEY.get(k);
const place = (room, key, extra) => {
  const it = makeItem(def(key), extra);
  const res = canPlace(room, it);
  if (res.ok) room.items.push(it);
  return res;
};

test('base64url ida y vuelta para todos los largos', () => {
  for (let n = 0; n < 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
    assert.deepEqual([...fromBase64Url(toBase64Url(bytes))], [...bytes]);
  }
});

test('la habitación de ejemplo se codifica y decodifica sin pérdidas', () => {
  const room = demoRoom();
  assert.ok(room.items.length >= 20, 'la demo debería tener todos sus objetos');
  const code = encodeRoom(room);
  const back = decodeRoom(code);
  assert.deepEqual(back, room);
  assert.equal(encodeRoom(back), code);
});

test('decodeRoom rechaza entradas maliciosas o rotas sin lanzar', () => {
  for (const bad of ['', '<script>alert(1)</script>', 'AAAA', '%%%', 'x'.repeat(5000), null, 42, '___']) {
    assert.equal(decodeRoom(bad), null, String(bad).slice(0, 20));
  }
  // Tamaño fuera de rango
  assert.equal(decodeRoom(toBase64Url(Uint8Array.from([1, 99, 99, 0, 0, 0, 0]))), null);
  // Cantidad declarada mayor a los datos reales
  assert.equal(decodeRoom(toBase64Url(Uint8Array.from([1, 8, 8, 0, 0, 0, 5, 1, 0, 0, 0, 0]))), null);
});

test('decodeRoom descarta objetos desconocidos o superpuestos', () => {
  const bytes = Uint8Array.from([
    1, 8, 8, 0, 0, 0, 4,
    250, 1, 1, 0, 0, // id inexistente
    4, 2, 2, 0, 0, // mesa
    4, 2, 2, 0, 0, // otra mesa en el mismo lugar
    4, 7, 7, 0, 0, // mesa válida
  ]);
  const room = decodeRoom(toBase64Url(bytes));
  assert.equal(room.items.length, 2);
});

test('reglas de colocación de muebles, alfombras y deco', () => {
  const room = createRoom(6, 6);
  assert.ok(place(room, 'table', { x: 1, y: 1 }).ok);
  assert.equal(place(room, 'chair', { x: 1, y: 1 }).ok, false, 'no se superponen muebles');
  assert.ok(place(room, 'rug22', { x: 0, y: 0 }).ok, 'una alfombra puede ir debajo de un mueble');
  assert.equal(place(room, 'rug22', { x: 1, y: 1 }).ok, false, 'no se superponen alfombras');
  assert.ok(place(room, 'mug', { x: 1, y: 1 }).ok, 'deco sobre una mesa');
  assert.equal(surfaceAt(room, 1, 1), def('table').surface);
  assert.equal(place(room, 'books', { x: 1, y: 1 }).ok, false, 'un solo deco por celda');
  assert.ok(place(room, 'bookshelf', { x: 4, y: 4 }).ok);
  assert.equal(place(room, 'mug', { x: 4, y: 4 }).ok, false, 'la biblioteca no tiene superficie');
  assert.equal(place(room, 'sofa', { x: 5, y: 0 }).ok, false, 'fuera de la habitación');
  assert.ok(place(room, 'sofa', { x: 5, y: 0, r: 1 }).ok, 'rotado entra');
});

test('reglas de objetos de pared', () => {
  const room = createRoom(6, 6);
  assert.ok(place(room, 'window', { x: 0, s: SIDE_R, z: 4 }).ok);
  assert.equal(place(room, 'painting', { x: 0, s: SIDE_R, z: 5 }).ok, false, 'se superpone');
  assert.ok(place(room, 'painting', { x: 0, s: SIDE_L, z: 5 }).ok, 'la otra pared está libre');
  assert.equal(place(room, 'window2', { x: 5, s: SIDE_R, z: 3 }).ok, false, 'se sale de la pared');
  assert.equal(place(room, 'window', { x: 3, s: SIDE_R, z: 10 }).ok, false, 'demasiado alto');
});

test('resizeRoom descarta lo que queda afuera', () => {
  const room = createRoom(8, 8);
  place(room, 'table', { x: 7, y: 7 });
  place(room, 'table', { x: 1, y: 1 });
  const removed = resizeRoom(room, 5, 5);
  assert.equal(removed, 1);
  assert.equal(room.items.length, 1);
  assert.equal(resizeRoom(room, 2, 99), 0);
  assert.equal(room.w, 4, 'se respeta el mínimo');
  assert.equal(room.d, 16, 'se respeta el máximo');
});

test('blockedGrid marca muebles y deco del piso, no alfombras ni paredes', () => {
  const room = createRoom(4, 4);
  place(room, 'rug22', { x: 0, y: 0 });
  place(room, 'sofa', { x: 2, y: 3 });
  place(room, 'cat', { x: 0, y: 3 });
  place(room, 'window', { x: 0, s: SIDE_R, z: 4 });
  const g = blockedGrid(room);
  assert.deepEqual([...g], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1]);
});

test('el estilo de pared viaja en el link junto al color', () => {
  for (let style = 0; style < WALL_STYLES.length; style++) {
    const room = createRoom(6, 7);
    room.wall = 7;
    room.wallStyle = style;
    const back = decodeRoom(encodeRoom(room));
    assert.equal(back.wall, 7);
    assert.equal(back.wallStyle, style);
  }
});

test('los links anteriores al estilo de pared se abren con pared lisa', () => {
  // Cabecera v1 tal como la generaba la primera versión: wall = 5, sin estilo
  const room = decodeRoom(toBase64Url(Uint8Array.from([1, 8, 8, 5, 1, 2, 0])));
  assert.equal(room.wall, 5);
  assert.equal(room.wallStyle, 0);
  assert.equal(room.floorStyle, 1);
});

test('un estilo o color de pared fuera de rango vuelve al valor por defecto', () => {
  const room = decodeRoom(toBase64Url(Uint8Array.from([1, 8, 8, 0xff, 0, 0, 0])));
  assert.equal(room.wall, 0);
  assert.equal(room.wallStyle, 0);
});
