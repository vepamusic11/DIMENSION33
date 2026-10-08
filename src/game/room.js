// Modelo de la habitación: datos puros + reglas de colocación + (de)serialización.
// No toca el DOM, así se testea en Node.
import { ROOM_MIN, ROOM_MAX, MAX_ITEMS, HASH_MAX, WALL_H } from '../engine/config.js';
import { ITEMS_BY_ID, footprintSize, WALL_COLORS, FLOOR_COLORS, FLOOR_STYLES } from './catalog.js';

const FORMAT_VERSION = 1;
const SIDE_L = 0; // pared sobre el plano x = 0 (corre a lo largo de y)
const SIDE_R = 1; // pared sobre el plano y = 0 (corre a lo largo de x)
export { SIDE_L, SIDE_R };

export function createRoom(w = 9, d = 9) {
  return { w, d, wall: 0, floorStyle: 0, floor: 0, items: [] };
}

/**
 * Un item es: { t: id de catálogo, x, y, r: rotación 0-3, v: variante, s: lado de pared, on: 0|1, z: cuartos de unidad }
 * Para 'wall', x = posición a lo largo de la pared e y no se usa.
 */
export function makeItem(def, extra = {}) {
  return { t: def.id, x: 0, y: 0, r: 0, v: 0, s: SIDE_R, on: def.defaultOn ? 1 : 0, z: def.layer === 'wall' ? Math.round((def.z || 0) * 4) : 0, ...extra };
}

export const cloneRoom = (room) => ({ ...room, items: room.items.map((it) => ({ ...it })) });

export function defOf(item) {
  return ITEMS_BY_ID.get(item.t);
}

/** Rectángulo de celdas que ocupa un item de piso/alfombra/deco. */
export function cellsOf(item) {
  const def = defOf(item);
  const fp = def.layer === 'deco' ? { w: 1, d: 1 } : footprintSize(def, item.r);
  return { x: item.x, y: item.y, w: fp.w, d: fp.d };
}

/** Rango de un item de pared: {side, u0, u1, z0, z1} en unidades de mundo. */
export function wallSpan(item) {
  const def = defOf(item);
  const z0 = item.z / 4;
  return { side: item.s, u0: item.x, u1: item.x + def.w, z0, z1: z0 + def.h };
}

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
const inCell = (c, x, y) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.d;

/** Mueble (capa 'floor') que ocupa la celda, o -1. */
export function floorItemAt(room, x, y, ignore = -1) {
  for (let i = 0; i < room.items.length; i++) {
    if (i === ignore) continue;
    const it = room.items[i];
    const def = defOf(it);
    if (def.layer === 'floor' && inCell(cellsOf(it), x, y)) return i;
  }
  return -1;
}

/** Altura de apoyo para un objeto 'deco' en la celda (0 = piso). -1 si no se puede apoyar. */
export function surfaceAt(room, x, y, ignore = -1) {
  const i = floorItemAt(room, x, y, ignore);
  if (i < 0) return 0;
  const def = defOf(room.items[i]);
  return def.surface ? def.surface : -1;
}

/**
 * Valida si `item` puede estar en la habitación (ignorando el índice `ignore`,
 * útil al mover/rotar). Devuelve { ok, reason }.
 */
export function canPlace(room, item, ignore = -1) {
  const def = defOf(item);
  if (!def) return { ok: false, reason: 'Objeto desconocido' };
  if (room.items.length - (ignore >= 0 ? 1 : 0) >= MAX_ITEMS) return { ok: false, reason: `Máximo ${MAX_ITEMS} objetos` };

  if (def.layer === 'wall') {
    const s = wallSpan(item);
    const len = s.side === SIDE_L ? room.d : room.w;
    if (s.u0 < 0 || s.u1 > len) return { ok: false, reason: 'Fuera de la pared' };
    if (s.z0 < 0 || s.z1 > WALL_H + 1e-6) return { ok: false, reason: 'No entra en la altura de la pared' };
    for (let i = 0; i < room.items.length; i++) {
      if (i === ignore) continue;
      const o = room.items[i];
      if (defOf(o).layer !== 'wall' || o.s !== s.side) continue;
      const q = wallSpan(o);
      if (s.u0 < q.u1 && q.u0 < s.u1 && s.z0 < q.z1 - 1e-6 && q.z0 < s.z1 - 1e-6) return { ok: false, reason: 'Se superpone con otro objeto de la pared' };
    }
    return { ok: true };
  }

  const c = cellsOf(item);
  if (c.x < 0 || c.y < 0 || c.x + c.w > room.w || c.y + c.d > room.d) return { ok: false, reason: 'Fuera de la habitación' };

  for (let i = 0; i < room.items.length; i++) {
    if (i === ignore) continue;
    const o = room.items[i];
    const od = defOf(o);
    if (od.layer === 'wall') continue;
    const oc = cellsOf(o);
    if (!overlap(c, oc)) continue;
    if (def.layer === 'rug' && od.layer === 'rug') return { ok: false, reason: 'Ya hay una alfombra ahí' };
    if (def.layer === 'floor' && od.layer === 'floor') return { ok: false, reason: 'Ese lugar está ocupado' };
    if (def.layer === 'floor' && od.layer === 'deco' && !def.surface) return { ok: false, reason: 'Hay un objeto en el piso' };
    if (def.layer === 'deco' && od.layer === 'deco') return { ok: false, reason: 'Ya hay un objeto ahí' };
    if (def.layer === 'deco' && od.layer === 'floor' && !od.surface) return { ok: false, reason: 'No se puede apoyar ahí' };
  }
  return { ok: true };
}

