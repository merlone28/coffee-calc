const CACHE = 'coffee-calc-v23';
const ASSETS = ['./', './index.html', './manifest.json', './favicon.png', './css/style.css', './js/core.js', './js/data/methods.js', './js/data/methods-en.js', './js/data/recipes.js', './js/i18n.js', './js/app.js', './js/grinder.js', './js/render.js', './js/timer.js', './js/units.js', './js/notify.js', './js/share.js', './js/diary.js', './js/main.js', './js/sw-register.js', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './fonts/chakra-petch-latin-400-normal.woff2', './fonts/chakra-petch-latin-500-normal.woff2', './fonts/chakra-petch-latin-600-normal.woff2', './fonts/chakra-petch-latin-700-normal.woff2', './fonts/jetbrains-mono-latin-wght-normal.woff2'];

// Il nuovo SW resta in attesa finché la pagina non conferma (banner "Aggiorna"),
// così il codice non cambia sotto i piedi a pagina aperta.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: risposta subito dalla cache, aggiornamento in background.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const network = fetch(e.request).then(resp => {
        if (resp && resp.ok && new URL(e.request.url).origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      return cached || network;
    })
  );
});
