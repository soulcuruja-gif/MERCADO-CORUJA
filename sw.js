const CACHE_NAME = 'coruja-v3'; // Versão do cache incrementada
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
  // Adicione outros assets estáticos que raramente mudam aqui, se houver
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      // Força a ativação do novo service worker assim que ele for instalado
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Assume o controle de todas as abas abertas imediatamente
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Estratégia: Network First, falling back to Cache
  // Isso é crucial para garantir que os usuários sempre obtenham o HTML mais recente.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/'); // Se a rede falhar, sirva o index.html do cache
      })
    );
    return;
  }

  // Para outros requests (JS, CSS, imagens, etc.), usamos Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Opcional: clonar e salvar a resposta da rede no cache para futuras visitas
        // let clone = networkResponse.clone();
        // caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return networkResponse;
      });
    })
  );
});
