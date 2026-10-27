// Hors ligne : on sert le réseau quand il répond (mises à jour immédiates),
// sinon la copie gardée sur la tablette.
const CACHE = 'hbibiti-v10';
// Les voix enregistrées ne changent jamais (le nom du fichier vient du texte) : cache à part, gardé entre les versions.
const VOICES = 'hbibiti-voix';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'core.js', 'art.js', 'audio.js', 'games.js', 'store.js', 'exercises.js', 'characters.js', 'tales.js', 'missions.js', 'voix.js', 'ville.js', 'ville-core.js', 'carnet.js', 'calendrier.js', 'activites.js', 'act-kit.js', 'act-data.js', 'act-ecole.js', 'act-monde.js', 'act-jeux.js', 'act-famille.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== VOICES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/voix\/[a-z0-9]+\.mp3$/.test(url.pathname)) {
    e.respondWith(caches.open(VOICES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
