/**
 * Service worker MLBB Almanac.
 *
 * Strategi:
 *   - navigasi (HTML): network-first, fallback ke cache lalu ke snapshot offline.
 *   - aset statis (js/css/font): cache-first.
 *   - /api/heroes + /api/deltas: stale-while-revalidate, dan hasilnya
 *     dicache supaya aplikasi tetap punya data saat offline.
 */
const VERSION = 'mlbb-almanac-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/brand/mlbb-a-transparent.svg',
  // Aset arkib (sejarah patch) - dicache supaya tab Patch boleh dibuka
  // tanpa jaringan.
  '/archive/core.json',
  '/archive/reference.json',
  '/archive/docs.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? Response.error();
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('/index.html');
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Arkib: stale-while-revalidate. Cache lama mungkin menyimpan bentuk
  // JSON yang lama (kunci yang hilang) - jadi cache dipulangkan serta
  // disegarkan di belakang, dan pelawat seterusnya dapat fail terkini.
  if (url.pathname.startsWith('/archive/') && url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && /\.(?:js|css|png|svg|webp|woff2?|json)$/.test(url.pathname)) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
