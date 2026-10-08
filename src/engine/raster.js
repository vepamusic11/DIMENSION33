// Rasterizador por software con píxeles nítidos (sin antialiasing).
// Mantiene tres buffers paralelos:
//   color: Uint32 RGBA empaquetado
//   id:    qué objeto ocupa cada píxel (picking pixel-perfect)
//   glow:  1 si el píxel es emisivo (no se oscurece de noche)
import { mixPacked, mulPacked, pack } from './color.js';

export class Raster {
  constructor(w, h) {
    this.resize(w, h);
  }

  resize(w, h) {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    const n = this.w * this.h;
    this.color = new Uint32Array(n);
    this.id = new Uint16Array(n);
    this.glow = new Uint8Array(n);
  }

  clear() {
    this.color.fill(0);
    this.id.fill(0);
    this.glow.fill(0);
  }

  /**
   * Recorre las filas de un polígono convexo (pts = [x0,y0,x1,y1,...]).
   * Muestreo en el centro del píxel con regla semiabierta: caras vecinas no dejan
   * huecos ni se pisan. cb(y, xs, xe) con xs..xe inclusivo.
   */
  spans(pts, cb) {
    const n = pts.length >> 1;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      if (pts[i] < minY) minY = pts[i];
      if (pts[i] > maxY) maxY = pts[i];
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      let xl = Infinity;
      let xr = -Infinity;
      for (let i = 0; i < n; i++) {
        const ax = pts[2 * i];
        const ay = pts[2 * i + 1];
        const j = (i + 1) % n;
        const bx = pts[2 * j];
        const by = pts[2 * j + 1];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          const x = ax + ((yc - ay) * (bx - ax)) / (by - ay);
          if (x < xl) xl = x;
          if (x > xr) xr = x;
        }
      }
      if (xl >= xr) continue;
      const xs = Math.max(0, Math.ceil(xl - 0.5));
      const xe = Math.min(this.w - 1, Math.ceil(xr - 0.5) - 1);
      if (xs <= xe) cb(y, xs, xe);
    }
  }

  /**
   * Relleno sólido. Si edge != 0, pinta con ese color los píxeles del borde inferior
   * (las aristas frontales de una tapa): el brillo de arista típico del pixel-art iso.
   */
  fill(pts, color, id = 0, glow = 0, edge = 0) {
    const rows = [];
    this.spans(pts, (y, xs, xe) => rows.push(y, xs, xe));
    const W = this.w;
    for (let k = 0; k < rows.length; k += 3) {
      const y = rows[k];
      const xs = rows[k + 1];
      const xe = rows[k + 2];
      const row = y * W;
      // Rango cubierto por la fila siguiente (para detectar el borde inferior)
      let nxs = 1;
      let nxe = 0;
      if (edge && k + 3 < rows.length && rows[k + 3] === y + 1) {
        nxs = rows[k + 4];
        nxe = rows[k + 5];
      }
      for (let x = xs; x <= xe; x++) {
        const i = row + x;
        this.color[i] = edge && (x < nxs || x > nxe) ? edge : color;
        this.id[i] = id;
        this.glow[i] = glow;
      }
    }
  }

  /** Mezcla semitransparente (fantasmas de previsualización, marcas de huella). */
  mix(pts, color, alpha) {
    const a8 = Math.round(alpha * 255);
    this.spans(pts, (y, xs, xe) => {
      const row = y * this.w;
      for (let x = xs; x <= xe; x++) {
        const i = row + x;
        const d = this.color[i];
        this.color[i] = d >>> 24 ? mixPacked(d, color, alpha) : ((color & 0xffffff) | (a8 << 24)) >>> 0;
      }
    });
  }

  /** Multiplica el color existente (sombras) solo donde pred(id) es verdadero. */
  mul(pts, f, pred = null) {
    this.spans(pts, (y, xs, xe) => {
      const row = y * this.w;
      for (let x = xs; x <= xe; x++) {
        const i = row + x;
        const d = this.color[i];
        if (!(d >>> 24)) continue;
        if (pred && !pred(this.id[i])) continue;
        this.color[i] = mulPacked(d, f[0], f[1], f[2]);
      }
    });
  }

  /** Línea Bresenham mezclada; útil para la cuadrícula del piso. */
  mixLine(x0, y0, x1, y1, color, alpha, pred = null) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 >= 0 && y0 >= 0 && x0 < this.w && y0 < this.h) {
        const i = y0 * this.w + x0;
        if (this.color[i] >>> 24 && (!pred || pred(this.id[i]))) {
          this.color[i] = mixPacked(this.color[i], color, alpha);
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Dibuja un bitmap 1-bit (array de strings con '#') en color sólido. */
  sprite(rows, x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    for (let r = 0; r < rows.length; r++) {
      const line = rows[r];
      for (let c = 0; c < line.length; c++) {
        if (line[c] !== '#') continue;
        const px = x + c;
        const py = y + r;
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        this.color[py * this.w + px] = color;
      }
    }
  }

  /**
   * Iluminación nocturna: color * (ambiente + Σ luces). Las luces son elipses 2:1
   * (forma de charco de luz en iso). Los píxeles emisivos conservan su color.
   */
  applyLighting(ambient, lights) {
    const { w, h, color, glow } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = color[i];
        if (!(c >>> 24) || glow[i]) continue;
        let lr = ambient[0];
        let lg = ambient[1];
        let lb = ambient[2];
        for (let k = 0; k < lights.length; k++) {
          const L = lights[k];
          const dx = x - L.x;
          const dy = (y - L.y) * 1.6;
          const d2 = dx * dx + dy * dy;
          if (d2 >= L.r2) continue;
          const t = 1 - Math.sqrt(d2) / L.r;
          const f = t * t * L.i;
          lr += f * L.c[0];
          lg += f * L.c[1];
          lb += f * L.c[2];
        }
        color[i] = pack(
          (c & 255) * Math.min(lr, 1.25),
          ((c >>> 8) & 255) * Math.min(lg, 1.25),
          ((c >>> 16) & 255) * Math.min(lb, 1.25),
          c >>> 24,
        );
      }
    }
  }

  /** Contorno exterior de 1 px alrededor de la silueta completa (look "sticker"). */
  outline(color) {
    const { w, h } = this;
    const a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = this.color[i] >>> 24 > 200 ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (a[i]) continue;
        if ((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w])) {
          this.color[i] = color;
        }
      }
    }
  }

  /** Resalta los píxeles de un id: aclara el interior y dibuja su contorno. */
  highlight(id, tint, alpha, outlineColor) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (this.id[i] !== id) continue;
        const border =
          outlineColor &&
          (x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            this.id[i - 1] !== id || this.id[i + 1] !== id || this.id[i - w] !== id || this.id[i + w] !== id);
        this.color[i] = border ? outlineColor : mixPacked(this.color[i], tint, alpha);
      }
    }
  }

  /** Copia a un ImageData (navegador) o devuelve los bytes RGBA (Node). */
  bytes() {
    return new Uint8ClampedArray(this.color.buffer, this.color.byteOffset, this.color.byteLength);
  }
}
