// Renderiza la habitación de ejemplo a PNG (día y noche). Uso: node tools/render-demo.mjs <carpeta-salida>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Raster } from '../src/engine/raster.js';
import { computeLayout, renderScene } from '../src/game/scene.js';
import { demoRoom } from '../src/game/demo.js';
import { createAvatar } from '../src/game/avatar.js';
import { encodePng } from './png.mjs';

const out = process.argv[2] || 'docs';
mkdirSync(out, { recursive: true });
const room = demoRoom();
const L = computeLayout(room);
const r = new Raster(L.w, L.h);
const avatar = createAvatar(4, 5);
for (const night of [false, true]) {
  renderScene(r, room, L, { night, avatar, time: 0.4, selected: -1, hover: -1 });
  writeFileSync(join(out, night ? 'preview-night.png' : 'preview-day.png'), encodePng(r.bytes(), r.w, r.h, 3, [28, 24, 40]));
}
console.log('items colocados:', room.items.length, 'tamaño', L.w, 'x', L.h);
