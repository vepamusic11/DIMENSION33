// Catálogo de objetos. Todo se modela con cajas (sin imágenes externas), así cada
// objeto se puede rotar, recolorear y renderizar a cualquier escala sin perder nitidez.
//
// Campos de una definición:
//   id       número estable (se guarda en la URL: NUNCA reutilizar ni cambiar)
//   key      identificador legible
//   name     nombre visible
//   cat      categoría de la pestaña del catálogo
//   layer    'floor' (mueble, ocupa celdas) | 'rug' (alfombra, debajo de todo)
//            'deco' (objeto chico, va en el piso o sobre una superficie) | 'wall' (en la pared)
//   w, d     huella en tiles (para 'wall': w = ancho a lo largo de la pared, h = alto)
//   surface  altura de la superficie donde se apoyan objetos 'deco' (0 = no admite)
//   seat     altura del asiento si se puede sentar
//   interact 'sit' | 'toggle' | 'look'
//   light    {x, y, z, r, i} luz cuando está encendido
//   music    true si reproduce música al encenderse
//   variants paleta de colores intercambiable (slots a, b, c, d)
//   boxes    cajas en coordenadas locales (rotación 0). Para 'wall': (u, v, z) =
//            (a lo largo de la pared, hacia afuera de la pared, altura relativa)
//            Opciones por caja: glow (emisiva al encender), on ('#hex' color encendido).

const b = (x0, y0, z0, x1, y1, z1, c, opt) => ({ x0, y0, z0, x1, y1, z1, c, ...opt });

// Generador pseudoaleatorio determinista (para lomos de libros, etc.)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BOOK_COLORS = ['#c0392b', '#2e86de', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#34495e', '#d35400'];

function bookRow(x0, x1, y0, y1, z, maxH, seed) {
  const r = rng(seed);
  const out = [];
  let x = x0;
  while (x < x1 - 0.05) {
    const w = 0.05 + r() * 0.05;
    const x2 = Math.min(x1, x + w);
    const h = maxH * (0.62 + r() * 0.38);
    out.push(b(x, y0 + r() * 0.04, z, x2, y1, z + h, BOOK_COLORS[(r() * BOOK_COLORS.length) | 0]));
    x = x2 + (r() < 0.15 ? 0.04 : 0);
  }
  return out;
}

const WOODS = [
  { a: '#8a5a3b', b: '#a8714a', c: '#d9b26b' },
  { a: '#e6e0d4', b: '#f4f0e7', c: '#b9ad97' },
  { a: '#2f2b33', b: '#47414f', c: '#c9a24a' },
  { a: '#b5463c', b: '#d0614f', c: '#f0c987' },
];

const FABRICS = [
  { a: '#4f7f78', b: '#61988e' },
  { a: '#c2793f', b: '#d68f55' },
  { a: '#5b5f97', b: '#7378ae' },
  { a: '#9a9aa2', b: '#b5b5bc' },
  { a: '#b0555f', b: '#c76d76' },
];

const RUGS = [
  { a: '#8c3b3b', b: '#c9a46a', c: '#8c3b3b' },
  { a: '#2f4b6e', b: '#e7dcc5', c: '#5c84b1' },
  { a: '#4d6b4a', b: '#d9cba3', c: '#a8643f' },
  { a: '#5c4b7d', b: '#e6cfd8', c: '#c97b95' },
];

function sofaBoxes(len) {
  const L = len - 0.06;
  const out = [
    b(0.06, 0.12, 0, L, 0.94, 0.36, 'a'),
    b(0.06, 0.12, 0.36, L, 0.32, 1.0, 'a'),
    b(0.06, 0.32, 0.36, 0.24, 0.94, 0.64, 'a'),
    b(L - 0.18, 0.32, 0.36, L, 0.94, 0.64, 'a'),
  ];
  const inner0 = 0.24;
  const inner1 = L - 0.18;
  const n = Math.max(1, Math.round(len));
  const seg = (inner1 - inner0) / n;
  for (let i = 0; i < n; i++) {
    out.push(b(inner0 + i * seg + (i ? 0.01 : 0), 0.32, 0.36, inner0 + (i + 1) * seg - (i < n - 1 ? 0.01 : 0), 0.92, 0.5, 'b'));
  }
  return out;
}

function rugBoxes(w, d) {
  return [
    b(0.08, 0.08, 0, w - 0.08, d - 0.08, 0.03, 'a', { noEdge: true }),
    b(0.24, 0.24, 0.03, w - 0.24, d - 0.24, 0.045, 'b', { noEdge: true }),
    b(w * 0.3, d * 0.3, 0.045, w * 0.7, d * 0.7, 0.055, 'c', { noEdge: true }),
  ];
}

export const CATEGORIES = [
  { key: 'muebles', name: 'Muebles' },
  { key: 'cocina', name: 'Cocina' },
  { key: 'deco', name: 'Deco' },
  { key: 'musica', name: 'Música' },
  { key: 'alfombras', name: 'Alfombras' },
  { key: 'pared', name: 'Pared' },
];

