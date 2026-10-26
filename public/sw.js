// Liquid Steam service worker.
// Strategy:
//  - Navigation (HTML): network-first. A new deploy's index.html references
//    freshly-hashed JS/CSS bundles, so the new version loads on next open.
//  - Static assets (hashed JS/CSS): cache-first, then network. Hashed names
//    mean a new deploy produces NEW filenames, which miss the cache and fetch
//    from network automatically.
//  - Cross-origin (Steam CDN, fonts): never cached, always network.
//
// Auto-update: when this file changes, the browser installs a new SW in the
// background. skipWaiting() makes it activate immediately (instead of waiting
// for all tabs to close), and it posts 'SW_UPDATED' to clients so the app can
// reload into the new version. No uninstall needed.

const CACHE = 'liquisteam-v3';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window' }).then((clients) =>
          clients.forEach((client) =>
            client.postMessage({ type: 'SW_UPDATED' })
          )
        )
      )
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
