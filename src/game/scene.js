// Composición de la escena: estructura (paredes/piso), alfombras, sombras, objetos
// ordenados, iluminación nocturna, resaltados y previsualización.
import { HW, HH, UNIT_Z, WALL_H, WALL_T, SLAB, ID_FLOOR, ID_WALL_L, ID_WALL_R, ID_AVATAR } from '../engine/config.js';
import { proj, flatPoly, boxPolys, drawBox, drawBoxGhost, sortBoxes } from '../engine/iso.js';
import { hexToRgb, packRgb, packHex } from '../engine/color.js';
import { WALL_COLORS, FLOOR_COLORS, FLOOR_STYLES, footprintSize, rotateBox, boxColor } from './catalog.js';
import { defOf, surfaceAt, cellsOf, SIDE_L } from './room.js';
import { avatarBoxes } from './avatar.js';

const SLAB_HEX = '#5e4535';
const OUTLINE = packHex('#17121f');
const SELECT = packHex('#ffd166');
const WHITE = packHex('#ffffff');
const OK_HEX = packHex('#5ee39a');
const BAD_HEX = packHex('#ff5c6c');
const NIGHT_AMBIENT = [0.3, 0.33, 0.6];
const WARM = [1.0, 0.82, 0.55];

const NOTE = ['..###', '..#.#', '..#..', '..#..', '###..', '###..'];
const NOTE_COLORS = ['#ff8fab', '#ffd166', '#7ae7c7', '#a0c4ff'].map((h) => packHex(h));

export function computeLayout(room) {
  const pad = 26;
  const ox = Math.round(pad + (room.d + WALL_T) * HW);
  const oy = Math.round(pad + (WALL_H + 0.7) * UNIT_Z);
  return {
    pad,
    origin: { x: ox, y: oy },
    w: Math.ceil(ox + (room.w + WALL_T) * HW + pad),
    h: Math.ceil(oy + (room.w + room.d) * HH + SLAB * UNIT_Z + pad),
  };
}

const hash2 = (a, b) => ((Math.imul(a + 17, 73856093) ^ Math.imul(b + 31, 19349663)) >>> 0);
const scaleRgb = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

/** Cajas de un item en coordenadas de mundo. index = posición en room.items (-1 para fantasma). */
export function itemBoxes(room, item, index) {
  const def = defOf(item);
  const id = index >= 0 ? index + 1 : 0;
  const out = [];
  if (def.layer === 'wall') {
    const z = item.z / 4;
    for (const bx of def.boxes) {
      const c = boxColor(def, bx, item.v, item.on);
      const glow = !!(bx.glow && item.on);
      if (item.s === SIDE_L) {
        out.push({ x0: bx.y0, x1: bx.y1, y0: item.x + bx.x0, y1: item.x + bx.x1, z0: z + bx.z0, z1: z + bx.z1, c, id, glow, noEdge: bx.noEdge });
      } else {
        out.push({ x0: item.x + bx.x0, x1: item.x + bx.x1, y0: bx.y0, y1: bx.y1, z0: z + bx.z0, z1: z + bx.z1, c, id, glow, noEdge: bx.noEdge });
      }
    }
    return out;
  }
  const fp = def.layer === 'deco' ? { w: 1, d: 1 } : { w: def.w, d: def.d };
  const zBase = def.layer === 'deco' ? Math.max(0, surfaceAt(room, item.x, item.y, index)) : 0;
  for (const bx of def.boxes) {
    const rb = rotateBox(bx, fp.w, fp.d, def.layer === 'deco' ? item.r : item.r);
    out.push({
      x0: item.x + rb.x0,
      x1: item.x + rb.x1,
      y0: item.y + rb.y0,
      y1: item.y + rb.y1,
      z0: zBase + bx.z0,
      z1: zBase + bx.z1,
      c: boxColor(def, bx, item.v, item.on),
      id,
      glow: !!(bx.glow && item.on),
      noEdge: bx.noEdge,
    });
  }
  return out;
}

