/* Comrade service worker: app-shell cache (installable, opens offline) + web push. */

const VERSION = 'comrade-v2'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/badge-96.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/**
 * Navigations: network first, fall back to the cached app shell (so the installed app opens
 * with no connection and shows saved notices).
 * Built assets (/assets/*, content-hashed): cache first.
 * Everything else (dev server modules, API calls, other origins): untouched.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/', { cacheName: SHELL }).then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(ASSETS).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})

function show(n) {
  const urgent = n.priority === 'URGENT' || n.priority === 'HIGH'
  return self.registration.showNotification(n.title, {
    body: n.body,
    tag: n.deliveryId || n.notificationId,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    requireInteraction: n.priority === 'URGENT',
    renotify: urgent,
    vibrate: urgent ? [200, 100, 200] : undefined,
    data: { url: `/notice/${n.notificationId}` },
  })
}

/**
 * Real web push (Phase 9, FCM). The payload carries a short-lived signed `ackToken`, so the worker
 * can confirm receipt even when Comrade isn't open: that is the device ACK that cancels the
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

/** Mock mode: the page asks us to show a system notification (works while the app is in the background). */
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
