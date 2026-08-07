const CACHE_NAME = 'erp-talent-hub-v8';
const ASSETS = [
  '/ERP-Talent-Hub/',
  '/ERP-Talent-Hub/index.html',
  '/ERP-Talent-Hub/manifest.json',
  '/ERP-Talent-Hub/icon-192.png',
  '/ERP-Talent-Hub/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
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
  const url = new URL(event.request.url);
  const isAPI = url.hostname.includes('supabase') ||
                url.hostname.includes('elevenlabs') ||
                url.hostname.includes('anthropic') ||
                url.hostname.includes('emailjs');

  if (isAPI) {
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

// ── PUSH NOTIFICATIONS ──────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'ERP Talent Hub', body: event.data.text() }; }

  const options = {
    body:    data.body || 'You have a new notification',
    icon:    '/ERP-Talent-Hub/icon-192.png',
    badge:   '/ERP-Talent-Hub/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/ERP-Talent-Hub/' },
    actions: [
      { action: 'open',    title: 'Open app' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'ERP Talent Hub', options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('ERP-Talent-Hub') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data?.url || '/ERP-Talent-Hub/');
    })
  );
});

// ── BACKGROUND SYNC (for offline messages) ─────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  // Placeholder for background sync of pending messages
  console.log('Background sync: messages');
}
