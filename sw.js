/* Merlin Gets a Job — minimal offline cache for static GitHub Pages hosting.
   Cache-first for same-origin GET requests; versioned cache name.
   No skipWaiting / clients.claim: a freshly-installed worker does NOT take over
   the page that registered it, so it never interferes with the running session
   (or with Playwright, which navigates once per isolated context). Offline support
   kicks in on the next visit — standard PWA behaviour. */
const CACHE = 'merlin-gets-job-v1.0';

// Essential same-origin assets only. Query strings must match index.html exactly.
const ASSETS = [
  './',
  './index.html',
  './game.js?v=1.0',
  './style.css?v=1.0',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  // Drop any older Merlin caches from previous releases.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('merlin-gets-job-') && k !== CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // same-origin only
  // Cache-first: precached assets serve offline; everything else hits the network.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
