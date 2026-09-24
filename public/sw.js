// ── SERVICE WORKER — Cache images joueurs & logos ─────────────────────────────
const CACHE_NAME = 'bets-images-v1';

// Patterns d'URL à mettre en cache (images uniquement)
const IMAGE_PATTERNS = [
  /supabase\.co\/storage\/v1\/object\/public\/avatars\//,
  /supabase\.co\/storage\/v1\/object\/public\//,
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.webp$/i,
  /\.gif$/i,
  /\.svg$/i,
];

function isImage(url) {
  return IMAGE_PATTERNS.some(p => p.test(url));
}

// ── INSTALL : pré-cache rien (cache dynamique au fur et à mesure) ─────────────
self.addEventListener('install', event => {
  self.skipWaiting();
});

// ── ACTIVATE : nettoyer les vieux caches ──────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH : Cache-first pour les images ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignorer les requêtes non-GET et non-images
  if (event.request.method !== 'GET') return;
  if (!isImage(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Vérifier le cache d'abord
      const cached = await cache.match(event.request);
      if (cached) {
        // Image trouvée en cache → réponse immédiate
        // Revalider en arrière-plan (stale-while-revalidate)
        fetch(event.request)
          .then(fresh => {
            if (fresh && fresh.ok) cache.put(event.request, fresh.clone());
          })
          .catch(() => {});
        return cached;
      }

      // 2. Pas en cache → fetch réseau et mettre en cache
      try {
        const response = await fetch(event.request);
        if (response && response.ok && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        // Réseau indisponible et pas en cache → erreur normale
        return new Response('', { status: 408, statusText: 'Offline' });
      }
    })
  );
});

// ── MESSAGE : permet de vider le cache depuis l'app ──────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0]?.postMessage('CACHE_CLEARED');
    });
  }
  if (event.data === 'CACHE_SIZE') {
    caches.open(CACHE_NAME).then(async cache => {
      const keys = await cache.keys();
      event.ports[0]?.postMessage({ count: keys.length });
    });
  }
});
