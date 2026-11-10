// Service worker: makes Call Journal installable, fast to open, and usable briefly offline.
//
//   App code (/_next/static, icons): cached forever. Next.js gives these unique file names per build.
//   Pages and stock data (/data/...):  network first, so you always get the latest prices;
//                                       the last copy is used when you're offline.
//   Anything on another site (Anthropic API, news links): never touched.

const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const DYNAMIC = `dynamic-${VERSION}`;
const scope = new URL(self.registration.scope).pathname; // e.g. "/call-journal/"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(DYNAMIC).then((c) => c.addAll([scope, `${scope}calls/`, `${scope}stock/`]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (![STATIC, DYNAMIC].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(scope)) return;

  const path = url.pathname.slice(scope.length - 1);
  if (path.startsWith("/_next/static/") || path.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req, url));
  }
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(STATIC);
    await cache.put(req, res.clone());
    trim(cache, 300);
  }
  return res;
}

async function networkFirst(req, url) {
  const cache = await caches.open(DYNAMIC);
  try {
    const res = await fetch(req);
        if (res.ok) { await cache.put(req, res.clone()); trim(cache, 300); }
    return res;
  } catch (err) {
    // Offline: same URL, or for pages the same path without the ?query (e.g. /stock/?s=AAPL -> /stock/)
    const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw err;
  }
}

// The site is redeployed often (new file names each build), so keep each cache to its newest
// `max` entries. Cache keys come back oldest first.
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}
