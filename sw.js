// ============================================
// WATCHMORE - Service Worker & Push Notifications
// ============================================

const CACHE_NAME = 'watchmore-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './utils.js',
  './components.js',
  './router.js',
  './home.js',
  './discover.js',
  './tv.js',
  './search.js',
  './library.js',
  './detail.js',
  './ai.js',
  './app.js'
];

const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>";

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

// Push notification handler (works when browser receives push from server)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'WatchMore';
  const body = data.body || 'New content available!';
  const ad = data.ad || 'Sponsored: Stream Premium Movies 50% Off!';

  e.waitUntil(
    self.registration.showNotification(title, {
      body: body + '\n\n' + ad,
      icon: ICON,
      badge: ICON,
      tag: data.tag || 'watchmore-' + Date.now(),
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const url = e.notification.data?.url || './';
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Demo periodic notifications from main thread message
let notifTimer = null;
self.addEventListener('message', e => {
  if (e.data === 'start-demo-notifications') {
    if (notifTimer) clearInterval(notifTimer);
    const messages = [
      { title: 'New Movie Added! 🍿', body: 'Check out the latest trending movies now.', ad: 'Ad: Get Premium Streaming 50% OFF — Limited Time!' },
      { title: 'Continue Watching? ▶️', body: 'You left a movie halfway. Resume now!', ad: 'Ad: VPN Deal — 70% Off Today Only!' },
      { title: 'Top Rated This Week ⭐', body: 'Discover what everyone is watching.', ad: 'Ad: Upgrade to Premium — No Ads, Full HD!' },
      { title: 'New Episode Available 📺', body: 'Your favorite TV show just dropped a new episode.', ad: 'Ad: Disney+ Bundle — Save 40% This Month!' }
    ];
    notifTimer = setInterval(() => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      self.registration.showNotification(msg.title, {
        body: msg.body + '\n\n' + msg.ad,
        icon: ICON,
        badge: ICON,
        tag: 'watchmore-demo-' + Date.now(),
        requireInteraction: false,
        actions: [
          { action: 'open', title: 'Watch Now' },
          { action: 'dismiss', title: 'Later' }
        ],
        data: { url: './' }
      });
    }, 45000); // Demo: every 45 seconds
  }
  if (e.data === 'stop-demo-notifications') {
    if (notifTimer) clearInterval(notifTimer);
  }
});
