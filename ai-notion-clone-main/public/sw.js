// Sika Creative OS - Service Worker for Mobile Notifications & PWA
const CACHE_NAME = 'sika-os-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listener PUSH NOTIFICATION (Saat aplikasi DITUTUP / CLOSE APPS di HP)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Sika Creative OS';
    const options = {
      body: data.body || '',
      icon: data.icon || '/touch icon sika-04.png',
      badge: data.badge || '/touch icon sika-03.png',
      // Pola getar berulang agar terasa jelas di HP
      vibrate: [300, 100, 300, 100, 300],
      // Tag unik memicu heads-up popup banner di atas layar Android
      tag: data.tag || `heads-up-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'open', title: 'Open' }
      ],
      data: {
        url: data.url || '/',
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push notification:', err);
  }
});

// Listener untuk pesan dari client window untuk menampilkan notifikasi HP saat terbuka
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/touch icon sika-04.png',
      badge: '/touch icon sika-03.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: `heads-up-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      actions: [
        { action: 'open', title: 'Open' }
      ],
      ...options,
    });
  }
});

// Listener saat notifikasi di klik di HP
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika tab sudah terbuka, bawa ke depan dan arahkan
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Jika belum ada tab yang terbuka (aplikasi tertutup), buka jendela baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
