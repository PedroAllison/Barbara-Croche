/* Service Worker do painel (PWA) - Barbara Croche */
const CACHE = 'bc-admin-v1';
const ASSETS = [
  '/admin/css/admin.css',
  '/admin/js/admin.js',
  '/admin/icons/icon-192.png',
  '/admin/icons/icon-512.png',
  '/admin/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first (dados sempre frescos), com cache de reserva quando offline.
// Nunca intercepta chamadas de API.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/admin/css/admin.css')))
  );
});
