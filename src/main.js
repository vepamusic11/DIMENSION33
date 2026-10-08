// Punto de entrada: conecta el DOM con App.
import { App } from './app.js';
import { CATEGORIES, ITEMS, WALL_COLORS, FLOOR_COLORS, FLOOR_STYLES } from './game/catalog.js';
import { defOf } from './game/room.js';
import { renderThumb } from './game/scene.js';
import { Raster } from './engine/raster.js';
import { attachPointer, attachKeys } from './ui/input.js';
import { SoundEngine } from './ui/audio.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#view');
const app = new App(canvas);
const sound = new SoundEngine();

// ───────────────────────── Toast ─────────────────────────
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ───────────────────────── Catálogo ─────────────────────────
const thumbs = new Map();
function thumbFor(def) {
  if (thumbs.has(def.id)) return thumbs.get(def.id);
  const r = new Raster(8, 8);
  const { w, h } = renderThumb(r, def, 0);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(new ImageData(r.bytes().slice(), w, h), 0, 0);
  const url = c.toDataURL('image/png');
  thumbs.set(def.id, url);
  return url;
}

function buildCatalog() {
  const tabs = $('#cat-tabs');
  tabs.replaceChildren();
  for (const cat of CATEGORIES) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.textContent = cat.name;
    b.dataset.cat = cat.key;
    b.setAttribute('aria-selected', String(cat.key === app.prefs.cat));
    b.addEventListener('click', () => {
      app.prefs.cat = cat.key;
      app.savePrefs();
      renderCatalog();
    });
    tabs.append(b);
  }
  renderCatalog();
}

function renderCatalog() {
  for (const b of $('#cat-tabs').children) b.setAttribute('aria-selected', String(b.dataset.cat === app.prefs.cat));
  const grid = $('#cat-grid');
  grid.replaceChildren();
  for (const def of ITEMS.filter((d) => d.cat === app.prefs.cat)) {
    const b = document.createElement('button');
    b.className = 'item-btn';
    b.role = 'option';
    b.dataset.id = def.id;
    b.setAttribute('aria-selected', String(app.tool?.def === def));
    const img = document.createElement('img');
    img.src = thumbFor(def);
    img.alt = '';
    img.draggable = false;
    const span = document.createElement('span');
    span.textContent = def.name;
    b.append(img, span);
    b.addEventListener('click', () => {
      if (app.tool?.def === def && !app.tool.moving) app.cancelTool();
      else app.selectTool(def);
      canvas.focus({ preventScroll: true });
    });
    grid.append(b);
  }
}

function syncCatalogSelection() {
  for (const b of $('#cat-grid').children) b.setAttribute('aria-selected', String(app.tool?.def.id === Number(b.dataset.id)));
}

const isTouchFirst = () => window.matchMedia('(pointer: coarse)').matches;

// ───────────────────────── Barras flotantes ─────────────────────────
function syncBars() {
  const placebar = $('#placebar');
  const selbar = $('#selbar');
  const t = app.mode === 'build' ? app.tool : null;
  placebar.hidden = !t;
  if (t) {
    $('#place-name').textContent = t.moving ? `Mover: ${t.def.name}` : t.def.name;
    $('#btn-place-ok').disabled = !(app.ghost && app.ghost.valid);
    placebar.querySelector('[data-place="color"]').hidden = t.def.variants.length < 2;
  }
  const it = app.mode === 'build' && !t ? app.selectedItem() : null;
  selbar.hidden = !it;
  if (it) {
    const def = defOf(it);
    $('#sel-name').textContent = def.name;
    const tg = $('#btn-sel-toggle');
    tg.hidden = def.interact !== 'toggle';
    tg.setAttribute('aria-pressed', String(!!it.on));
    selbar.querySelector('[data-sel="color"]').hidden = def.variants.length < 2;
  }
  syncHint();
}

