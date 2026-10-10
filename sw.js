// Service worker for offline support + installability (Phase 5). Bump CACHE when the asset
// list below changes meaningfully, so returning users pick up the new files instead of stale ones.
const CACHE = 'leantrack-v8'; // bumped: toast confirmation when a food is added
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './foodapi.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Cache-first for same-origin app files (works offline); cross-origin requests (Open Food Facts)
// are left untouched so the existing try/catch handling in foodapi.js/app.js still applies.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Lets a notification click focus/open the app instead of doing nothing.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow('./index.html');
    })
  );
});
