const CACHE = 'alerta-shell-v1'
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])))
  self.skipWaiting()
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
self.addEventListener('push', (event) => {
  let data = { title: 'Alerta', body: 'Hay una nueva señal del grupo' }
  try { if (event.data) data = { ...data, ...event.data.json() } } catch { data = { ...data, body: event.data?.text() ?? data.body } }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, vibrate: [700, 180, 700, 180, 1200], icon: '/icon.svg', badge: '/icon.svg', tag: data.tag ?? `alerta-${Date.now()}`, renotify: true, requireInteraction: true, silent: false, data: { sound: data.sound ?? 'default' } }))
})
self.addEventListener('notificationclick', (event) => { event.notification.close(); event.waitUntil(clients.openWindow('/')) })
