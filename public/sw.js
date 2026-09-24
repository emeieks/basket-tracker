const CACHE_NAME = 'bkt-images-v3';
const IMAGE_HOSTS = [
  'khjljfeknwwktfjjznhp.supabase.co',
  'a.espncdn.com',
  'cdn.nba.com',
  'media-cdn.cortextech.io',
  'upload.wikimedia.org',
];

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isImageRequest(url, method) {
  // Ne jamais cacher les requêtes non-GET
  if (method !== 'GET') return false;
  // Images par extension
  if (/\.(png|jpg|jpeg|webp|svg|gif|avif)(\?.*)?$/i.test(url.href)) return true;
  // Supabase Storage GET uniquement
  if (url.pathname.includes('/storage/v1/object/public/')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const method = e.request.method;

  // Ignorer tout ce qui n'est pas GET (POST, PATCH, DELETE...)
  if (method !== 'GET') return;

  // Seulement les hosts d'images connus
  if (!IMAGE_HOSTS.some(h => url.hostname.includes(h))) return;

  // Seulement les vraies images
  if (!isImageRequest(url, method)) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) cache.put(e.request, response.clone());
          return response;
        }).catch(() => cached || new Response('', { status: 404 }));
      })
    )
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => e.source.postMessage('CACHE_CLEARED'));
  }
});
