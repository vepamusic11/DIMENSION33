// Orquestador del juego: estado, acciones, cámara y bucle de render.
// La UI (DOM) se suscribe con onChange y llama a las acciones públicas.
import { HW, HH, UNIT_Z, WALL_H, ID_AVATAR, STORAGE_KEY, PREFS_KEY } from './engine/config.js';
import { unproj } from './engine/iso.js';
import { Raster } from './engine/raster.js';
import { footprintSize } from './game/catalog.js';
import {
  createRoom, makeItem, defOf, cellsOf, canPlace, surfaceAt, blockedGrid,
  encodeRoom, decodeRoom, resizeRoom, SIDE_L, SIDE_R,
} from './game/room.js';
import { computeLayout, renderScene } from './game/scene.js';
import { demoRoom } from './game/demo.js';
import { findPath, nearestFree } from './game/pathfind.js';
import { createAvatar, updateAvatar, sitOn, standUp, cellOf, dirTowards, LOOKS } from './game/avatar.js';
import * as store from './ui/storage.js';

const HISTORY_MAX = 100;
const sameItem = (a, b) => a.t === b.t && a.x === b.x && a.y === b.y && a.r === b.r && a.v === b.v && a.s === b.s && a.on === b.on && a.z === b.z;
const ZOOM_MAX = 14;
const SIT_DIR = [0, 3, 2, 1];
const LOOK_LINES = {
  window: ['Qué lindo día afuera ☀️', 'Se ve todo el barrio desde acá.'],
  window2: ['Qué vista increíble 🌇', 'Entra muchísima luz.'],
  painting: ['Arte moderno. Muy profundo.', 'Lo pinté yo… creo.'],
  poster: ['Mi banda favorita 🤘'],
  clock: ['¡Ya es hora de hacer música!'],
  vinyl: ['Mi primer disco de oro 💿'],
  wallguitar: ['Algún día la voy a afinar.'],
  door: ['Mejor me quedo un rato más.'],
  shelf: ['Libros que prometo leer.'],
};

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d');
    this.raster = new Raster(8, 8);
    this.listeners = new Set();

    this.prefs = store.loadJSON(PREFS_KEY, { night: false, sound: false, grid: false, look: 0, cat: 'muebles', help: false });
    this.mode = 'build';
    this.tool = null; // { def, r, v, s, on, moving: item|null }
    this.ghost = null; // { item, valid, reason }
    this.selected = -1;
    this.hover = -1;
    this.undoStack = [];
    this.redoStack = [];
    this.view = { zoom: 1, panX: 0, panY: 0, w: 1, h: 1, dpr: 1, userMoved: false };
    this.needsScene = true;
    this.needsPresent = true;
    this.time = 0;
    this.lastT = 0;
    this.lastHover = null;

    this.room = createRoom();
    this.layout = computeLayout(this.room);
    this.avatar = createAvatar(0, 0);
  }

  // ───────────────────────── eventos para la UI ─────────────────────────
  onChange(fn) {
    this.listeners.add(fn);
  }

  emit(kind, data) {
    for (const fn of this.listeners) fn(kind, data);
  }

  toast(msg) {
    this.emit('toast', msg);
  }

  // ───────────────────────── carga y guardado ─────────────────────────
  boot() {
    const fromHash = this.readHash();
    let room = null;
    if (fromHash === false) this.toast('El link no es válido: se cargó tu última habitación');
    else if (fromHash) room = fromHash;
    if (!room) room = decodeRoom(store.load(STORAGE_KEY, '') || '') || demoRoom();
    this.setRoom(room, { push: false });
    window.addEventListener('hashchange', () => {
      const r = this.readHash();
      if (r && encodeRoom(r) !== encodeRoom(this.room)) {
        this.snapshot();
        this.setRoom(r, { push: false });
        this.toast('Habitación cargada desde el link');
      }
    });
    this.resize();
    this.fit();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** null = no hay hash, false = hash inválido, room = válido. */
  readHash() {
    const m = /^#r=([A-Za-z0-9_-]{1,4096})$/.exec(location.hash);
    if (!location.hash) return null;
    if (!m) return false;
    return decodeRoom(m[1]) || false;
  }

  persist() {
    const code = encodeRoom(this.room);
    store.save(STORAGE_KEY, code);
    try {
      history.replaceState(null, '', `#r=${code}`);
    } catch {
      /* file:// o sandbox: no es crítico */
    }
  }

  savePrefs() {
    store.saveJSON(PREFS_KEY, this.prefs);
  }

  shareUrl() {
    const u = new URL(location.href);
    u.hash = `r=${encodeRoom(this.room)}`;
    return u.toString();
  }

  setRoom(room, { push = true } = {}) {
    if (push) this.snapshot();
    const sizeChanged = !this.room || room.w !== this.room.w || room.d !== this.room.d;
    this.room = room;
    this.layout = computeLayout(room);
    this.selected = -1;
    this.hover = -1;
    this.ghost = null;
    this.ensureAvatar(true);
    this.persist();
    this.invalidate();
    if (sizeChanged) this.fit();
    this.emit('room');
    this.emit('selection');
    this.emit('history');
  }

  // ───────────────────────── historial ─────────────────────────
  snapshot() {
    this.undoStack.push(encodeRoom(this.room));
    if (this.undoStack.length > HISTORY_MAX) this.undoStack.shift();
    this.redoStack.length = 0;
    this.emit('history');
  }

  /** Aplica una mutación con soporte de deshacer. fn devuelve false para abortar. */
  mutate(fn) {
    const before = encodeRoom(this.room);
    // Copia superficial que conserva la identidad de los objetos que no cambian
    // (el personaje y las acciones pendientes guardan referencias a ellos).
    const origOf = new Map();
    const draft = { ...this.room, items: this.room.items.map((it) => {
      const c = { ...it };
      origOf.set(c, it);
      return c;
    }) };
    if (fn(draft) === false) return false;
    if (encodeRoom(draft) === before) return false;
    draft.items = draft.items.map((c) => {
      const o = origOf.get(c);
      return o && sameItem(o, c) ? o : c;
    });
    this.undoStack.push(before);
    if (this.undoStack.length > HISTORY_MAX) this.undoStack.shift();
    this.redoStack.length = 0;
    const sizeChanged = draft.w !== this.room.w || draft.d !== this.room.d;
    this.room = draft;
    if (sizeChanged) {
      this.layout = computeLayout(draft);
      this.fit();
    }
    this.ensureAvatar();
    this.persist();
    this.invalidate();
    this.emit('history');
    this.emit('room');
    return true;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(encodeRoom(this.room));
    this.restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(encodeRoom(this.room));
    this.restore(this.redoStack.pop());
  }

  restore(code) {
    const room = decodeRoom(code);
    if (!room) return;
    const sizeChanged = room.w !== this.room.w || room.d !== this.room.d;
    this.room = room;
    this.layout = computeLayout(room);
    this.selected = -1;
    // Si se estaba moviendo un objeto, el estado restaurado ya lo contiene
    this.tool = null;
    this.ghost = null;
    this.emit('tool');
    this.ensureAvatar();
    if (sizeChanged) this.fit();
    this.persist();
    this.invalidate();
    this.emit('history');
    this.emit('selection');
    this.emit('room');
  }

  // ───────────────────────── personaje ─────────────────────────
  ensureAvatar(reset = false) {
    const a = this.avatar;
    if (a.sit && (!this.room.items.includes(a.sit.item) || reset)) standUp(a);
    const grid = blockedGrid(this.room);
    const c = cellOf(a);
    const out = c.x < 0 || c.y < 0 || c.x >= this.room.w || c.y >= this.room.d;
    if (reset || out || grid[c.y * this.room.w + c.x]) {
      const p = nearestFree(grid, this.room.w, this.room.d, reset ? Math.floor(this.room.w / 2) : c.x, reset ? Math.floor(this.room.d / 2) : c.y);
      this.avatar = createAvatar(p ? p.x : 0, p ? p.y : 0);
    } else {
      // El camino pudo quedar bloqueado por un objeto nuevo
      a.path = [];
      a.action = null;
    }
  }

  walkTo(tx, ty, action = null) {
    const a = this.avatar;
    const grid = blockedGrid(this.room);
    if (a.sit) {
      const spot = a.sit;
      standUp(a);
      const p = nearestFree(grid, this.room.w, this.room.d, Math.floor(spot.x), Math.floor(spot.y));
      if (p) {
        a.x = p.x + 0.5;
        a.y = p.y + 0.5;
      }
    }
    const start = cellOf(a);
    const path = findPath(grid, this.room.w, this.room.d, start.x, start.y, tx, ty);
    if (!path) return false;
    a.path = path;
    a.action = action;
    this.needsScene = true;
    return true;
  }

  /** Camina hasta la celda libre alcanzable más cercana al borde de un objeto. */
  approach(index, action) {
    const it = this.room.items[index];
    const def = defOf(it);
    let rect;
    if (def.layer === 'wall') {
      rect = it.s === SIDE_L ? { x: 0, y: it.x, w: 1, d: def.w } : { x: it.x, y: 0, w: def.w, d: 1 };
    } else {
      const host = def.layer === 'deco' ? this.hostOf(it) : -1;
      rect = host >= 0 ? cellsOf(this.room.items[host]) : cellsOf(it);
    }
    const grid = blockedGrid(this.room);
    const a = this.avatar;
    const start = cellOf(a);
    const cands = [];
    for (let y = rect.y - 1; y <= rect.y + rect.d; y++) {
      for (let x = rect.x - 1; x <= rect.x + rect.w; x++) {
        const inside = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.d;
        const diag = (x < rect.x || x >= rect.x + rect.w) && (y < rect.y || y >= rect.y + rect.d);
        if ((inside && def.layer !== 'wall') || diag) continue;
        if (x < 0 || y < 0 || x >= this.room.w || y >= this.room.d || grid[y * this.room.w + x]) continue;
        cands.push({ x, y, d: Math.abs(x - start.x) + Math.abs(y - start.y) });
      }
    }
    cands.sort((p, q) => p.d - q.d);
    if (a.sit && a.sit.item === it) {
      this.runAction(action);
      return true;
    }
    for (const c of cands) {
      if (!a.sit && c.x === start.x && c.y === start.y) {
        this.runAction(action);
        return true;
      }
      if (this.walkTo(c.x, c.y, action)) return true;
    }
    return false;
  }

  hostOf(decoItem) {
    for (let i = 0; i < this.room.items.length; i++) {
      const o = this.room.items[i];
      if (defOf(o).layer !== 'floor') continue;
      const c = cellsOf(o);
      if (decoItem.x >= c.x && decoItem.x < c.x + c.w && decoItem.y >= c.y && decoItem.y < c.y + c.d) return i;
    }
    return -1;
  }

  runAction(act) {
    if (!act) return;
    const a = this.avatar;
    const index = this.room.items.indexOf(act.item);
    if (index < 0) return;
    const it = act.item;
    const def = defOf(it);
    const center = cellsOf(it);
    if (def.layer !== 'wall') a.dir = dirTowards(center.x + center.w / 2 - a.x, center.y + center.d / 2 - a.y);
    if (act.type === 'toggle') {
      this.setOn(index, !it.on);
    } else if (act.type === 'sit') {
      // Elige la celda de la huella más cercana y mira hacia el frente del mueble
      const c = cellsOf(it);
      let best = null;
      for (let y = c.y; y < c.y + c.d; y++) {
        for (let x = c.x; x < c.x + c.w; x++) {
          const d = Math.hypot(x + 0.5 - a.x, y + 0.5 - a.y);
          if (!best || d < best.d) best = { x, y, d };
        }
      }
      const dir = SIT_DIR[it.r & 3];
      const fv = [[0, 1], [1, 0], [0, -1], [-1, 0]][dir];
      sitOn(a, { x: best.x + 0.5 + fv[0] * 0.1, y: best.y + 0.5 + fv[1] * 0.1, z: def.seat, dir, item: it });
      this.emit('sfx', 'toggle');
    } else if (act.type === 'look') {
      if (def.key === 'cat') {
        this.emit('sfx', 'meow');
        this.toast('¡Miau! 🐱');
      } else {
        const lines = LOOK_LINES[def.key] || [def.name];
        this.toast(lines[Math.floor(Math.random() * lines.length)]);
      }
    }
    this.needsScene = true;
  }

  setOn(index, on) {
    const it = this.room.items[index];
    const def = defOf(it);
    if (!def || def.interact !== 'toggle') return;
    this.mutate((r) => {
      r.items[index].on = on ? 1 : 0;
    });
    this.emit('sfx', 'toggle');
    this.emit('music');
    this.emit('selection');
  }

  isMusicPlaying() {
    return this.room.items.some((it) => it.on && defOf(it).music);
  }

  cycleLook() {
    this.prefs.look = (this.prefs.look + 1) % LOOKS.length;
    this.savePrefs();
    this.needsScene = true;
    this.toast(`Personaje: ${LOOKS[this.prefs.look].name}`);
  }

  // ───────────────────────── modos y herramientas ─────────────────────────
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.cancelTool();
    this.select(-1);
    this.hover = -1;
    if (mode === 'play') this.ensureAvatar();
    this.invalidate();
    this.emit('mode');
  }

  selectTool(def, { moving = null, from = null } = {}) {
    this.select(-1);
    const prev = this.tool && this.tool.def === def ? this.tool : null;
    this.tool = {
      def,
      r: from ? from.r : prev ? prev.r : 0,
      v: from ? from.v : prev ? prev.v : 0,
      s: from ? from.s : prev ? prev.s : SIDE_R,
      on: from ? from.on : def.defaultOn ? 1 : 0,
      z: from ? from.z : Math.round((def.z || 0) * 4),
      moving,
    };
    this.ghost = null;
    if (this.lastHover) this.hoverAt(this.lastHover.x, this.lastHover.y);
    this.invalidate();
    this.emit('tool');
  }

  cancelTool() {
    if (!this.tool) return;
    const moving = this.tool.moving;
    this.tool = null;
    this.ghost = null;
    if (moving) {
      // Cancelar un "mover" devuelve el objeto a su lugar
      this.room.items.push(moving.item);
      this.undoStack.pop();
      this.persist();
      this.emit('history');
    }
    this.invalidate();
    this.emit('tool');
  }

  select(index) {
    this.selected = index;
    this.invalidate();
    this.emit('selection');
  }

  selectedItem() {
    return this.selected >= 0 ? this.room.items[this.selected] : null;
  }

  // Acciones sobre la herramienta activa o el objeto seleccionado
  rotate() {
    if (this.tool) {
      if (this.tool.def.layer === 'wall') {
        this.tool.s = this.tool.s === SIDE_L ? SIDE_R : SIDE_L;
      } else {
        this.tool.r = (this.tool.r + 1) & 3;
      }
      this.refreshGhost();
      return;
    }
    const i = this.selected;
    if (i < 0) return;
    const it = this.room.items[i];
    const def = defOf(it);
    const next = { ...it };
    if (def.layer === 'wall') {
      next.s = it.s === SIDE_L ? SIDE_R : SIDE_L;
      const len = next.s === SIDE_L ? this.room.d : this.room.w;
      next.x = Math.min(next.x, len - def.w);
    } else {
      next.r = (it.r + 1) & 3;
    }
    const probe = { ...this.room, items: this.room.items.filter((_, k) => k !== i) };
    const ok = canPlace(probe, next);
    if (!ok.ok) {
      this.emit('sfx', 'error');
      return this.toast(def.layer === 'wall' ? 'No entra en la otra pared' : 'No hay espacio para rotarlo');
    }
    this.mutate((r) => {
      r.items[i] = next;
    });
    this.select(i);
  }

  recolor() {
    if (this.tool) {
      this.tool.v = (this.tool.v + 1) % this.tool.def.variants.length;
      this.refreshGhost();
      this.emit('tool');
      return;
    }
    const i = this.selected;
    if (i < 0) return;
    const def = defOf(this.room.items[i]);
    if (def.variants.length < 2) return this.toast('Este objeto tiene un solo color');
    this.mutate((r) => {
      r.items[i].v = (r.items[i].v + 1) % def.variants.length;
    });
    this.select(i);
  }

  toggleSelected() {
    const i = this.selected;
    if (i < 0) return;
    const it = this.room.items[i];
    if (defOf(it).interact !== 'toggle') return;
    this.setOn(i, !it.on);
  }

  removeSelected() {
    const i = this.selected;
    if (i < 0) return;
    this.mutate((r) => {
      r.items.splice(i, 1);
    });
    this.emit('sfx', 'remove');
    this.select(-1);
  }

  moveSelected() {
    const i = this.selected;
    if (i < 0) return;
    const it = this.room.items[i];
    this.snapshot();
    this.room.items.splice(i, 1);
    this.selectTool(defOf(it), { moving: { item: it }, from: it });
    this.ensureAvatar();
    this.toast('Elegí el nuevo lugar');
  }

  duplicateSelected() {
    const it = this.selectedItem();
    if (!it) return;
    this.selectTool(defOf(it), { from: it });
    this.toast('Elegí dónde poner la copia');
  }

  // ───────────────────────── colocación ─────────────────────────
  computeGhost(rx, ry) {
    const t = this.tool;
    const def = t.def;
    const o = this.layout.origin;
    const room = this.room;
    const item = makeItem(def, { r: t.r, v: t.v, s: t.s, on: t.on, z: t.z });

    if (def.layer === 'wall') {
      const a = (rx - o.x) / HW;
      let side;
      let u;
      let z;
      if (a < 0) {
        side = SIDE_L;
        u = -a;
        z = (u * HH - (ry - o.y)) / UNIT_Z;
      } else {
        side = SIDE_R;
        u = a;
        z = (u * HH - (ry - o.y)) / UNIT_Z;
      }
      const len = side === SIDE_L ? room.d : room.w;
      if (u < -0.5 || u > len + 0.5 || z < -1 || z > WALL_H + 1.5) return null;
      item.s = side;
      item.x = Math.max(0, Math.min(len - def.w, Math.round(u - def.w / 2)));
      item.z = def.fixedZ ? Math.round(def.z * 4) : Math.max(0, Math.min(Math.floor((WALL_H - def.h) * 4), Math.round((z - def.h / 2) * 4)));
      t.s = side;
    } else {
      let zs = 0;
      if (def.layer === 'deco') {
        const id = this.idAt(rx, ry);
        if (id > 0 && id <= room.items.length) {
          const host = room.items[id - 1];
          const hd = defOf(host);
          if (hd.layer === 'floor' && hd.surface) zs = hd.surface;
          else if (hd.layer === 'deco') zs = Math.max(0, surfaceAt(room, host.x, host.y));
        }
      }
      const f = unproj(o, rx, ry, zs);
      const fp = def.layer === 'deco' ? { w: 1, d: 1 } : footprintSize(def, t.r);
      let x = Math.floor(f.x - fp.w / 2 + 0.5);
      let y = Math.floor(f.y - fp.d / 2 + 0.5);
      if (x < -1.5 - fp.w || y < -1.5 - fp.d || x > room.w + 1 || y > room.d + 1) return null;
      x = Math.max(0, Math.min(room.w - fp.w, x));
      y = Math.max(0, Math.min(room.d - fp.d, y));
      item.x = x;
      item.y = y;
    }
    const res = canPlace(room, item);
    return { item, valid: res.ok, reason: res.reason };
  }

  refreshGhost() {
    if (!this.tool) return;
    if (this.ghost) {
      const keep = this.ghost.item;
      const it = { ...keep, r: this.tool.r, v: this.tool.v, s: this.tool.s };
      if (this.tool.def.layer === 'wall' && it.s !== keep.s) {
        const len = it.s === SIDE_L ? this.room.d : this.room.w;
        it.x = Math.min(it.x, Math.max(0, len - this.tool.def.w));
      }
      if (this.tool.def.layer !== 'wall' && this.tool.def.layer !== 'deco') {
        const fp = footprintSize(this.tool.def, it.r);
        it.x = Math.max(0, Math.min(this.room.w - fp.w, it.x));
        it.y = Math.max(0, Math.min(this.room.d - fp.d, it.y));
      }
      const res = canPlace(this.room, it);
      this.ghost = { item: it, valid: res.ok, reason: res.reason };
    }
    this.invalidate();
    this.emit('ghost');
  }

  placeGhost() {
    const g = this.ghost;
    const t = this.tool;
    if (!g || !t) return false;
    if (!g.valid) {
      this.emit('sfx', 'error');
      this.toast(g.reason || 'No se puede colocar ahí');
      return false;
    }
    const item = { ...g.item };
    if (t.moving) {
      // El "antes" ya se guardó al levantar el objeto
      this.room.items.push(item);
      this.tool = null;
      this.ghost = null;
      this.ensureAvatar();
      this.persist();
      this.invalidate();
      this.emit('room');
      this.emit('tool');
      this.select(this.room.items.length - 1);
    } else {
      this.mutate((r) => {
        r.items.push(item);
      });
      // Recalcula la validez en el mismo lugar (ahora ocupado)
      const res = canPlace(this.room, g.item);
      this.ghost = { item: g.item, valid: res.ok, reason: res.reason };
    }
    this.emit('sfx', 'place');
    this.emit('ghost');
    return true;
  }

  // ───────────────────────── entrada de alto nivel ─────────────────────────
  toRaster(px, py) {
    const v = this.view;
    return { x: (px * v.dpr - v.panX) / v.zoom, y: (py * v.dpr - v.panY) / v.zoom };
  }

  idAt(rx, ry) {
    const x = Math.floor(rx);
    const y = Math.floor(ry);
    if (x < 0 || y < 0 || x >= this.raster.w || y >= this.raster.h) return 0;
    return this.raster.id[y * this.raster.w + x];
  }

  itemIndexAt(rx, ry) {
    const id = this.idAt(rx, ry);
    return id > 0 && id <= this.room.items.length ? id - 1 : -1;
  }

  hoverAt(px, py) {
    if (px === null) {
      this.lastHover = null;
      if (this.tool && this.ghost) {
        this.ghost = null;
        this.invalidate();
      }
      if (this.hover !== -1) {
        this.hover = -1;
        this.invalidate();
      }
      this.emit('cursor', 'default');
      return;
    }
    this.lastHover = { x: px, y: py };
    const p = this.toRaster(px, py);
    if (this.tool) {
      const g = this.computeGhost(p.x, p.y);
      const same = g && this.ghost && JSON.stringify(g.item) === JSON.stringify(this.ghost.item);
      if (!same) {
        this.ghost = g;
        this.invalidate();
        this.emit('ghost');
      }
      this.emit('cursor', 'placing');
      return;
    }
    const idx = this.itemIndexAt(p.x, p.y);
    const hv = this.mode === 'play' ? (idx >= 0 && defOf(this.room.items[idx]).interact ? idx : -1) : idx;
    if (hv !== this.hover) {
      this.hover = hv;
      this.invalidate();
    }
    this.emit('cursor', hv >= 0 ? 'pointing' : 'default');
  }

  tapAt(px, py, info) {
    const p = this.toRaster(px, py);
    if (info.button === 2) {
      if (this.tool) this.cancelTool();
      else this.select(-1);
      return;
    }
    if (this.mode === 'build') {
      if (this.tool) {
        const g = this.computeGhost(p.x, p.y);
        if (!g) return;
        const isMouse = info.type === 'mouse';
        const same = this.ghost && JSON.stringify(g.item) === JSON.stringify(this.ghost.item);
        this.ghost = g;
        this.invalidate();
        this.emit('ghost');
        // Mouse: coloca al instante. Touch: 1er toque previsualiza, 2º toque en el mismo lugar coloca.
        if (isMouse || same) this.placeGhost();
        return;
      }
      const idx = this.itemIndexAt(p.x, p.y);
      this.select(idx === this.selected ? -1 : idx);
      return;
    }
    // Modo jugar
    const idx = this.itemIndexAt(p.x, p.y);
    if (idx >= 0) {
      const it = this.room.items[idx];
      const def = defOf(it);
      if (def.interact) {
        if (def.layer === 'wall' && def.interact === 'look') {
          this.runAction({ type: 'look', item: it });
          return;
        }
        if (!this.approach(idx, { type: def.interact, item: it })) {
          this.emit('sfx', 'error');
          this.toast('No puedo llegar ahí');
        }
        return;
      }
    }
    if (this.idAt(p.x, p.y) === ID_AVATAR) {
      this.cycleLook();
      return;
    }
    const f = unproj(this.layout.origin, p.x, p.y, 0);
    const tx = Math.floor(f.x);
    const ty = Math.floor(f.y);
    if (tx < 0 || ty < 0 || tx >= this.room.w || ty >= this.room.d) return;
    if (!this.walkTo(tx, ty)) {
      this.emit('sfx', 'error');
      this.toast('No puedo llegar ahí');
    }
  }

  stepAvatar(dx, dy) {
    const c = cellOf(this.avatar);
    const tx = c.x + dx;
    const ty = c.y + dy;
    if (this.avatar.path.length) return;
    if (!this.walkTo(tx, ty)) this.avatar.dir = dirTowards(dx, dy);
    this.needsScene = true;
  }

  // ───────────────────────── cámara ─────────────────────────
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    const v = this.view;
    if (w === v.w && h === v.h && dpr === v.dpr) return;
    // Mantiene el centro de la vista
    const cx = (v.w / 2 - v.panX) / v.zoom;
    const cy = (v.h / 2 - v.panY) / v.zoom;
    this.canvas.width = w;
    this.canvas.height = h;
    v.w = w;
    v.h = h;
    v.dpr = dpr;
    if (!v.userMoved) this.fit();
    else {
      v.panX = Math.round(w / 2 - cx * v.zoom);
      v.panY = Math.round(h / 2 - cy * v.zoom);
    }
    this.needsPresent = true;
  }

  fit() {
    const v = this.view;
    const L = this.layout;
    // El layout incluye un margen transparente: se permite recortarlo para ganar un nivel de zoom
    const m = L.pad * 1.6;
    v.zoom = Math.max(1, Math.min(ZOOM_MAX, Math.floor(Math.min(v.w / (L.w - m), v.h / (L.h - m)))));
    v.panX = Math.round((v.w - L.w * v.zoom) / 2);
    v.panY = Math.round((v.h - L.h * v.zoom) / 2);
    v.userMoved = false;
    this.needsPresent = true;
  }

  zoomTo(z, px = null, py = null) {
    const v = this.view;
    z = Math.max(1, Math.min(ZOOM_MAX, Math.round(z)));
    if (z === v.zoom) return;
    const cx = px === null ? v.w / 2 : px * v.dpr;
    const cy = py === null ? v.h / 2 : py * v.dpr;
    v.panX = Math.round(cx - ((cx - v.panX) * z) / v.zoom);
    v.panY = Math.round(cy - ((cy - v.panY) * z) / v.zoom);
    v.zoom = z;
    v.userMoved = true;
    this.clampPan();
    this.needsPresent = true;
  }

  pan(dx, dy) {
    const v = this.view;
    v.panX += dx * v.dpr;
    v.panY += dy * v.dpr;
    v.userMoved = true;
    this.clampPan();
    this.needsPresent = true;
  }

  clampPan() {
    const v = this.view;
    const m = 60 * v.dpr;
    const w = this.layout.w * v.zoom;
    const h = this.layout.h * v.zoom;
    v.panX = Math.round(Math.max(m - w, Math.min(v.w - m, v.panX)));
    v.panY = Math.round(Math.max(m - h, Math.min(v.h - m, v.panY)));
  }

  // ───────────────────────── render ─────────────────────────
  invalidate() {
    this.needsScene = true;
  }

  frame(t) {
    const dt = Math.min(0.05, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    this.time += dt;
    const a = this.avatar;
    const wasWalking = a.walking || a.path.length > 0;
    const cellBefore = cellOf(a);
    const act = updateAvatar(a, dt);
    if (act) this.runAction(act);
    const c = cellOf(a);
    if (c.x !== cellBefore.x || c.y !== cellBefore.y) this.emit('sfx', 'step');
    if (wasWalking || a.walking || this.isMusicPlaying()) this.needsScene = true;
    else if (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) this.needsScene = true; // respiración del personaje
    if (this.needsScene) this.renderScene();
    if (this.needsPresent) this.present();
    requestAnimationFrame((tt) => this.frame(tt));
  }

  renderScene() {
    this.needsScene = false;
    const showGhost = this.mode === 'build' && this.tool && this.ghost;
    renderScene(this.raster, this.room, this.layout, {
      night: this.prefs.night,
      grid: this.prefs.grid || (this.mode === 'build' && !!this.tool),
      time: this.time,
      avatar: this.avatar,
      look: LOOKS[this.prefs.look] || LOOKS[0],
      selected: this.mode === 'build' ? this.selected : -1,
      hover: this.hover,
      ghost: showGhost ? this.ghost : null,
    });
    const { w, h } = this.raster;
    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }
    this.bctx.putImageData(new ImageData(this.raster.bytes().slice(), w, h), 0, 0);
    this.needsPresent = true;
  }

  present() {
    this.needsPresent = false;
    const { ctx, view: v } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, v.w, v.h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, v.panX, v.panY, this.buffer.width * v.zoom, this.buffer.height * v.zoom);
  }

  /** PNG a escala ×4 con fondo, para descargar. */
  exportPng() {
    const s = 4;
    const c = document.createElement('canvas');
    c.width = this.buffer.width * s;
    c.height = this.buffer.height * s;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(c.width / 2, c.height * 0.4, 0, c.width / 2, c.height * 0.4, c.width * 0.7);
    g.addColorStop(0, this.prefs.night ? '#231d3a' : '#2a2340');
    g.addColorStop(1, '#141120');
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingEnabled = false;
    x.drawImage(this.buffer, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  // ───────────────────────── ajustes de habitación ─────────────────────────
  setRoomProp(prop, value) {
    if (prop === 'w' || prop === 'd') {
      let removed = 0;
      this.mutate((r) => {
        removed = resizeRoom(r, prop === 'w' ? value : r.w, prop === 'd' ? value : r.d);
      });
      if (removed) this.toast(`Se quitaron ${removed} objeto(s) que quedaban afuera`);
    } else {
      this.mutate((r) => {
        r[prop] = value;
      });
    }
  }

  newRoom() {
    const r = createRoom(this.room.w, this.room.d);
    r.wall = this.room.wall;
    r.wallStyle = this.room.wallStyle;
    r.floor = this.room.floor;
    r.floorStyle = this.room.floorStyle;
    this.setRoom(r);
  }

  loadDemo() {
    this.setRoom(demoRoom());
  }
}
