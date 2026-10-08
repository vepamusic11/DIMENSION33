// Utilidades de color. Los colores se empaquetan como Uint32 en orden de bytes RGBA
// (little-endian → 0xAABBGGRR), listo para escribir directo sobre un ImageData.

const cache = new Map();
const SHADOW_TINT = [40, 36, 96];
const LIGHT_TINT = [255, 246, 222];

export const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function pack(r, g, b, a = 255) {
  return ((clamp8(a) << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
}

export function packRgb(rgb, a = 255) {
  return pack(rgb[0], rgb[1], rgb[2], a);
}

export function packHex(hex, a = 255) {
  return packRgb(hexToRgb(hex), a);
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

/**
 * Colores de las 3 caras visibles de una caja + color de brillo de arista.
 * Luz desde arriba-izquierda: tapa clara, cara izquierda base, cara derecha en sombra
 * (con leve desplazamiento hacia azul, práctica habitual en pixel-art).
 */
export function faceColors(hex) {
  let f = cache.get(hex);
  if (f) return f;
  const c = hexToRgb(hex);
  f = {
    top: packRgb(mix(scale(c, 1.07), LIGHT_TINT, 0.1)),
    left: packRgb(c),
    right: packRgb(mix(scale(c, 0.72), SHADOW_TINT, 0.14)),
    edge: packRgb(mix(scale(c, 1.2), LIGHT_TINT, 0.28)),
  };
  cache.set(hex, f);
  return f;
}

/** Mezcla src sobre dst (ambos empaquetados) con opacidad t. */
export function mixPacked(dst, src, t) {
  const it = 1 - t;
  return pack(
    (dst & 255) * it + (src & 255) * t,
    ((dst >>> 8) & 255) * it + ((src >>> 8) & 255) * t,
    ((dst >>> 16) & 255) * it + ((src >>> 16) & 255) * t,
    255,
  );
}

/** Multiplica los canales RGB de un color empaquetado. */
export function mulPacked(c, r, g = r, b = r) {
  return pack((c & 255) * r, ((c >>> 8) & 255) * g, ((c >>> 16) & 255) * b, c >>> 24);
}
