
const CACHE_NAME = 'coruja-v2'; // Incrementando a versão do cache
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// O evento 'install' ocorre quando o navegador detecta um novo sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força o Service Worker a se tornar ativo imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// O evento 'activate' limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  // Garante que o novo Service Worker controle a página imediatamente
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
