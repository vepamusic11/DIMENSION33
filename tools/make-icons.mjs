// Genera los íconos PNG de la app con el mismo motor del juego (sin dependencias).
// Uso: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { Raster } from '../src/engine/raster.js';
import { drawBox } from '../src/engine/iso.js';
import { packHex } from '../src/engine/color.js';
import { encodePng } from './png.mjs';

mkdirSync('assets/icons', { recursive: true });
const BG = [27, 23, 38];

/** Mini diorama (piso + 2 paredes + cubo dorado) centrado en un raster cuadrado de `size` px. */
function logo(size) {
  const r = new Raster(size, size);
  const o = { x: size / 2, y: size / 2 - 4 };
  drawBox(r, o, { x0: -0.2, y0: -0.2, z0: -0.35, x1: 0, y1: 2, z1: 1.6, c: '#e8dcc6' });
  drawBox(r, o, { x0: 0, y0: -0.2, z0: -0.35, x1: 2, y1: 0, z1: 1.6, c: '#e8dcc6' });
  drawBox(r, o, { x0: 0, y0: 0, z0: -0.35, x1: 2, y1: 2, z1: 0, c: '#b07a4f' });
  drawBox(r, o, { x0: 0.55, y0: 0.55, z0: 0, x1: 1.45, y1: 1.45, z1: 0.9, c: '#ffd166' });
  r.outline(packHex('#17121f'));
  return r;
}

const icon = (name, raster, size) => writeFileSync(`assets/icons/${name}`, encodePng(raster.bytes(), raster.w, raster.h, 1, BG, size));
const tight = logo(84);
icon('icon-32.png', tight, 32);
icon('icon-180.png', tight, 180);
icon('icon-192.png', tight, 192);
icon('icon-512.png', tight, 512);
icon('icon-maskable-512.png', logo(120), 512); // más margen para el recorte circular
console.log('íconos generados en assets/icons/');