export const ITEMS = [
  // ───────────── Muebles ─────────────
  {
    id: 1, key: 'chair', name: 'Silla', cat: 'muebles', layer: 'floor', w: 1, d: 1, seat: 0.53, interact: 'sit',
    variants: WOODS,
    boxes: [
      b(0.2, 0.2, 0, 0.28, 0.28, 0.45, 'a'), b(0.72, 0.2, 0, 0.8, 0.28, 0.45, 'a'),
      b(0.2, 0.72, 0, 0.28, 0.8, 0.45, 'a'), b(0.72, 0.72, 0, 0.8, 0.8, 0.45, 'a'),
      b(0.16, 0.16, 0.45, 0.84, 0.84, 0.53, 'b'),
      b(0.16, 0.16, 0.53, 0.84, 0.25, 1.12, 'a'),
    ],
  },
  {
    id: 2, key: 'armchair', name: 'Sillón', cat: 'muebles', layer: 'floor', w: 1, d: 1, seat: 0.5, interact: 'sit',
    variants: FABRICS, boxes: sofaBoxes(1),
  },
  {
    id: 3, key: 'sofa', name: 'Sofá', cat: 'muebles', layer: 'floor', w: 2, d: 1, seat: 0.5, interact: 'sit',
    variants: FABRICS, boxes: sofaBoxes(2),
  },
  {
    id: 4, key: 'table', name: 'Mesa', cat: 'muebles', layer: 'floor', w: 1, d: 1, surface: 0.8,
    variants: WOODS,
    boxes: [
      b(0.12, 0.12, 0, 0.2, 0.2, 0.72, 'a'), b(0.8, 0.12, 0, 0.88, 0.2, 0.72, 'a'),
      b(0.12, 0.8, 0, 0.2, 0.88, 0.72, 'a'), b(0.8, 0.8, 0, 0.88, 0.88, 0.72, 'a'),
      b(0.06, 0.06, 0.72, 0.94, 0.94, 0.8, 'b'),
    ],
  },
  {
    id: 5, key: 'dining', name: 'Mesa larga', cat: 'muebles', layer: 'floor', w: 2, d: 1, surface: 0.8,
    variants: WOODS,
    boxes: [
      b(0.12, 0.14, 0, 0.2, 0.22, 0.72, 'a'), b(1.8, 0.14, 0, 1.88, 0.22, 0.72, 'a'),
      b(0.12, 0.78, 0, 0.2, 0.86, 0.72, 'a'), b(1.8, 0.78, 0, 1.88, 0.86, 0.72, 'a'),
      b(0.06, 0.08, 0.72, 1.94, 0.92, 0.8, 'b'),
    ],
  },
  {
    id: 6, key: 'desk', name: 'Escritorio', cat: 'muebles', layer: 'floor', w: 2, d: 1, surface: 0.8,
    variants: WOODS,
    boxes: [
      b(0.1, 0.14, 0, 0.18, 0.22, 0.74, 'a'), b(0.1, 0.78, 0, 0.18, 0.86, 0.74, 'a'),
      b(1.3, 0.12, 0, 1.9, 0.88, 0.74, 'a'),
      b(1.36, 0.88, 0.42, 1.84, 0.9, 0.66, 'b'), b(1.36, 0.88, 0.1, 1.84, 0.9, 0.36, 'b'),
      b(1.56, 0.9, 0.52, 1.64, 0.93, 0.56, 'c'), b(1.56, 0.9, 0.21, 1.64, 0.93, 0.25, 'c'),
      b(0.04, 0.08, 0.74, 1.96, 0.92, 0.8, 'b'),
    ],
  },
  {
    id: 7, key: 'bed', name: 'Cama', cat: 'muebles', layer: 'floor', w: 2, d: 3, seat: 0.52, interact: 'sit',
    variants: [
      { a: '#7a5136', b: '#5f8fbf', c: '#e8eef5' },
      { a: '#e2dccf', b: '#d9876b', c: '#f3d9cc' },
      { a: '#3b3a4a', b: '#8b6fb3', c: '#d9cdea' },
      { a: '#7a5136', b: '#6aa36f', c: '#dcefd9' },
    ],
    boxes: [
      b(0.04, 0.04, 0, 1.96, 2.96, 0.28, 'a'),
      b(0.04, 0.04, 0.28, 1.96, 0.3, 1.1, 'a'),
      b(0.1, 0.3, 0.28, 1.9, 1.2, 0.46, '#f1ece2'),
      b(0.25, 0.42, 0.46, 0.95, 0.98, 0.6, '#ffffff'), b(1.05, 0.42, 0.46, 1.75, 0.98, 0.6, '#ffffff'),
      b(0.08, 1.2, 0.28, 1.92, 2.94, 0.52, 'b'),
      b(0.08, 1.2, 0.52, 1.92, 1.44, 0.56, 'c'),
    ],
  },
  {
    id: 8, key: 'nightstand', name: 'Mesa de luz', cat: 'muebles', layer: 'floor', w: 1, d: 1, surface: 0.56,
    variants: WOODS,
    boxes: [
      b(0.14, 0.14, 0, 0.86, 0.86, 0.56, 'a'),
      b(0.22, 0.86, 0.3, 0.78, 0.89, 0.48, 'b'),
      b(0.46, 0.89, 0.37, 0.54, 0.92, 0.41, 'c'),
    ],
  },
  {
    id: 9, key: 'bookshelf', name: 'Biblioteca', cat: 'muebles', layer: 'floor', w: 1, d: 1,
    variants: WOODS,
    boxes: [
      b(0.06, 0.05, 0, 0.14, 0.52, 2.0, 'a'), b(0.86, 0.05, 0, 0.94, 0.52, 2.0, 'a'),
      b(0.14, 0.05, 0.06, 0.86, 0.1, 1.94, 'b'),
      b(0.14, 0.1, 0, 0.86, 0.52, 0.06, 'a'), b(0.14, 0.1, 0.64, 0.86, 0.52, 0.7, 'a'),
      b(0.14, 0.1, 1.28, 0.86, 0.52, 1.34, 'a'), b(0.14, 0.1, 1.94, 0.86, 0.52, 2.0, 'a'),
      ...bookRow(0.16, 0.84, 0.12, 0.48, 0.06, 0.52, 11),
      ...bookRow(0.16, 0.84, 0.12, 0.48, 0.7, 0.52, 23),
      ...bookRow(0.16, 0.6, 0.12, 0.48, 1.34, 0.52, 37),
    ],
  },
  {
    id: 10, key: 'wardrobe', name: 'Ropero', cat: 'muebles', layer: 'floor', w: 2, d: 1,
    variants: WOODS,
    boxes: [
      b(0.04, 0.1, 0, 1.96, 0.9, 2.2, 'a'),
      b(0.1, 0.9, 0.08, 0.98, 0.93, 2.12, 'b'), b(1.02, 0.9, 0.08, 1.9, 0.93, 2.12, 'b'),
      b(0.86, 0.93, 0.95, 0.92, 0.96, 1.3, 'c'), b(1.08, 0.93, 0.95, 1.14, 0.96, 1.3, 'c'),
      b(0, 0.06, 2.2, 2, 0.94, 2.28, 'a'),
    ],
  },
  {
    id: 11, key: 'plant', name: 'Planta grande', cat: 'muebles', layer: 'floor', w: 1, d: 1,
    variants: [
      { a: '#c46a43', b: '#4f8a4b', c: '#6aa85a' },
      { a: '#e9e5dc', b: '#3f7a52', c: '#5ea36b' },
      { a: '#4f6fa8', b: '#5c8f3e', c: '#86b85a' },
    ],
    boxes: [
      b(0.28, 0.28, 0, 0.72, 0.72, 0.45, 'a'),
      b(0.32, 0.32, 0.45, 0.68, 0.68, 0.47, '#4a3426'),
      b(0.18, 0.2, 0.47, 0.82, 0.8, 0.82, 'b'),
      b(0.26, 0.26, 0.82, 0.74, 0.74, 1.12, 'c'),
      b(0.34, 0.36, 1.12, 0.66, 0.64, 1.36, 'b'),
      b(0.44, 0.44, 1.36, 0.58, 0.58, 1.5, 'c'),
    ],
  },
  {
    id: 12, key: 'floorlamp', name: 'Lámpara de pie', cat: 'muebles', layer: 'floor', w: 1, d: 1, interact: 'toggle', defaultOn: 1,
    light: { x: 0.5, y: 0.5, z: 1.55, r: 120, i: 1.1 },
    variants: [
      { a: '#2d2a32', b: '#efe3c8' },
      { a: '#c9a24a', b: '#f4efe6' },
      { a: '#2d2a32', b: '#d9774f' },
    ],
    boxes: [
      b(0.34, 0.34, 0, 0.66, 0.66, 0.06, 'a'),
      b(0.47, 0.47, 0.06, 0.53, 0.53, 1.42, 'a'),
      b(0.28, 0.28, 1.42, 0.72, 0.72, 1.8, 'b', { glow: true, on: '#ffe7a6' }),
    ],
  },
  {
    id: 13, key: 'tv', name: 'Mueble con TV', cat: 'muebles', layer: 'floor', w: 2, d: 1, interact: 'toggle',
    light: { x: 1, y: 0.8, z: 0.9, r: 80, i: 0.7, c: [0.55, 0.8, 1.1] },
    variants: WOODS,
    boxes: [
      b(0.06, 0.15, 0, 1.94, 0.85, 0.42, 'a'),
      b(0.12, 0.85, 0.08, 0.96, 0.87, 0.36, 'b'), b(1.04, 0.85, 0.08, 1.88, 0.87, 0.36, 'b'),
      b(0.85, 0.3, 0.42, 1.15, 0.55, 0.46, '#26262d'),
      b(0.3, 0.36, 0.46, 1.7, 0.46, 1.24, '#1f1f26'),
      b(0.36, 0.46, 0.52, 1.64, 0.48, 1.18, '#1b2533', { glow: true, on: '#86d4ff' }),
    ],
  },
  // ───────────── Cocina ─────────────
  {
    id: 20, key: 'counter', name: 'Mesada', cat: 'cocina', layer: 'floor', w: 1, d: 1, surface: 0.92,
    variants: [
      { a: '#e8e1d3', b: '#6d6a73', c: '#b8ad99' },
      { a: '#5b7d6e', b: '#e6e1d6', c: '#486356' },
      { a: '#2f3138', b: '#c9a77c', c: '#4b4e58' },
    ],
    boxes: [
      b(0.04, 0.1, 0, 0.96, 0.94, 0.84, 'a'),
      b(0.1, 0.94, 0.1, 0.9, 0.96, 0.76, 'c'),
      b(0.7, 0.96, 0.52, 0.78, 0.99, 0.66, 'b'),
      b(0, 0.06, 0.84, 1, 1, 0.92, 'b'),
    ],
  },
  {
    id: 21, key: 'sink', name: 'Bacha', cat: 'cocina', layer: 'floor', w: 1, d: 1,
    variants: [
      { a: '#e8e1d3', b: '#6d6a73', c: '#b8ad99' },
      { a: '#5b7d6e', b: '#e6e1d6', c: '#486356' },
      { a: '#2f3138', b: '#c9a77c', c: '#4b4e58' },
    ],
    boxes: [
      b(0.04, 0.1, 0, 0.96, 0.94, 0.84, 'a'),
      b(0.1, 0.94, 0.1, 0.9, 0.96, 0.76, 'c'),
      b(0, 0.06, 0.84, 1, 0.24, 0.92, 'b'), b(0, 0.82, 0.84, 1, 1, 0.92, 'b'),
      b(0, 0.24, 0.84, 0.16, 0.82, 0.92, 'b'), b(0.84, 0.24, 0.84, 1, 0.82, 0.92, 'b'),
      b(0.16, 0.24, 0.84, 0.84, 0.82, 0.86, '#9fb7c4'),
      b(0.46, 0.08, 0.92, 0.54, 0.16, 1.18, '#c9ced6'),
      b(0.46, 0.16, 1.1, 0.54, 0.38, 1.18, '#c9ced6'),
    ],
  },
  {
    id: 22, key: 'stove', name: 'Cocina', cat: 'cocina', layer: 'floor', w: 1, d: 1, interact: 'toggle', surface: 0.95,
    light: { x: 0.5, y: 0.5, z: 1.0, r: 50, i: 0.6, c: [1.2, 0.55, 0.3] },
    variants: [{ a: '#e9e6e0' }, { a: '#3a3a42' }, { a: '#b5463c' }],
    boxes: [
      b(0.04, 0.1, 0, 0.96, 0.94, 0.88, 'a'),
      b(0.14, 0.94, 0.12, 0.86, 0.97, 0.66, '#33333b'),
      b(0.24, 0.97, 0.26, 0.76, 0.98, 0.52, '#6b5a48', { glow: true, on: '#ffb35c' }),
      b(0.14, 0.94, 0.72, 0.86, 0.97, 0.8, '#55555e'),
      b(0, 0.06, 0.88, 1, 1, 0.92, '#2b2b30'),
      b(0.15, 0.2, 0.92, 0.42, 0.47, 0.95, '#4a4a52', { glow: true, on: '#ff6b3d' }),
      b(0.58, 0.2, 0.92, 0.85, 0.47, 0.95, '#4a4a52', { glow: true, on: '#ff6b3d' }),
      b(0.15, 0.58, 0.92, 0.42, 0.85, 0.95, '#4a4a52', { glow: true, on: '#ff6b3d' }),
      b(0.58, 0.58, 0.92, 0.85, 0.85, 0.95, '#4a4a52', { glow: true, on: '#ff6b3d' }),
    ],
  },
  {
    id: 23, key: 'fridge', name: 'Heladera', cat: 'cocina', layer: 'floor', w: 1, d: 1,
    variants: [
      { a: '#eef0f2', c: '#9aa1ab' },
      { a: '#a8d5c2', c: '#e8eef0' },
      { a: '#d9534f', c: '#f2f2f2' },
      { a: '#3a3d45', c: '#9aa1ab' },
    ],
    boxes: [
      b(0.08, 0.1, 0, 0.92, 0.9, 1.95, 'a'),
      b(0.12, 0.9, 1.32, 0.88, 0.94, 1.9, 'a'),
      b(0.12, 0.9, 0.05, 0.88, 0.94, 1.28, 'a'),
      b(0.72, 0.94, 1.42, 0.79, 0.98, 1.72, 'c'),
      b(0.72, 0.94, 0.8, 0.79, 0.98, 1.2, 'c'),
    ],
  },
  // ───────────── Deco (objetos chicos) ─────────────
  {
    id: 30, key: 'tablelamp', name: 'Velador', cat: 'deco', layer: 'deco', w: 1, d: 1, interact: 'toggle', defaultOn: 1,
    light: { x: 0.5, y: 0.5, z: 0.42, r: 80, i: 0.95 },
    variants: [
      { a: '#2d2a32', b: '#efe3c8' },
      { a: '#c9a24a', b: '#f4efe6' },
      { a: '#4f7f78', b: '#e9d6b0' },
    ],
    boxes: [
      b(0.38, 0.38, 0, 0.62, 0.62, 0.05, 'a'),
      b(0.47, 0.47, 0.05, 0.53, 0.53, 0.3, 'a'),
      b(0.3, 0.3, 0.3, 0.7, 0.7, 0.58, 'b', { glow: true, on: '#ffe7a6' }),
    ],
  },
  {
    id: 31, key: 'smallplant', name: 'Plantita', cat: 'deco', layer: 'deco', w: 1, d: 1,
    variants: [
      { a: '#c46a43', b: '#4f8a4b', c: '#6aa85a' },
      { a: '#e9e5dc', b: '#3f7a52', c: '#5ea36b' },
      { a: '#d9a441', b: '#5c8f3e', c: '#86b85a' },
    ],
    boxes: [
      b(0.36, 0.36, 0, 0.64, 0.64, 0.22, 'a'),
      b(0.28, 0.28, 0.22, 0.72, 0.72, 0.42, 'b'),
      b(0.38, 0.38, 0.42, 0.62, 0.62, 0.56, 'c'),
    ],
  },
  {
    id: 32, key: 'books', name: 'Pila de libros', cat: 'deco', layer: 'deco', w: 1, d: 1,
    variants: [
      { a: '#c0392b', b: '#2e86de', c: '#f1c40f' },
      { a: '#27ae60', b: '#8e44ad', c: '#ecf0f1' },
    ],
    boxes: [
      b(0.24, 0.3, 0, 0.76, 0.7, 0.08, 'a'),
      b(0.28, 0.32, 0.08, 0.72, 0.68, 0.15, 'b'),
      b(0.25, 0.34, 0.15, 0.7, 0.66, 0.22, 'c'),
    ],
  },
  {
    id: 33, key: 'mug', name: 'Taza', cat: 'deco', layer: 'deco', w: 1, d: 1,
    variants: [{ a: '#f2efe8' }, { a: '#d9534f' }, { a: '#2e86de' }, { a: '#f1c40f' }],
    boxes: [
      b(0.42, 0.42, 0, 0.58, 0.58, 0.15, 'a'),
      b(0.44, 0.44, 0.15, 0.56, 0.56, 0.155, '#4a2c1d', { noEdge: true }),
      b(0.58, 0.47, 0.04, 0.62, 0.53, 0.12, 'a'),
    ],
  },
  {
    id: 34, key: 'laptop', name: 'Notebook', cat: 'deco', layer: 'deco', w: 1, d: 1, interact: 'toggle',
    light: { x: 0.5, y: 0.5, z: 0.3, r: 40, i: 0.6, c: [0.6, 0.85, 1.2] },
    variants: [{ a: '#b9bcc4' }, { a: '#3a3d45' }, { a: '#e3c9c0' }],
    boxes: [
      b(0.24, 0.32, 0, 0.76, 0.72, 0.03, 'a'),
      b(0.24, 0.28, 0.03, 0.76, 0.32, 0.4, 'a'),
      b(0.27, 0.32, 0.06, 0.73, 0.33, 0.37, '#20232b', { glow: true, on: '#9ad0ff' }),
    ],
  },
  {
    id: 35, key: 'vase', name: 'Florero', cat: 'deco', layer: 'deco', w: 1, d: 1,
    variants: [
      { a: '#4f6fa8', b: '#f28ab2' },
      { a: '#e9e5dc', b: '#f1c40f' },
      { a: '#c46a43', b: '#e74c3c' },
    ],
    boxes: [
      b(0.4, 0.4, 0, 0.6, 0.6, 0.26, 'a'),
      b(0.47, 0.47, 0.26, 0.53, 0.53, 0.4, '#4f8a4b'),
      b(0.36, 0.36, 0.4, 0.64, 0.64, 0.52, 'b'),
    ],
  },
  {
    id: 36, key: 'cat', name: 'Gato', cat: 'deco', layer: 'deco', w: 1, d: 1, interact: 'look',
    variants: [{ a: '#e08a3c' }, { a: '#8a8a96' }, { a: '#2a2830' }, { a: '#efe9e1' }],
    boxes: [
      b(0.28, 0.36, 0, 0.64, 0.64, 0.2, 'a'),
      b(0.18, 0.46, 0.02, 0.28, 0.54, 0.08, 'a'),
      b(0.5, 0.38, 0.2, 0.72, 0.62, 0.38, 'a'),
      b(0.54, 0.4, 0.38, 0.6, 0.46, 0.44, 'a'), b(0.66, 0.54, 0.38, 0.72, 0.6, 0.44, 'a'),
      b(0.72, 0.42, 0.28, 0.73, 0.47, 0.32, '#1f1f1f'), b(0.72, 0.53, 0.28, 0.73, 0.58, 0.32, '#1f1f1f'),
    ],
  },
  // ───────────── Música ─────────────
  {
    id: 40, key: 'turntable', name: 'Tocadiscos', cat: 'musica', layer: 'deco', w: 1, d: 1, interact: 'toggle', music: true,
    variants: [
      { a: '#8a5a3b', b: '#e74c3c' },
      { a: '#e6e0d4', b: '#2e86de' },
      { a: '#2f2b33', b: '#f1c40f' },
    ],
    boxes: [
      b(0.14, 0.2, 0, 0.86, 0.8, 0.12, 'a'),
      b(0.22, 0.27, 0.12, 0.66, 0.73, 0.15, '#1b1b1f'),
      b(0.39, 0.45, 0.15, 0.49, 0.55, 0.16, 'b'),
      b(0.72, 0.3, 0.12, 0.77, 0.66, 0.19, '#c0c0c8'),
    ],
  },
  {
    id: 41, key: 'speaker', name: 'Parlante', cat: 'musica', layer: 'floor', w: 1, d: 1, surface: 1.0,
    variants: [{ a: '#2b2a30' }, { a: '#8a5a3b' }, { a: '#e6e0d4' }],
    boxes: [
      b(0.22, 0.26, 0, 0.78, 0.76, 1.0, 'a'),
      b(0.32, 0.76, 0.14, 0.68, 0.79, 0.52, '#141418'),
      b(0.4, 0.79, 0.24, 0.6, 0.8, 0.42, '#3b3b44'),
      b(0.4, 0.76, 0.64, 0.6, 0.79, 0.84, '#141418'),
    ],
  },
  {
    id: 42, key: 'piano', name: 'Piano', cat: 'musica', layer: 'floor', w: 2, d: 1, interact: 'toggle', music: true,
    variants: [{ a: '#1f1d24', b: '#f4f1ea' }, { a: '#6b4430', b: '#f4f1ea' }, { a: '#f0ece4', b: '#ffffff' }],
    boxes: [
      b(0.06, 0.08, 0, 1.94, 0.5, 1.45, 'a'),
      b(0.06, 0.5, 0.62, 1.94, 0.84, 0.72, 'a'),
      b(0.1, 0.5, 0.72, 1.9, 0.74, 0.76, 'b'),
      b(0.12, 0.6, 0, 0.22, 0.7, 0.62, 'a'), b(1.78, 0.6, 0, 1.88, 0.7, 0.62, 'a'),
      b(0.06, 0.08, 1.45, 1.94, 0.56, 1.5, 'a'),
    ],
  },
  {
    id: 43, key: 'guitarstand', name: 'Guitarra', cat: 'musica', layer: 'deco', w: 1, d: 1, interact: 'toggle', music: true,
    variants: [{ a: '#d08a3c' }, { a: '#b23a3a' }, { a: '#2a2a2e' }, { a: '#3d6fb5' }],
    boxes: [
      b(0.3, 0.42, 0, 0.7, 0.6, 0.36, 'a'),
      b(0.36, 0.42, 0.36, 0.64, 0.6, 0.6, 'a'),
      b(0.44, 0.6, 0.26, 0.56, 0.61, 0.4, '#2a1d14'),
      b(0.46, 0.46, 0.6, 0.54, 0.56, 1.1, '#5a3b24'),
      b(0.43, 0.46, 1.1, 0.57, 0.56, 1.24, '#3b2a1e'),
    ],
  },
  // ───────────── Alfombras ─────────────
  { id: 50, key: 'rug23', name: 'Alfombra 2×3', cat: 'alfombras', layer: 'rug', w: 2, d: 3, variants: RUGS, boxes: rugBoxes(2, 3) },
  { id: 51, key: 'rug22', name: 'Alfombra 2×2', cat: 'alfombras', layer: 'rug', w: 2, d: 2, variants: RUGS, boxes: rugBoxes(2, 2) },
  { id: 52, key: 'rug33', name: 'Alfombra 3×3', cat: 'alfombras', layer: 'rug', w: 3, d: 3, variants: RUGS, boxes: rugBoxes(3, 3) },
  { id: 53, key: 'runner', name: 'Pasillo 1×3', cat: 'alfombras', layer: 'rug', w: 1, d: 3, variants: RUGS, boxes: rugBoxes(1, 3) },
  // ───────────── Pared ─────────────
  {
    id: 60, key: 'window', name: 'Ventana', cat: 'pared', layer: 'wall', w: 1, h: 1.3, z: 0.9, interact: 'look', window: true,
    variants: [{ a: '#f2eee6', b: '#bfe3f2' }, { a: '#6b4430', b: '#bfe3f2' }, { a: '#2f2b33', b: '#bfe3f2' }],
    boxes: [
      b(0.05, 0, -0.06, 0.95, 0.16, 0.02, 'a'),
      b(0.08, 0, 0.02, 0.92, 0.06, 1.3, 'a'),
      b(0.16, 0.06, 0.1, 0.84, 0.07, 1.22, 'b', { noEdge: true }),
      b(0.48, 0.07, 0.1, 0.52, 0.09, 1.22, 'a'), b(0.16, 0.07, 0.64, 0.84, 0.09, 0.68, 'a'),
    ],
  },
  {
    id: 61, key: 'window2', name: 'Ventanal', cat: 'pared', layer: 'wall', w: 2, h: 1.4, z: 0.75, interact: 'look', window: true,
    variants: [{ a: '#f2eee6', b: '#bfe3f2' }, { a: '#6b4430', b: '#bfe3f2' }, { a: '#2f2b33', b: '#bfe3f2' }],
    boxes: [
      b(0.05, 0, -0.06, 1.95, 0.16, 0.02, 'a'),
      b(0.08, 0, 0.02, 1.92, 0.06, 1.4, 'a'),
      b(0.16, 0.06, 0.1, 1.84, 0.07, 1.32, 'b', { noEdge: true }),
      b(0.98, 0.07, 0.1, 1.02, 0.09, 1.32, 'a'), b(0.16, 0.07, 0.7, 1.84, 0.09, 0.74, 'a'),
    ],
  },
  {
    id: 62, key: 'painting', name: 'Cuadro', cat: 'pared', layer: 'wall', w: 1, h: 0.75, z: 1.25, interact: 'look',
    variants: [
      { a: '#c9a24a', b: '#f3ead8', c: '#e07a5f', d: '#3d5a80' },
      { a: '#2f2b33', b: '#e9f1f7', c: '#81b29a', d: '#f2cc8f' },
      { a: '#8a5a3b', b: '#1d3557', c: '#f1faee', d: '#e63946' },
    ],
    boxes: [
      b(0.1, 0, 0, 0.9, 0.05, 0.75, 'a'),
      b(0.16, 0.05, 0.06, 0.84, 0.06, 0.69, 'b', { noEdge: true }),
      b(0.22, 0.06, 0.12, 0.56, 0.07, 0.42, 'c', { noEdge: true }),
      b(0.46, 0.06, 0.34, 0.78, 0.07, 0.62, 'd', { noEdge: true }),
    ],
  },
  {
    id: 63, key: 'shelf', name: 'Estante', cat: 'pared', layer: 'wall', w: 2, h: 0.6, z: 1.5,
    variants: WOODS,
    boxes: [
      b(0.24, 0, -0.18, 0.3, 0.3, 0, 'a'), b(1.7, 0, -0.18, 1.76, 0.3, 0, 'a'),
      b(0, 0, 0, 2, 0.34, 0.06, 'b'),
      ...bookRow(0.2, 0.75, 0.04, 0.3, 0.06, 0.34, 5),
      b(1.36, 0.08, 0.06, 1.6, 0.28, 0.22, '#c46a43'),
      b(1.32, 0.06, 0.22, 1.64, 0.3, 0.4, '#5c9a4f'),
    ],
  },
  {
    id: 64, key: 'clock', name: 'Reloj', cat: 'pared', layer: 'wall', w: 1, h: 0.45, z: 1.85,
    variants: [{ a: '#2f2b33' }, { a: '#c9a24a' }, { a: '#d9534f' }],
    boxes: [
      b(0.3, 0, 0, 0.7, 0.06, 0.42, 'a'),
      b(0.34, 0.06, 0.04, 0.66, 0.07, 0.38, '#f5f1e6', { noEdge: true }),
      b(0.49, 0.07, 0.2, 0.51, 0.08, 0.34, '#222222', { noEdge: true }),
      b(0.5, 0.07, 0.19, 0.62, 0.08, 0.21, '#222222', { noEdge: true }),
    ],
  },
  {
    id: 65, key: 'poster', name: 'Póster', cat: 'pared', layer: 'wall', w: 1, h: 0.85, z: 1.1,
    variants: [
      { a: '#f4ecd8', b: '#e76f51', c: '#264653' },
      { a: '#1d1d2b', b: '#ff5d8f', c: '#7ae7c7' },
      { a: '#fefae0', b: '#606c38', c: '#bc6c25' },
    ],
    boxes: [
      b(0.14, 0, 0, 0.86, 0.03, 0.85, 'a', { noEdge: true }),
      b(0.24, 0.03, 0.12, 0.76, 0.04, 0.54, 'b', { noEdge: true }),
      b(0.24, 0.03, 0.62, 0.76, 0.04, 0.74, 'c', { noEdge: true }),
    ],
  },
  {
    id: 66, key: 'vinyl', name: 'Vinilo enmarcado', cat: 'musica', layer: 'wall', w: 1, h: 0.62, z: 1.3,
    variants: [{ a: '#2f2b33', b: '#e74c3c' }, { a: '#c9a24a', b: '#2e86de' }, { a: '#f2eee6', b: '#f1c40f' }],
    boxes: [
      b(0.18, 0, 0, 0.82, 0.04, 0.62, 'a'),
      b(0.24, 0.04, 0.06, 0.76, 0.05, 0.56, '#18181c', { noEdge: true }),
      b(0.44, 0.05, 0.25, 0.56, 0.06, 0.37, 'b', { noEdge: true }),
    ],
  },
  {
    id: 67, key: 'wallguitar', name: 'Guitarra colgada', cat: 'musica', layer: 'wall', w: 1, h: 1.3, z: 0.9,
    variants: [{ a: '#d08a3c' }, { a: '#b23a3a' }, { a: '#2a2a2e' }, { a: '#3d6fb5' }],
    boxes: [
      b(0.28, 0, 0, 0.72, 0.1, 0.38, 'a'),
      b(0.34, 0, 0.38, 0.66, 0.1, 0.62, 'a'),
      b(0.44, 0.1, 0.3, 0.56, 0.11, 0.44, '#2a1d14', { noEdge: true }),
      b(0.46, 0.02, 0.62, 0.54, 0.08, 1.15, '#5a3b24'),
      b(0.42, 0.02, 1.15, 0.58, 0.08, 1.3, '#3b2a1e'),
    ],
  },
  {
    id: 68, key: 'door', name: 'Puerta', cat: 'pared', layer: 'wall', w: 1, h: 2.15, z: 0, fixedZ: true,
    variants: [{ a: '#f2eee6', b: '#e3dccd' }, { a: '#5c3d2b', b: '#7a5136' }, { a: '#2f3e46', b: '#52796f' }],
    boxes: [
      b(0, 0, 0, 1, 0.05, 2.15, 'a'),
      b(0.08, 0.05, 0, 0.92, 0.09, 2.06, 'b'),
      b(0.16, 0.09, 1.1, 0.84, 0.1, 1.9, 'a', { noEdge: true }),
      b(0.16, 0.09, 0.15, 0.84, 0.1, 0.95, 'a', { noEdge: true }),
      b(0.74, 0.1, 0.95, 0.82, 0.14, 1.03, '#d4b26a'),
    ],
  },
];

