/* Comrade service worker: web push only (no offline caching, no install). */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

function show(n) {
  const urgent = n.priority === 'URGENT' || n.priority === 'HIGH'
  return self.registration.showNotification(n.title, {
    body: n.body,
    tag: n.deliveryId || n.notificationId,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    requireInteraction: n.priority === 'URGENT',
    renotify: urgent,
    vibrate: urgent ? [200, 100, 200] : undefined,
    data: { url: `/notice/${n.notificationId}` },
  })
}

/**
 * Real web push (Phase 9, FCM). The payload carries a short-lived signed `ackToken`, so the worker
 * can confirm receipt even when no Comrade tab is open: that is the device ACK that cancels the
 * SMS fallback. In mock mode no real pushes arrive; the page sends us SHOW messages instead.
 */
self.addEventListener('push', (event) => {
  let n
  try {
    n = event.data ? event.data.json() : {}
  } catch {
    n = { title: 'Comrade', body: event.data ? event.data.text() : '' }
  }
  const data = n.data || n
  const tasks = [show({ title: data.title || 'New notice', body: data.body || '', priority: data.priority, notificationId: data.notificationId, deliveryId: data.deliveryId })]
  if (data.ackUrl && data.ackToken) {
    tasks.push(
      fetch(data.ackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId: data.deliveryId, token: data.ackToken, channel: 'WEB_PUSH' }),
      }).catch(() => undefined),
    )
  }
  event.waitUntil(Promise.all(tasks))
})

/** Mock mode: the page asks us to show a system notification (works while the tab is in the background). */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW') event.waitUntil(show(event.data.notification))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/inbox'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url).catch(() => undefined)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
