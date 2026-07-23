// Service worker: PWA install + offline mode.
//
// Offline strategy:
//  - the app shell (HTML, manifest, icons) is cached and served
//    network-first with a cache fallback: online the behaviour is unchanged
//    (a new deploy applies immediately), offline the app still boots;
//  - webfonts are cached first — they never change and a cold network
//    would otherwise swap the typeface on every offline launch;
//  - GitHub API calls never go through this cache. All ideas already live in
//    localStorage, and index.html owns the sync queue that replays writes to
//    the Gist once the connection is back.
const STATIC_CACHE = 'ideadrop-static-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const FONT_HOSTS = ['api.fontshare.com', 'cdn.fontshare.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Tolerant adds: one missing asset must not abort the install.
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n !== STATIC_CACHE).map(n => caches.delete(n)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Data goes straight through: index.html handles its own offline fallback.
  if (url.hostname === 'api.github.com') return;

  // Webfonts: cache first, they are immutable.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      // Offline navigation (launching the app): serve the shell.
      if (req.mode === 'navigate') {
        const shell = await caches.match('./');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
