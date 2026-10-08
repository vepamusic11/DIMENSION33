// A* en grilla de 4 direcciones (encaja con el movimiento isométrico).
// grid: Uint8Array w*d con 1 = bloqueado. Devuelve lista de celdas [{x,y}] sin incluir el inicio,
// o null si no hay camino.
export function findPath(grid, w, d, sx, sy, tx, ty) {
  const idx = (x, y) => y * w + x;
  if (tx < 0 || ty < 0 || tx >= w || ty >= d || grid[idx(tx, ty)]) return null;
  if (sx === tx && sy === ty) return [];
  const n = w * d;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = [];
  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  const s = idx(sx, sy);
  g[s] = 0;
  open.push({ i: s, f: h(sx, sy) });
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (open.length) {
    // Cola de prioridad simple: las grillas son chicas (≤ 16×16)
    let best = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[best].f) best = k;
    const { i } = open.splice(best, 1)[0];
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x === tx && y === ty) {
      const path = [];
      for (let c = i; c !== s; c = from[c]) path.push({ x: c % w, y: (c / w) | 0 });
      return path.reverse();
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= d) continue;
      const j = idx(nx, ny);
      if (grid[j] || closed[j]) continue;
      const ng = g[i] + 1;
      if (ng < g[j]) {
        g[j] = ng;
        from[j] = i;
        open.push({ i: j, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

/** Celda libre más cercana (BFS) a (x,y); útil para ubicar al personaje. */
export function nearestFree(grid, w, d, x, y) {
  const seen = new Uint8Array(w * d);
  const q = [[Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(d - 1, y))]];
  while (q.length) {
    const [cx, cy] = q.shift();
    const i = cy * w + cx;
    if (seen[i]) continue;
    seen[i] = 1;
    if (!grid[i]) return { x: cx, y: cy };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < d) q.push([nx, ny]);
    }
  }
  return null;
}
