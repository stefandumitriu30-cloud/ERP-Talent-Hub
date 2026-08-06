const CACHE_NAME = 'erp-talent-hub-v1';
const ASSETS = [
  '/ERP-Talent-Hub/',
  '/ERP-Talent-Hub/index.html',
  '/ERP-Talent-Hub/manifest.json',
  '/ERP-Talent-Hub/icon-192.png',
  '/ERP-Talent-Hub/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network first for API calls, cache first for assets
  const url = new URL(event.request.url);
  const isAPI = url.hostname.includes('supabase') ||
                url.hostname.includes('elevenlabs') ||
                url.hostname.includes('anthropic') ||
                url.hostname.includes('emailjs');

  if (isAPI) {
    // Always go network for API calls
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/ERP-Talent-Hub/index.html'));
    })
  );
});
