const CACHE_NAME = 'coruja-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Estratégia Network-First para tudo durante a fase de ajuste fino
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});