// Service Worker — Basketball Tracker
// Cache toutes les images joueurs pour affichage instantané hors-ligne

const CACHE_NAME = 'bkt-images-v1';
const IMAGE_HOSTS = [
  'khjljfeknwwktfjjznhp.supabase.co', // Supabase Storage
  'a.espncdn.com',
  'cdn.nba.com',
  'media-cdn.cortextech.io',
  'media-cdn.incrowdsports.com',
  'upload.wikimedia.org',
];

// Installation — pas de pre-cache, on cache à la volée
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Nettoyer les anciens caches
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Intercept fetch — cache-first pour les images
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Seulement les images des hosts connus
  if (!IMAGE_HOSTS.some(h => url.hostname.includes(h))) return;
  if (!e.request.url.match(/\.(png|jpg|jpeg|webp|svg|gif)(\?.*)?$/i) &&
      !e.request.url.includes('/storage/v1/object/public/')) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached; // Instantané depuis le cache

        // Pas en cache → fetch + mettre en cache
        return fetch(e.request.clone()).then(response => {
          if (response.ok) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(() => cached || new Response('', { status: 404 }));
      })
    )
  );
});

// Message pour forcer le refresh du cache
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      e.source.postMessage('CACHE_CLEARED');
    });
  }
});