/** Punto (mundo) de donde sale la luz o la música de un item. */
export function itemAnchor(room, item, index, z = null) {
  const def = defOf(item);
  if (def.layer === 'wall') {
    const zz = item.z / 4 + (z ?? def.h);
    return item.s === SIDE_L ? { x: 0.1, y: item.x + def.w / 2, z: zz } : { x: item.x + def.w / 2, y: 0.1, z: zz };
  }
  const fp = def.layer === 'deco' ? { w: 1, d: 1 } : footprintSize(def, item.r);
  const zBase = def.layer === 'deco' ? Math.max(0, surfaceAt(room, item.x, item.y, index)) : 0;
  const top = def.boxes.reduce((m, bx) => Math.max(m, bx.z1), 0);
  return { x: item.x + fp.w / 2, y: item.y + fp.d / 2, z: zBase + (z ?? top) };
}

function drawFloor(r, o, room) {
  const base = hexToRgb(FLOOR_COLORS[room.floor]);
  const style = FLOOR_STYLES[room.floorStyle].key;
  for (let y = 0; y < room.d; y++) {
    for (let x = 0; x < room.w; x++) {
      if (style === 'planks') {
        for (let s = 0; s < 2; s++) {
          const row = y * 2 + s;
          const off = row % 2;
          const plank = Math.floor((x + off) / 2);
          const f = [1, 0.94, 0.89, 1.04][hash2(plank, row) % 4];
          const y0 = y + s * 0.5;
          r.fill(flatPoly(o, x, y0, x + 1, y0 + 0.5), packRgb(scaleRgb(base, f)), ID_FLOOR);
          if ((x + off) % 2 === 0) r.fill(flatPoly(o, x, y0, x + 0.07, y0 + 0.5), packRgb(scaleRgb(base, 0.72)), ID_FLOOR);
        }
        r.fill(flatPoly(o, x, y, x + 1, y + 0.05), packRgb(scaleRgb(base, 0.8)), ID_FLOOR);
      } else if (style === 'tiles') {
        r.fill(flatPoly(o, x, y, x + 1, y + 1), packRgb(scaleRgb(base, 0.72)), ID_FLOOR);
        const f = (x + y) % 2 ? 0.92 : 1.05;
        r.fill(flatPoly(o, x + 0.06, y + 0.06, x + 1, y + 1), packRgb(scaleRgb(base, f)), ID_FLOOR);
      } else {
        const f = (x + y) % 2 ? 0.98 : 1.0;
        r.fill(flatPoly(o, x, y, x + 1, y + 1), packRgb(scaleRgb(base, f)), ID_FLOOR);
      }
    }
  }
  if (style === 'carpet') {
    // Tramado sutil para dar textura de tela
    for (let i = 0; i < r.id.length; i++) {
      if (r.id[i] === ID_FLOOR && hash2(i, 7) % 9 === 0) {
        const c = r.color[i];
        r.color[i] = packRgb(scaleRgb([c & 255, (c >>> 8) & 255, (c >>> 16) & 255], 0.92));
      }
    }
  }
}

/**
 * Renderiza todo. opts:
 *   night, grid, time, avatar, look, selected (índice), hover (índice),
 *   ghost: { item, valid }
 */
