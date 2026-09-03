/* ============================================================
   Jotter service worker — offline support + installability
   Strategy: network-first with cache fallback, so updates
   arrive immediately and the app still works offline.
   Bump CACHE version whenever you change app files.
   ============================================================ */
const CACHE = 'jotter-v13';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './markdown.js',
  './app.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => caches.open(CACHE).then((c) => c.addAll(ASSETS)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./');
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
      )
  );
});
