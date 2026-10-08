// Habitación de ejemplo: lo primero que ve alguien que entra sin un link compartido.
import { ITEMS_BY_KEY } from './catalog.js';
import { createRoom, makeItem, canPlace, SIDE_L, SIDE_R } from './room.js';

const PLAN = [
  ['rug23', { x: 3, y: 4, v: 1 }],
  ['bed', { x: 0, y: 0, v: 0 }],
  ['nightstand', { x: 2, y: 0 }],
  ['tablelamp', { x: 2, y: 0, v: 0 }],
  ['desk', { x: 4, y: 0, v: 0 }],
  ['laptop', { x: 4, y: 0, on: 1 }],
  ['mug', { x: 5, y: 0, v: 1 }],
  ['chair', { x: 4, y: 1, r: 2, v: 0 }],
  ['bookshelf', { x: 6, y: 0, v: 0 }],
  ['plant', { x: 8, y: 0, v: 0 }],
  ['speaker', { x: 0, y: 5, v: 0 }],
  ['guitarstand', { x: 0, y: 6, v: 0 }],
  ['armchair', { x: 6, y: 6, r: 1, v: 1 }],
  ['floorlamp', { x: 7, y: 7 }],
  ['table', { x: 6, y: 4, v: 0 }],
  ['turntable', { x: 6, y: 4, v: 0, on: 0 }],
  ['cat', { x: 4, y: 6, v: 0, r: 1 }],
  ['window', { x: 0, s: SIDE_R, z: 4 }],
  ['clock', { x: 2, s: SIDE_R, z: 7 }],
  ['shelf', { x: 4, s: SIDE_R, z: 6 }],
  ['painting', { x: 7, s: SIDE_R, z: 5 }],
  ['window2', { x: 3, s: SIDE_L, z: 3 }],
  ['vinyl', { x: 6, s: SIDE_L, z: 5 }],
  ['door', { x: 8, s: SIDE_L, z: 0 }],
];

export function demoRoom() {
  const room = createRoom(9, 9);
  room.wall = 0;
  room.floor = 0;
  room.floorStyle = 0;
  for (const [key, opt] of PLAN) {
    const def = ITEMS_BY_KEY.get(key);
    const it = makeItem(def, opt);
    if (canPlace(room, it).ok) room.items.push(it);
  }
  return room;
}