export function renderScene(r, room, layout, opts = {}) {
  const o = layout.origin;
  if (r.w !== layout.w || r.h !== layout.h) r.resize(layout.w, layout.h);
  r.clear();
  const wallHex = WALL_COLORS[room.wall];

  // ── Estructura ──
  drawBox(r, o, { x0: -WALL_T, y0: -WALL_T, z0: -SLAB, x1: 0, y1: room.d, z1: WALL_H, c: wallHex, id: ID_WALL_L });
  drawBox(r, o, { x0: 0, y0: -WALL_T, z0: -SLAB, x1: room.w, y1: 0, z1: WALL_H, c: wallHex, id: ID_WALL_R });
  drawBox(r, o, { x0: 0, y0: 0, z0: -SLAB, x1: room.w, y1: room.d, z1: 0, c: SLAB_HEX, id: ID_FLOOR });
  drawFloor(r, o, room);

  const isFloorish = (id) => id === ID_FLOOR || (id > 0 && id <= room.items.length && defOf(room.items[id - 1]).layer === 'rug');

  // Oclusión ambiental junto a las paredes
  r.mul(flatPoly(o, 0, 0, 0.3, room.d), [0.88, 0.88, 0.92], (id) => id === ID_FLOOR);
  r.mul(flatPoly(o, 0.3, 0, room.w, 0.3), [0.9, 0.9, 0.94], (id) => id === ID_FLOOR);

  // Zócalos
  const skirt = '#' + [...hexToRgb(wallHex)].map((v) => Math.round(v * 0.62).toString(16).padStart(2, '0')).join('');
  drawBox(r, o, { x0: 0, y0: 0, z0: 0, x1: 0.05, y1: room.d, z1: 0.16, c: skirt, id: ID_WALL_L });
  drawBox(r, o, { x0: 0.05, y0: 0, z0: 0, x1: room.w, y1: 0.05, z1: 0.16, c: skirt, id: ID_WALL_R });

  // ── Alfombras ──
  room.items.forEach((it, i) => {
    if (defOf(it).layer !== 'rug') return;
    for (const bx of itemBoxes(room, it, i)) drawBox(r, o, bx);
  });

  // ── Luz de día entrando por las ventanas ──
  if (!opts.night) {
    room.items.forEach((it) => {
      const def = defOf(it);
      if (!def.window) return;
      const u0 = it.x + 0.15;
      const u1 = it.x + def.w - 0.15;
      const reach = Math.min(2.4, (it.s === SIDE_L ? room.w : room.d) - 0.05);
      const poly =
        it.s === SIDE_L
          ? [...proj(o, 0.05, u0, 0), ...proj(o, 0.05, u1, 0), ...proj(o, reach, u1 + 0.9, 0), ...proj(o, reach, u0 + 0.9, 0)]
          : [...proj(o, u0, 0.05, 0), ...proj(o, u1, 0.05, 0), ...proj(o, u1 + 0.9, reach, 0), ...proj(o, u0 + 0.9, reach, 0)];
      r.mul(poly, [1.12, 1.1, 1.0], isFloorish);
    });
  }

  // ── Sombras de contacto ──
  room.items.forEach((it) => {
    const def = defOf(it);
    if (def.layer !== 'floor' && !(def.layer === 'deco' && surfaceAt(room, it.x, it.y) === 0)) return;
    const c = cellsOf(it);
    const inset = def.layer === 'deco' ? 0.28 : 0.04;
    r.mul(flatPoly(o, c.x + inset, c.y + inset, c.x + c.w - inset + 0.08, c.y + c.d - inset + 0.08), [0.76, 0.76, 0.84], isFloorish);
  });
  if (opts.avatar && !opts.avatar.sit) {
    const a = opts.avatar;
    r.mul(flatPoly(o, a.x - 0.2, a.y - 0.2, a.x + 0.22, a.y + 0.22), [0.72, 0.72, 0.82], isFloorish);
  }

  // ── Cuadrícula ──
  if (opts.grid) {
    const gc = packHex('#000000');
    for (let x = 0; x <= room.w; x++) r.mixLine(...proj(o, x, 0, 0), ...proj(o, x, room.d, 0), gc, 0.16, isFloorish);
    for (let y = 0; y <= room.d; y++) r.mixLine(...proj(o, 0, y, 0), ...proj(o, room.w, y, 0), gc, 0.16, isFloorish);
  }

  // ── Objetos ordenados ──
  const boxes = [];
  room.items.forEach((it, i) => {
    if (defOf(it).layer === 'rug') return;
    boxes.push(...itemBoxes(room, it, i));
  });
  if (opts.avatar) boxes.push(...avatarBoxes(opts.avatar, opts.look));
  // Orden inicial por profundidad: hace que los empates se resuelvan de forma estable
  boxes.sort((a, b) => a.x0 + a.y0 + a.z0 - (b.x0 + b.y0 + b.z0));
  const polys = boxes.map((bx) => boxPolys(o, bx));
  for (const k of sortBoxes(boxes, polys)) drawBox(r, o, boxes[k], polys[k]);

  // ── Iluminación ──
  if (opts.night) {
    const lights = [];
    room.items.forEach((it, i) => {
      const def = defOf(it);
      if (!def.light || !it.on) return;
      const L = def.light;
      const p = itemAnchor(room, it, i, L.z);
      const [sx, sy] = proj(o, p.x, p.y, p.z);
      lights.push({ x: sx, y: sy, r: L.r, r2: L.r * L.r, i: L.i, c: L.c || WARM });
    });
    r.applyLighting(NIGHT_AMBIENT, lights);
  }

  r.outline(OUTLINE);

  // ── Resaltados ──
  if (opts.hover >= 0 && opts.hover !== opts.selected) r.highlight(opts.hover + 1, WHITE, 0.16, 0);
  if (opts.selected >= 0) r.highlight(opts.selected + 1, WHITE, 0.22, SELECT);
  if (opts.avatarHover) r.highlight(ID_AVATAR, WHITE, 0.2, 0);

  // ── Previsualización ──
  if (opts.ghost) drawGhost(r, o, room, opts.ghost);

  // ── Notas musicales ──
  const t = opts.time || 0;
  room.items.forEach((it, i) => {
    const def = defOf(it);
    if (!def.music || !it.on) return;
    const p = itemAnchor(room, it, i);
    const [sx, sy] = proj(o, p.x, p.y, p.z);
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.55 + k / 3 + i * 0.13) % 1;
      if (ph > 0.92) continue;
      r.sprite(NOTE, sx - 2 + Math.sin(ph * 6.3 + k * 2) * 6, sy - 10 - ph * 30, NOTE_COLORS[(k + i) % NOTE_COLORS.length]);
    }
  });
}

