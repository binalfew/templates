/// <reference lib="webworker" />

// ─── Cache Names ──────────────────────────────────────────
const STATIC_CACHE = "static-v2";
const API_CACHE = "api-v2";
const PAGE_CACHE = "pages-v2";
const KNOWN_CACHES = [STATIC_CACHE, API_CACHE, PAGE_CACHE];

// ─── Static Assets to Precache ────────────────────────────
const PRECACHE_URLS = ["/admin", "/manifest.json", "/favicon.ico"];

// ─── Install: Precache Shell ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate: Clean Old Caches ───────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch: Route to Strategy ─────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // API routes: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages: stale-while-revalidate
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE));
    return;
  }

  // Default: cache-first for other resources
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Strategy: Cache-First ────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// ─── Strategy: Network-First ──────────────────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('{"error":"offline"}', {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── Strategy: Stale-While-Revalidate ─────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// ─── Helpers ──────────────────────────────────────────────
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|ico|webp|avif)(\?.*)?$/.test(pathname) ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/");
}

// ─── Message Handler: Skip Waiting on Update ──────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
