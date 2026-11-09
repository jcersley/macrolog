// Offline cache for the app itself. Bump VERSION on every update so phones fetch the new files. Food database requests (other origins) are never cached.
const VERSION = 'macrolog-v7'; // keep in step with js/version.js
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/nutrition.js',
  'js/store.js',
  'js/lookup.js',
  'js/scanner.js',
  'js/charts.js',
  'js/backup.js',
  'js/version.js',
  'js/guard.js',
  'js/views/today.js',
  'js/views/add.js',
  'js/views/foodform.js',
  'js/views/foods.js',
  'js/views/mealbuilder.js',
  'js/views/recipes.js',
  'js/views/progress.js',
  'js/views/profile.js',
  'vendor/zxing-reader.js',
  'vendor/zxing_reader.wasm',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache right away, refresh the cache in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) return cached;
      const res = await network;
      return res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
    })
  );
});
