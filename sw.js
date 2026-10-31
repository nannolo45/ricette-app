// Offline support. Each app version is cached as a whole; a new version is
// downloaded in the background and takes over when the user taps "Update"
// (or the next time the app is started from scratch).
const VERSION = 'ricette-v31';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/sync.js', 'js/parse.js', 'js/i18n.js', 'js/photos.js', 'js/expiry.js', 'js/barcode.js', 'js/scanner.js', 'js/products.js', 'js/recipe-text.js', 'js/dish-image.js', 'js/recipe-tools.js', 'js/categories.js', 'js/sortable.js', 'js/nutrition.js', 'js/lang-food.js', 'js/online.js', 'js/times.js', 'js/geo.js', 'js/book-fix.js', 'js/shops.js', 'js/shoplist.js', 'js/depts.js', 'js/shop-status.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages lets it keep files for 10 minutes)
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  // A fresh start of the app: if no other window is open, switch to this version right away.
  if (type === 'SKIP_IF_ALONE') {
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      if (wins.length <= 1) return self.skipWaiting();
      return null;
    }));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // GitHub API etc. go straight to network

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    if (cached) return cached;
    try {
      const res = await fetch(req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' }));
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  })());
});

// Daily expiry reminders sent by the GitHub Action.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'Ricette', {
    body: msg.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: msg.tag || 'expiry',
    data: { url: msg.url || './#/pantry' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './#/pantry', self.registration.scope).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
