// Nudged's service worker: makes the app installable and opens it when a notification is tapped.
// No offline caching: reminders need the live server anyway.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((t) => t.url.startsWith(self.location.origin))
      return open ? open.focus() : self.clients.openWindow('/nudges')
    }),
  )
})