function syncHint() {
  const h = $('#hint');
  const touch = isTouchFirst();
  if (app.mode === 'play') {
    h.textContent = touch ? 'Tocá el piso para caminar · tocá objetos para usarlos' : 'Click para caminar · click en objetos para usarlos · flechas/WASD';
  } else if (app.tool) {
    if (app.ghost && !app.ghost.valid) h.textContent = app.ghost.reason || 'No se puede colocar ahí';
    else if (app.tool.def.layer === 'wall') h.textContent = touch ? 'Tocá una pared · rotar cambia de pared' : 'Click en una pared · R cambia de pared · Esc cancela';
    else h.textContent = touch ? 'Tocá para ubicar · tocá de nuevo o ✓ para colocar' : 'Click para colocar · R rota · C color · Esc cancela';
  } else if (app.selected >= 0) {
    h.textContent = '';
  } else {
    h.textContent = touch ? 'Elegí un objeto del catálogo' : 'Elegí un objeto del catálogo · click en un objeto para editarlo';
  }
}

function syncTop() {
  $('#btn-undo').disabled = !app.undoStack.length;
  $('#btn-redo').disabled = !app.redoStack.length;
  const night = $('#btn-night');
  night.setAttribute('aria-pressed', String(app.prefs.night));
  night.querySelector('use').setAttribute('href', app.prefs.night ? '#i-sun' : '#i-moon');
  const snd = $('#btn-sound');
  snd.setAttribute('aria-pressed', String(app.prefs.sound));
  snd.querySelector('use').setAttribute('href', app.prefs.sound ? '#i-sound' : '#i-mute');
  const gridBtn = document.querySelector('[data-action="grid"]');
  gridBtn.textContent = app.prefs.grid ? 'Ocultar cuadrícula' : 'Mostrar cuadrícula';
}

function syncMode() {
  $('#app').dataset.mode = app.mode;
  $('#tab-build').setAttribute('aria-selected', String(app.mode === 'build'));
  $('#tab-play').setAttribute('aria-selected', String(app.mode === 'play'));
  requestAnimationFrame(() => app.resize());
  syncBars();
}

// ───────────────────────── Eventos de App ─────────────────────────
app.onChange((kind, data) => {
  switch (kind) {
    case 'toast': toast(data); break;
    case 'sfx': sound.sfx(data); break;
    case 'music': sound.setPlaying(app.isMusicPlaying()); break;
    case 'history': syncTop(); break;
    case 'room': sound.setPlaying(app.isMusicPlaying()); syncBars(); syncRoomDialog(); break;
    case 'tool': syncCatalogSelection(); syncBars(); break;
    case 'ghost':
    case 'selection': syncBars(); break;
    case 'mode': syncMode(); break;
    case 'cursor':
      canvas.classList.toggle('placing', data === 'placing');
      canvas.classList.toggle('pointing', data === 'pointing');
      break;
    default:
  }
});

// ───────────────────────── Entrada ─────────────────────────
let pinchZoom = 1;
attachPointer(canvas, {
  hover: (x, y) => app.hoverAt(x, y),
  tap: (x, y, info) => app.tapAt(x, y, info),
  pan: (dx, dy) => app.pan(dx, dy),
  wheel: (dy, x, y) => app.zoomTo(app.view.zoom + (dy < 0 ? 1 : -1), x, y),
  pinch: (ratio, cx, cy, phase) => {
    if (phase === 'start') pinchZoom = app.view.zoom;
    else if (phase === 'move') app.zoomTo(pinchZoom * ratio, cx, cy);
  },
});

