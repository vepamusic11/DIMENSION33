// Proyección isométrica (dimétrica 2:1) y dibujo de cajas.
//
// Sistema de coordenadas del mundo (en tiles):
//   x → hacia abajo-derecha en pantalla
//   y → hacia abajo-izquierda en pantalla
//   z → hacia arriba
// La cámara mira desde +x +y +z, así que de cada caja se ven 3 caras:
//   tapa (z = z1), cara "derecha" (x = x1) y cara "izquierda" (y = y1).
import { HW, HH, UNIT_Z } from './config.js';
import { faceColors, mixPacked, packHex } from './color.js';

export function proj(o, x, y, z) {
  return [o.x + (x - y) * HW, o.y + (x + y) * HH - z * UNIT_Z];
}

/** Inversa de la proyección sobre el plano horizontal de altura z. */
export function unproj(o, sx, sy, z = 0) {
  const a = (sx - o.x) / HW;
  const b = (sy - o.y + z * UNIT_Z) / HH;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Polígonos en pantalla de las 3 caras visibles y su caja envolvente. */
export function boxPolys(o, b) {
  const t00 = proj(o, b.x0, b.y0, b.z1);
  const t10 = proj(o, b.x1, b.y0, b.z1);
  const t11 = proj(o, b.x1, b.y1, b.z1);
  const t01 = proj(o, b.x0, b.y1, b.z1);
  const b10 = proj(o, b.x1, b.y0, b.z0);
  const b11 = proj(o, b.x1, b.y1, b.z0);
  const b01 = proj(o, b.x0, b.y1, b.z0);
  return {
    top: [t00[0], t00[1], t10[0], t10[1], t11[0], t11[1], t01[0], t01[1]],
    right: [t10[0], t10[1], t11[0], t11[1], b11[0], b11[1], b10[0], b10[1]],
    left: [t01[0], t01[1], t11[0], t11[1], b11[0], b11[1], b01[0], b01[1]],
    minX: t01[0],
    maxX: t10[0],
    minY: t00[1],
    maxY: b11[1],
  };
}

/** Polígono en pantalla de un rectángulo horizontal a altura z. */
export function flatPoly(o, x0, y0, x1, y1, z = 0) {
  const a = proj(o, x0, y0, z);
  const b = proj(o, x1, y0, z);
  const c = proj(o, x1, y1, z);
  const d = proj(o, x0, y1, z);
  return [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]];
}

/**
 * Dibuja una caja. b = {x0,y0,z0,x1,y1,z1,c:'#hex', id?, glow?, noEdge?}
 */
export function drawBox(r, o, b, polys = boxPolys(o, b)) {
  const fc = faceColors(b.c);
  const id = b.id || 0;
  const glow = b.glow ? 1 : 0;
  if (b.z1 - b.z0 > 0.001) {
    r.fill(polys.left, fc.left, id, glow);
    r.fill(polys.right, fc.right, id, glow);
  }
  r.fill(polys.top, fc.top, id, glow, b.noEdge ? 0 : fc.edge);
}

/** Versión translúcida para previsualizar (opcionalmente teñida de rojo si es inválida). */
export function drawBoxGhost(r, o, b, alpha, tintHex = null) {
  const p = boxPolys(o, b);
  const fc = faceColors(b.c);
  const tint = tintHex ? packHex(tintHex) : 0;
  const t = (c) => (tint ? mixPacked(c, tint, 0.55) : c);
  if (b.z1 - b.z0 > 0.001) {
    r.mix(p.left, t(fc.left), alpha);
    r.mix(p.right, t(fc.right), alpha);
  }
  r.mix(p.top, t(fc.top), alpha);
}

/**
 * Orden de pintado correcto para cajas que no se intersecan:
 * si existe un eje que las separa, la de menor coordenada en ese eje queda detrás.
 */
function compareBoxes(a, b) {
  const e = 1e-4;
  if (a.x1 <= b.x0 + e) return -1;
  if (b.x1 <= a.x0 + e) return 1;
  if (a.y1 <= b.y0 + e) return -1;
  if (b.y1 <= a.y0 + e) return 1;
  if (a.z1 <= b.z0 + e) return -1;
  if (b.z1 <= a.z0 + e) return 1;
  // Se intersecan: aproximación por profundidad del centro.
  return a.x0 + a.x1 + a.y0 + a.y1 + a.z0 + a.z1 - (b.x0 + b.x1 + b.y0 + b.y1 + b.z0 + b.z1);
}

/**
 * Ordenamiento topológico (algoritmo del pintor robusto). Solo se comparan las
 * cajas cuyas envolventes en pantalla se superponen. Devuelve los índices en orden de dibujo.
 */
export function sortBoxes(boxes, polys) {
  const n = boxes.length;
  const behind = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const pi = polys[i];
    for (let j = i + 1; j < n; j++) {
      const pj = polys[j];
      if (pi.maxX <= pj.minX || pj.maxX <= pi.minX || pi.maxY <= pj.minY || pj.maxY <= pi.minY) continue;
      const c = compareBoxes(boxes[i], boxes[j]);
      if (c < 0) behind[j].push(i);
      else if (c > 0) behind[i].push(j);
    }
  }
  const state = new Uint8Array(n); // 0 = sin visitar, 1 = en curso, 2 = listo
  const out = [];
  const visit = (start) => {
    // DFS iterativo para no desbordar la pila con escenas grandes
    const stack = [[start, 0]];
    state[start] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const deps = behind[top[0]];
      if (top[1] < deps.length) {
        const k = deps[top[1]++];
        if (state[k] === 0) {
          state[k] = 1;
          stack.push([k, 0]);
        }
      } else {
        state[top[0]] = 2;
        out.push(top[0]);
        stack.pop();
      }
    }
  };
  for (let i = 0; i < n; i++) if (state[i] === 0) visit(i);
  return out;
}
