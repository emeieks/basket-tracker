// Service Worker — Basketball Tracker
// Cache toutes les images joueurs pour affichage instantané hors-ligne

const CACHE_NAME = 'bkt-images-v2';
const IMAGE_HOSTS = [
  'khjljfeknwwktfjjznhp.supabase.co',
  'a.espncdn.com',
  'cdn.nba.com',
  'media-cdn.cortextech.io',
  'media-cdn.incrowdsports.com',
  'upload.wikimedia.org',
];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isImageRequest(url) {
  // Images par extension
  if (/\.(png|jpg|jpeg|webp|svg|gif|avif)(\?.*)?$/i.test(url.href)) return true;
  // Supabase Storage (URL sans extension forcément)
  if (url.pathname.includes('/storage/v1/object/public/')) return true;
  // ESPN sans extension
  if (url.hostname.includes('a.espncdn.com') && url.pathname.includes('/i/')) return true;
  return false;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Seulement les hosts connus
  if (!IMAGE_HOSTS.some(h => url.hostname.includes(h))) return;
  // Seulement les images
  if (!isImageRequest(url)) return;

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        // ✅ En cache → instantané
        if (cached) return cached;

        // Pas en cache → fetch + stocker
        // no-cors pour les hosts externes (ESPN, Wikipedia...)
        const isExternal = !url.hostname.includes('supabase.co');
        const fetchReq = isExternal
          ? new Request(e.request.url, { mode: 'no-cors', cache: 'default' })
          : e.request.clone();

        return fetch(fetchReq).then(response => {
          // Stocker si ok OU si réponse opaque (status 0 = no-cors)
          if (response.ok || response.status === 0) {
            cache.put(e.request, response.clone());
          }
          return response;
        }).catch(() => cached || new Response('', { status: 404 }));
      })
    )
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      e.source.postMessage('CACHE_CLEARED');
    });
  }
});
