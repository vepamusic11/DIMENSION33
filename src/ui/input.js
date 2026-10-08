// Entrada unificada: mouse, touch, lápiz y teclado → eventos de alto nivel.
//   hover(x, y, type)            puntero sin presionar (solo mouse)
//   tap(x, y, {type, button})    toque/click corto sin arrastre
//   pan(dx, dy)                  arrastre con un dedo / botón
//   pinch(ratio, cx, cy, phase)  zoom con dos dedos ('start' | 'move' | 'end')
//   wheel(dy, x, y)              rueda del mouse / trackpad
// Las coordenadas son en px CSS relativos al canvas.
const TAP_SLOP = 8; // px que puede moverse un toque sin volverse arrastre

export function attachPointer(el, h) {
  const pts = new Map();
  let dragging = false;
  let pinching = false;
  let pinchStart = 0;

  const local = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinchInfo = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  el.addEventListener('pointerdown', (e) => {
    el.focus({ preventScroll: true });
    const p = local(e);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores no lo permiten en todos los casos */
    }
    pts.set(e.pointerId, { ...p, sx: p.x, sy: p.y, lx: p.x, ly: p.y, button: e.button, type: e.pointerType });
    if (pts.size === 2) {
      pinching = true;
      dragging = false;
      const pi = pinchInfo();
      pinchStart = pi.d || 1;
      h.pinch(1, pi.cx, pi.cy, 'start');
    } else if (pts.size === 1) {
      dragging = false;
      pinching = false;
    }
  });

  el.addEventListener('pointermove', (e) => {
    const p = local(e);
    const s = pts.get(e.pointerId);
    if (!s) {
      if (e.pointerType === 'mouse') h.hover(p.x, p.y, e.pointerType);
      return;
    }
    s.x = p.x;
    s.y = p.y;
    if (pinching && pts.size >= 2) {
      const pi = pinchInfo();
      h.pinch(pi.d / pinchStart, pi.cx, pi.cy, 'move');
      return;
    }
    if (!dragging && Math.hypot(p.x - s.sx, p.y - s.sy) > TAP_SLOP) dragging = true;
    if (dragging) {
      h.pan(p.x - s.lx, p.y - s.ly);
      if (e.pointerType === 'mouse') el.style.cursor = 'grabbing';
    } else if (e.pointerType === 'mouse') {
      h.hover(p.x, p.y, e.pointerType);
    }
    s.lx = p.x;
    s.ly = p.y;
  });

  const end = (e, cancelled) => {
    const s = pts.get(e.pointerId);
    if (!s) return;
    pts.delete(e.pointerId);
    el.style.cursor = '';
    if (pinching) {
      if (pts.size < 2) {
        pinching = false;
        h.pinch(1, s.x, s.y, 'end');
      }
      dragging = true; // evita que el dedo que queda dispare un tap
      return;
    }
    if (!cancelled && !dragging) h.tap(s.x, s.y, { type: s.type, button: s.button });
    dragging = false;
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
  el.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pts.size) h.hover(null, null, 'mouse');
  });
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      h.wheel(e.deltaY, p.x, p.y);
    },
    { passive: false },
  );
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** Atajos de teclado globales (ignorados mientras se escribe en un campo o hay un diálogo abierto). */
export function attachKeys(h) {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (document.querySelector('dialog[open]')) return;
    if (h.key(e) === true) e.preventDefault();
  });
}
