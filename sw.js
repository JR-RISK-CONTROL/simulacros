/* Service worker: permite usar la app sin conexión.
   Al publicar cambios, suba el número de VERSION para que los celulares descarguen la nueva versión. */
const VERSION = 'simulacro-v1.0.0';
const ARCHIVOS = [
  './',
  'index.html',
  'styles.css',
  'config.js',
  'pdf.js',
  'app.js',
  'jspdf.umd.min.js',
  'jspdf.plugin.autotable.min.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Primero la copia guardada (rápido y offline); en segundo plano se actualiza desde la red */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const red = fetch(req)
          .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
        return hit || red;
      })
    )
  );
});