export const ITEMS_BY_ID = new Map(ITEMS.map((d) => [d.id, d]));
export const ITEMS_BY_KEY = new Map(ITEMS.map((d) => [d.key, d]));

export const WALL_COLORS = ['#e8dcc6', '#c9d6c3', '#c7d3e0', '#e6c7c2', '#d9d2e9', '#f2efe9', '#5b6b73', '#3b3346'];
export const FLOOR_COLORS = ['#b07a4f', '#d4a373', '#7f5539', '#c9c2b5', '#8fa3ad', '#6d5d6e', '#d8cfc0', '#4b3a2f'];
// Índices guardados en los links: agregar al final, nunca reordenar.
export const WALL_STYLES = [
  { key: 'plain', name: 'Lisa' },
  { key: 'stripes', name: 'Rayas' },
  { key: 'brick', name: 'Ladrillo' },
  { key: 'wainscot', name: 'Boiserie' },
  { key: 'tiles', name: 'Azulejos' },
];
export const FLOOR_STYLES = [
  { key: 'planks', name: 'Madera' },
  { key: 'tiles', name: 'Baldosas' },
  { key: 'carpet', name: 'Alfombrado' },
];

/** Huella rotada de un objeto de piso. */
export function footprintSize(def, rot) {
  return rot & 1 ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
}

/** Rota 90° (rot veces) una caja local dentro de una huella w×d. */
export function rotateBox(box, w, d, rot) {
  let { x0, y0, x1, y1 } = box;
  let W = w;
  let D = d;
  for (let i = 0; i < (rot & 3); i++) {
    [x0, y0, x1, y1] = [D - y1, x0, D - y0, x1];
    [W, D] = [D, W];
  }
  return { ...box, x0, y0, x1, y1 };
}

/** Resuelve el color de una caja según la variante y el estado encendido. */
export function boxColor(def, box, variant, on) {
  if (on && box.on) return box.on;
  if (box.c[0] === '#') return box.c;
  const v = def.variants[variant] || def.variants[0];
  return v[box.c] || def.variants[0][box.c] || '#ff00ff';
}