/** Grilla de celdas bloqueadas para caminar (1 = bloqueada). */
export function blockedGrid(room) {
  const g = new Uint8Array(room.w * room.d);
  for (const it of room.items) {
    const def = defOf(it);
    if (def.layer !== 'floor' && def.layer !== 'deco') continue;
    const c = cellsOf(it);
    for (let y = c.y; y < c.y + c.d; y++) for (let x = c.x; x < c.x + c.w; x++) g[y * room.w + x] = 1;
  }
  return g;
}

/** Cambia el tamaño y descarta lo que queda afuera. Devuelve cuántos objetos se quitaron. */
export function resizeRoom(room, w, d) {
  room.w = clampInt(w, ROOM_MIN, ROOM_MAX);
  room.d = clampInt(d, ROOM_MIN, ROOM_MAX);
  const before = room.items.length;
  const kept = [];
  for (const it of room.items) {
    const probe = { ...room, items: kept };
    if (canPlace(probe, it).ok) kept.push(it);
  }
  room.items = kept;
  return before - kept.length;
}

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

// ─────────────────────────── Serialización ───────────────────────────
// Formato binario compacto → base64url. Cabecera de 7 bytes + 5 bytes por item.
//   [ver, w, d, wall, floorStyle, floor, count] + count × [t, x, y, flags, z]
//   flags = r (2 bits) | v << 2 (3 bits) | s << 5 (1 bit) | on << 6 (1 bit)

export function encodeRoom(room) {
  const n = Math.min(room.items.length, MAX_ITEMS);
  const bytes = new Uint8Array(7 + n * 5);
  bytes.set([FORMAT_VERSION, room.w, room.d, room.wall, room.floorStyle, room.floor, n]);
  for (let i = 0; i < n; i++) {
    const it = room.items[i];
    const o = 7 + i * 5;
    bytes[o] = it.t;
    bytes[o + 1] = it.x;
    bytes[o + 2] = it.y;
    bytes[o + 3] = (it.r & 3) | ((it.v & 7) << 2) | ((it.s & 1) << 5) | ((it.on & 1) << 6);
    bytes[o + 4] = it.z;
  }
  return toBase64Url(bytes);
}

/**
 * Decodifica y VALIDA datos externos (vienen de la URL o de localStorage, que el
 * usuario puede manipular). Nunca lanza: devuelve null si el formato no es válido.
 * Los objetos inválidos o superpuestos se descartan en silencio.
 */
export function decodeRoom(str) {
  try {
    if (typeof str !== 'string' || str.length === 0 || str.length > HASH_MAX) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(str)) return null;
    const bytes = fromBase64Url(str);
    if (bytes.length < 7 || bytes[0] !== FORMAT_VERSION) return null;
    const [, w, d, wall, floorStyle, floor, count] = bytes;
    if (w < ROOM_MIN || w > ROOM_MAX || d < ROOM_MIN || d > ROOM_MAX) return null;
    if (count > MAX_ITEMS || bytes.length < 7 + count * 5) return null;
    const room = {
      w,
      d,
      wall: wall < WALL_COLORS.length ? wall : 0,
      floorStyle: floorStyle < FLOOR_STYLES.length ? floorStyle : 0,
      floor: floor < FLOOR_COLORS.length ? floor : 0,
      items: [],
    };
    for (let i = 0; i < count; i++) {
      const o = 7 + i * 5;
      const def = ITEMS_BY_ID.get(bytes[o]);
      if (!def) continue;
      const f = bytes[o + 3];
      const it = {
        t: def.id,
        x: bytes[o + 1],
        y: def.layer === 'wall' ? 0 : bytes[o + 2],
        r: def.layer === 'wall' ? 0 : f & 3,
        v: Math.min((f >> 2) & 7, def.variants.length - 1),
        s: (f >> 5) & 1,
        on: (f >> 6) & 1,
        z: def.layer === 'wall' ? (def.fixedZ ? Math.round(def.z * 4) : bytes[o + 4]) : 0,
      };
      if (canPlace(room, it).ok) room.items.push(it);
    }
    return room;
  } catch {
    return null;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

export function fromBase64Url(str) {
  const len = Math.floor((str.length * 3) / 4);
  const out = new Uint8Array(len);
  let buf = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < str.length; i++) {
    const v = B64.indexOf(str[i]);
    if (v < 0) throw new Error('base64 inválido');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (o < len) out[o++] = (buf >> bits) & 255;
    }
  }
  return out.subarray(0, o);
}
