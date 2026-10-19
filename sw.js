/* =====================================================
   SERVICE WORKER - My Studio Pro
   Versão: v1 (sempre que mudar o app, aumente esse número)
   ===================================================== */

const CACHE_NAME = 'my-studio-pro-v1';

const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icone-512.png',
  './icone-512.png'
];

const CDN_CACHE = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versão', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const obrigatorios = cache.addAll(ARQUIVOS_CACHE);
      const cdn = Promise.allSettled(
        CDN_CACHE.map(url => cache.add(url).catch(err => console.warn('[SW] Falha CDN:', url, err)))
      );
      return Promise.all([obrigatorios, cdn]);
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando versão', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Ignora chamadas do Firebase
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('firebaseio.com') ||
      request.url.includes('identitytoolkit.googleapis.com') ||
      request.url.includes('securetoken.googleapis.com') ||
      request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  const url = new URL(request.url);

  // HTML / navegação: NETWORK-FIRST
  if (request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
          }
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // CDN: CACHE-FIRST
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
          }
          return response;
        });
      })
    );
    return;
  }

  // Outros arquivos locais: NETWORK-FIRST
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* ---------- MENSAGENS DO APP ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
