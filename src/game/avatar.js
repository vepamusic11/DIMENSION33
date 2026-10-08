// Personaje jugable: movimiento por camino, animación de caminar y pose sentada.
// Todo el cuerpo son cajas, así se ordena con el resto de la escena sin casos especiales.
import { ID_AVATAR } from '../engine/config.js';

export const LOOKS = [
  { name: 'Clásico', shirt: '#e76f51', pants: '#264653', skin: '#f1c7a5', hair: '#3b2a20', shoes: '#1f1f24' },
  { name: 'Músico', shirt: '#1d1d2b', pants: '#3a3a4a', skin: '#c68b62', hair: '#121212', shoes: '#e9e5dc' },
  { name: 'Verano', shirt: '#2a9d8f', pants: '#e9c46a', skin: '#e8b48f', hair: '#d4a24c', shoes: '#7a4b2e' },
  { name: 'Nocturno', shirt: '#7b5ea7', pants: '#22223b', skin: '#8d5b3e', hair: '#f2e9e4', shoes: '#22223b' },
];

// dir: 0 = +y, 1 = +x, 2 = -y, 3 = -x (hacia dónde mira)
const DIR_VEC = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export function createAvatar(cellX, cellY) {
  return {
    x: cellX + 0.5,
    y: cellY + 0.5,
    z: 0,
    dir: 0,
    path: [],
    speed: 3.2, // tiles por segundo
    t: 0,
    walking: false,
    sit: null, // { x, y, z, dir, item }
    action: null, // acción a ejecutar al llegar
  };
}

export function cellOf(a) {
  return { x: Math.floor(a.x), y: Math.floor(a.y) };
}

export function dirTowards(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 0 : 2;
}

/** Avanza la simulación. Devuelve la acción pendiente cuando el personaje llega. */
export function updateAvatar(a, dt) {
  a.t += dt;
  if (a.sit) {
    a.walking = false;
    return null;
  }
  if (a.path.length) {
    const next = a.path[0];
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dist = Math.hypot(dx, dy);
    const step = a.speed * dt;
    if (dist > 1e-3) a.dir = dirTowards(dx, dy);
    if (dist <= step) {
      a.x = tx;
      a.y = ty;
      a.path.shift();
    } else {
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
    }
    a.walking = true;
    return null;
  }
  a.walking = false;
  if (a.action) {
    const act = a.action;
    a.action = null;
    return act;
  }
  return null;
}

export function sitOn(a, spot) {
  a.path = [];
  a.sit = spot;
}

export function standUp(a) {
  if (!a.sit) return;
  a.sit = null;
}

// Transforma una caja local (mirando a +y, centrada en 0,0) según la dirección.
function orient(lb, dir) {
  const pts = [
    [lb[0], lb[1]],
    [lb[3], lb[4]],
  ].map(([x, y]) => {
    switch (dir) {
      case 1: return [y, -x];
      case 2: return [-x, -y];
      case 3: return [-y, x];
      default: return [x, y];
    }
  });
  return {
    x0: Math.min(pts[0][0], pts[1][0]),
    x1: Math.max(pts[0][0], pts[1][0]),
    y0: Math.min(pts[0][1], pts[1][1]),
    y1: Math.max(pts[0][1], pts[1][1]),
    z0: lb[2],
    z1: lb[5],
  };
}

/** Cajas del personaje en coordenadas de mundo. */
export function avatarBoxes(a, look) {
  const L = look || LOOKS[0];
  const sitting = !!a.sit;
  const px = sitting ? a.sit.x : a.x;
  const py = sitting ? a.sit.y : a.y;
  const dir = sitting ? a.sit.dir : a.dir;
  const baseZ = sitting ? a.sit.z - 0.5 : 0;
  const phase = a.walking ? Math.sin(a.t * 12) : 0;
  const bob = a.walking ? Math.abs(Math.cos(a.t * 12)) * 0.04 : Math.sin(a.t * 2) * 0.008;
  const swing = phase * 0.07;

  // [x0, y0, z0, x1, y1, z1, color]
  const parts = [];
  if (sitting) {
    const floor = 0.5 - a.sit.z;
    parts.push(
      [-0.13, -0.06, 0.5, -0.02, 0.3, 0.6, L.pants], [0.02, -0.06, 0.5, 0.13, 0.3, 0.6, L.pants],
      [-0.13, 0.24, floor + 0.08, -0.02, 0.34, 0.5, L.pants], [0.02, 0.24, floor + 0.08, 0.13, 0.34, 0.5, L.pants],
      [-0.13, 0.24, floor, -0.02, 0.38, floor + 0.08, L.shoes], [0.02, 0.24, floor, 0.13, 0.38, floor + 0.08, L.shoes],
    );
  } else {
    parts.push(
      [-0.13, -0.06 + swing, 0.08, -0.02, 0.06 + swing, 0.5, L.pants],
      [0.02, -0.06 - swing, 0.08, 0.13, 0.06 - swing, 0.5, L.pants],
      [-0.13, -0.06 + swing, 0, -0.02, 0.08 + swing, 0.08, L.shoes],
      [0.02, -0.06 - swing, 0, 0.13, 0.08 - swing, 0.08, L.shoes],
    );
  }
  const tz = sitting ? 0.6 : 0.5;
  parts.push(
    [-0.17, -0.09, tz, 0.17, 0.09, tz + 0.46, L.shirt],
    [-0.25, -0.06 - swing, tz + 0.06, -0.17, 0.06 - swing, tz + 0.42, L.shirt],
    [0.17, -0.06 + swing, tz + 0.06, 0.25, 0.06 + swing, tz + 0.42, L.shirt],
    [-0.25, -0.06 - swing, tz - 0.02, -0.17, 0.06 - swing, tz + 0.06, L.skin],
    [0.17, -0.06 + swing, tz - 0.02, 0.25, 0.06 + swing, tz + 0.06, L.skin],
    [-0.15, -0.14, tz + 0.46, 0.15, 0.14, tz + 0.78, L.skin],
    [-0.16, -0.16, tz + 0.78, 0.16, 0.16, tz + 0.86, L.hair],
    [-0.16, -0.17, tz + 0.56, 0.16, -0.14, tz + 0.78, L.hair],
    [-0.09, 0.14, tz + 0.6, -0.05, 0.15, tz + 0.66, '#1b1b22'],
    [0.05, 0.14, tz + 0.6, 0.09, 0.15, tz + 0.66, '#1b1b22'],
  );

  return parts.map((p) => {
    const o = orient(p, dir);
    return {
      x0: px + o.x0,
      x1: px + o.x1,
      y0: py + o.y0,
      y1: py + o.y1,
      z0: baseZ + o.z0 + bob,
      z1: baseZ + o.z1 + bob,
      c: p[6],
      id: ID_AVATAR,
    };
  });
}

export function facingVector(dir) {
  return DIR_VEC[dir & 3];
}
