// Acceso seguro a localStorage: puede no existir o lanzar (modo privado, cuotas,
// iframes con almacenamiento bloqueado). Nunca debe romper el juego.
export function load(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadJSON(key, fallback) {
  const raw = load(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? { ...fallback, ...v } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  return save(key, JSON.stringify(value));
}