function drawGhost(r, o, room, ghost) {
  const { item, valid } = ghost;
  const def = defOf(item);
  const mark = valid ? OK_HEX : BAD_HEX;
  if (def.layer === 'wall') {
    const z0 = item.z / 4;
    const z1 = z0 + def.h;
    const u0 = item.x;
    const u1 = item.x + def.w;
    const poly =
      item.s === SIDE_L
        ? [...proj(o, 0, u0, z0), ...proj(o, 0, u1, z0), ...proj(o, 0, u1, z1), ...proj(o, 0, u0, z1)]
        : [...proj(o, u0, 0, z0), ...proj(o, u1, 0, z0), ...proj(o, u1, 0, z1), ...proj(o, u0, 0, z1)];
    r.mix(poly, mark, 0.3);
  } else {
    const c = cellsOf(item);
    const z = def.layer === 'deco' ? Math.max(0, surfaceAt(room, item.x, item.y)) : 0;
    r.mix(flatPoly(o, c.x, c.y, c.x + c.w, c.y + c.d, z + 0.01), mark, 0.35);
  }
  const boxes = itemBoxes(room, item, -1);
  boxes.sort((a, b) => a.x0 + a.y0 + a.z0 - (b.x0 + b.y0 + b.z0));
  const polys = boxes.map((bx) => boxPolys(o, bx));
  for (const k of sortBoxes(boxes, polys)) drawBoxGhost(r, o, boxes[k], 0.72, valid ? null : '#ff5c6c');
}

/** Renderiza un item suelto (miniaturas del catálogo e íconos). */
export function renderThumb(r, def, variant = 0, on = null) {
  const item = { t: def.id, x: 0, y: 0, r: 0, v: variant, s: 1, on: on ?? (def.defaultOn ? 1 : 0), z: 0 };
  const fake = { w: 4, d: 4, items: [] };
  const boxes = itemBoxes(fake, item, -1);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const o0 = { x: 0, y: 0 };
  for (const bx of boxes) {
    const p = boxPolys(o0, bx);
    minX = Math.min(minX, p.minX);
    maxX = Math.max(maxX, p.maxX);
    minY = Math.min(minY, p.minY);
    maxY = Math.max(maxY, p.maxY);
  }
  const pad = 2;
  const w = Math.ceil(maxX - minX) + pad * 2;
  const h = Math.ceil(maxY - minY) + pad * 2;
  r.resize(w, h);
  r.clear();
  const o = { x: Math.round(pad - minX), y: Math.round(pad - minY) };
  boxes.sort((a, b) => a.x0 + a.y0 + a.z0 - (b.x0 + b.y0 + b.z0));
  const polys = boxes.map((bx) => boxPolys(o, bx));
  for (const k of sortBoxes(boxes, polys)) drawBox(r, o, boxes[k], polys[k]);
  r.outline(OUTLINE);
  return { w, h };
}
