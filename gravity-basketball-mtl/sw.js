// Service worker « kill switch ».
//
// L'ancien site (déployé en drag & drop avant l'import dans ce repo, PR #16)
// installait un service worker /sw.js qui mettait des pages en cache. Ce
// fichier n'a jamais été rapatrié : les visiteurs qui l'avaient déjà gardaient
// l'ancien worker, qui continuait de servir des pages périmées (ex. la page
// « Infos maillot » introuvable hors navigation privée).
//
// Le navigateur revérifie /sw.js à chaque visite : cette version remplace
// l'ancienne, vide tous les caches, se désinstalle et recharge les onglets
// ouverts pour qu'ils passent directement par le réseau.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