const PAN_STEP = 40;
attachKeys({
  key(e) {
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (k === 'z' || k === 'Z')) {
      if (e.shiftKey) app.redo();
      else app.undo();
      return true;
    }
    if (mod && (k === 'y' || k === 'Y')) {
      app.redo();
      return true;
    }
    if (mod) return false;
    const play = app.mode === 'play';
    const dirs = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
    if (play && dirs[k]) {
      app.stepAvatar(...dirs[k]);
      return true;
    }
    if (!play && k.startsWith('Arrow')) {
      const [dx, dy] = dirs[k];
      app.pan(-dx * PAN_STEP, -dy * PAN_STEP);
      return true;
    }
    switch (k.toLowerCase()) {
      case 'escape':
        if (app.tool) app.cancelTool();
        else app.select(-1);
        return true;
      case 'r': app.rotate(); return true;
      case 'c': app.recolor(); return true;
      case 'e': app.toggleSelected(); return true;
      case 'm': app.moveSelected(); return true;
      case 'd': app.duplicateSelected(); return true;
      case 'delete':
      case 'backspace': app.removeSelected(); return true;
      case 'enter': if (app.tool) app.placeGhost(); return true;
      case 'n': toggleNight(); return true;
      case 'g': toggleGrid(); return true;
      case 'b': app.setMode('build'); return true;
      case 'p': app.setMode('play'); return true;
      case '+':
      case '=': app.zoomTo(app.view.zoom + 1); return true;
      case '-': app.zoomTo(app.view.zoom - 1); return true;
      case '0': app.fit(); return true;
      case '?': $('#dlg-help').showModal(); return true;
      default: return false;
    }
  },
});

// ───────────────────────── Botones ─────────────────────────
for (const b of document.querySelectorAll('.segmented [data-mode]')) b.addEventListener('click', () => app.setMode(b.dataset.mode));
$('#btn-undo').addEventListener('click', () => app.undo());
$('#btn-redo').addEventListener('click', () => app.redo());

function toggleNight() {
  app.prefs.night = !app.prefs.night;
  app.savePrefs();
  app.invalidate();
  syncTop();
}
function toggleGrid() {
  app.prefs.grid = !app.prefs.grid;
  app.savePrefs();
  app.invalidate();
  syncTop();
}
$('#btn-night').addEventListener('click', toggleNight);
$('#btn-sound').addEventListener('click', () => {
  app.prefs.sound = !app.prefs.sound;
  app.savePrefs();
  sound.setEnabled(app.prefs.sound);
  sound.setPlaying(app.isMusicPlaying());
  if (app.prefs.sound && !app.isMusicPlaying()) toast('Sonido activado · encendé el tocadiscos 🎶');
  syncTop();
});
$('#btn-zoom-in').addEventListener('click', () => app.zoomTo(app.view.zoom + 1));
$('#btn-zoom-out').addEventListener('click', () => app.zoomTo(app.view.zoom - 1));
$('#btn-zoom-fit').addEventListener('click', () => app.fit());

$('#placebar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-place]');
  if (!b) return;
  const a = b.dataset.place;
  if (a === 'rotate') app.rotate();
  else if (a === 'color') app.recolor();
  else if (a === 'ok') app.placeGhost();
  else if (a === 'cancel') app.cancelTool();
});

$('#selbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sel]');
  if (!b) return;
  const a = b.dataset.sel;
  if (a === 'toggle') app.toggleSelected();
  else if (a === 'rotate') app.rotate();
  else if (a === 'color') app.recolor();
  else if (a === 'move') app.moveSelected();
  else if (a === 'duplicate') app.duplicateSelected();
  else if (a === 'delete') app.removeSelected();
  else if (a === 'close') app.select(-1);
});

// Catálogo plegable (celular)
$('#catalog-handle').addEventListener('click', () => {
  const h = $('#catalog-handle');
  const open = h.getAttribute('aria-expanded') !== 'true';
  h.setAttribute('aria-expanded', String(open));
  $('#catalog-body').hidden = !open;
  requestAnimationFrame(() => app.resize());
});

