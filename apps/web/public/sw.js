// quranbench service worker.
//
// Scope: cache the app shell and previously-visited public corpus pages so the
// site opens and reads offline. It deliberately does NOT cache database-backed
// content (investigations, the API) without explicit user action — a reader
// must never see stale or private community/editorial data served as if fresh
// (docs/extensibility.md, CLAUDE.md non-negotiable rules).
//
// Full offline *search* is not shipped: the token index is tens of megabytes
// and cannot be built reliably in a mobile browser. See /offline and the
// project report. This SW gives offline *reading* of cached pages instead.

const VERSION = 'qb-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const PAGE_CACHE = `${VERSION}-pages`;

const SHELL = ['/offline', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

// Paths whose responses are database-backed or user-specific and must not be
// cached without an explicit action.
const NO_CACHE_PREFIXES = ['/investigations', '/api/', '/compare'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return !NO_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Page navigations: network-first, fall back to the cached page, then the
  // offline shell. Successful same-origin corpus pages are cached for reading.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(url) && response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match('/offline'));
        }),
    );
    return;
  }

  // Static assets (icons, the manifest, Next static chunks): cache-first.
  if (isCacheable(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && (url.pathname.startsWith('/_next/static') || SHELL.includes(url.pathname))) {
              const copy = response.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
