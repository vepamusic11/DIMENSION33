// Codificador PNG mínimo (sin dependencias) para generar íconos y capturas desde Node.
import { deflateSync } from 'node:zlib';

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/**
 * rgba: Uint8Array/ClampedArray de w*h*4. scale: ampliación con vecino más cercano
 * (o un tamaño final exacto con `size`, para íconos).
 */
export function encodePng(rgba, w, h, scale = 1, bg = null, size = null) {
  const W = size ?? Math.round(w * scale);
  const H = size ?? Math.round(h * scale);
  scale = W / w;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    raw[row] = 0;
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < W; x++) {
      const si = (sy * w + Math.min(w - 1, Math.floor(x / scale))) * 4;
      const di = row + 1 + x * 4;
      let [r, g, b, a] = [rgba[si], rgba[si + 1], rgba[si + 2], rgba[si + 3]];
      if (bg && a < 255) {
        const t = a / 255;
        r = Math.round(r * t + bg[0] * (1 - t));
        g = Math.round(g * t + bg[1] * (1 - t));
        b = Math.round(b * t + bg[2] * (1 - t));
        a = 255;
      }
      raw[di] = r;
      raw[di + 1] = g;
      raw[di + 2] = b;
      raw[di + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
