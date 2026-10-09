// Service worker: permite jugar sin conexión e instalar como app.
// Estrategia: "stale-while-revalidate" para archivos propios (rápido y se actualiza solo).
// Subí CACHE_VERSION en cada release que cambie archivos de la lista.
const CACHE_VERSION = 'd33-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/app.js',
  './src/ui/styles.css',
  './src/ui/input.js',
  './src/ui/audio.js',
  './src/ui/storage.js',
  './src/engine/config.js',
  './src/engine/color.js',
  './src/engine/raster.js',
  './src/engine/iso.js',
  './src/game/catalog.js',
  './src/game/room.js',
  './src/game/scene.js',
  './src/game/avatar.js',
  './src/game/pathfind.js',
  './src/game/demo.js',
  './assets/icons/icon-32.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nunca cachear terceros
  e.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // El hash (#r=...) no viaja al servidor, así que index.html se comparte entre habitaciones
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