// ───────────────────────── Menú ─────────────────────────
const menuBtn = $('#btn-menu');
const menu = $('#menu');
function setMenu(open) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('button')?.focus();
}
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenu(menu.hidden);
});
document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target)) setMenu(false);
});
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') {
    setMenu(false);
    menuBtn.focus();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    items[(i + 1) % items.length].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    items[(i - 1 + items.length) % items.length].focus();
  }
});
menu.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  setMenu(false);
  switch (b.dataset.action) {
    case 'room': syncRoomDialog(); $('#dlg-room').showModal(); break;
    case 'look': app.cycleLook(); break;
    case 'grid': toggleGrid(); break;
    case 'share': openShare(); break;
    case 'export': exportImage(); break;
    case 'demo': app.loadDemo(); toast('Habitación de ejemplo cargada · Deshacer para volver'); break;
    case 'new':
      if (window.confirm('¿Vaciar la habitación? Podés deshacerlo con Ctrl+Z.')) app.newRoom();
      break;
    case 'help': $('#dlg-help').showModal(); break;
    default:
  }
});

// ───────────────────────── Diálogo de habitación ─────────────────────────
function swatchRow(el, colors, current, onPick, label) {
  el.replaceChildren();
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', label);
  colors.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === current));
    b.setAttribute('aria-label', `${label} ${i + 1}`);
    b.addEventListener('click', () => onPick(i));
    el.append(b);
  });
}

function syncRoomDialog() {
  const r = app.room;
  $('#in-w').value = r.w;
  $('#out-w').textContent = r.w;
  $('#in-d').value = r.d;
  $('#out-d').textContent = r.d;
  swatchRow($('#sw-wall'), WALL_COLORS, r.wall, (i) => app.setRoomProp('wall', i), 'Pared');
  swatchRow($('#sw-floor'), FLOOR_COLORS, r.floor, (i) => app.setRoomProp('floor', i), 'Piso');
  const fs = $('#floor-styles');
  fs.replaceChildren();
  fs.setAttribute('role', 'radiogroup');
  fs.setAttribute('aria-label', 'Tipo de piso');
  FLOOR_STYLES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = s.name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === r.floorStyle));
    b.addEventListener('click', () => app.setRoomProp('floorStyle', i));
    fs.append(b);
  });
}
for (const [id, prop] of [['#in-w', 'w'], ['#in-d', 'd']]) {
  const input = $(id);
  input.addEventListener('input', () => {
    $(id.replace('in', 'out')).textContent = input.value;
  });
  input.addEventListener('change', () => app.setRoomProp(prop, Number(input.value)));
}

// ───────────────────────── Compartir / exportar ─────────────────────────
function openShare() {
  const url = app.shareUrl();
  $('#share-url').value = url;
  $('#btn-share-native').hidden = !navigator.share;
  $('#dlg-share').showModal();
  $('#share-url').select();
}
$('#btn-share-copy').addEventListener('click', async () => {
  const url = $('#share-url').value;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado ✔');
  } catch {
    $('#share-url').select();
    toast('Seleccioná el link y copialo');
  }
});
$('#btn-share-native').addEventListener('click', async () => {
  try {
    await navigator.share({ title: 'Mi habitación en DIMENSION33', url: $('#share-url').value });
  } catch {
    /* el usuario canceló */
  }
});

async function exportImage() {
  const blob = await app.exportPng();
  if (!blob) return toast('No se pudo exportar');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dimension33-habitacion.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Imagen exportada');
}

// ───────────────────────── Arranque ─────────────────────────
new ResizeObserver(() => app.resize()).observe($('#stage'));
buildCatalog();
app.boot();
syncTop();
syncMode();
if (!app.prefs.help) {
  app.prefs.help = true;
  app.savePrefs();
  setTimeout(() => $('#dlg-help').showModal(), 400);
}
if (app.prefs.sound) {
  // El audio requiere un gesto: se habilita en el primer toque
  window.addEventListener('pointerdown', () => sound.setEnabled(true), { once: true });
}

// PWA: solo en contextos seguros (https o localhost)
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// QA: ?debug expone la instancia para pruebas automatizadas (no se usa en producción)
if (new URLSearchParams(location.search).has('debug')) window.d33 = app;
