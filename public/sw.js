// Service worker: makes the site installable and quick to open.
// Pages load from the network first (so a new deploy shows straight away) and
// fall back to the last copy when offline. Hashed build files and fonts are
// cached. Supabase requests are never touched, so notes are always live data.
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  const hashed = url.origin === self.location.origin && url.pathname.startsWith('/assets/');
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!hashed && !font) return;

  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached && hashed) return cached;
      const network = fetch(request)
        .then((response) => {
          if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached ?? Response.error());
      return cached ?? network;
    }),
  );
});
