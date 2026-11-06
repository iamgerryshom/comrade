/** Browser notification helpers (service worker registration, permission, system notifications, badge). */

let registration: Promise<ServiceWorkerRegistration | null> | null = null

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration
  if (!('serviceWorker' in navigator)) return (registration = Promise.resolve(null))
  registration = navigator.serviceWorker.register('/sw.js').catch((e) => {
    console.warn('Service worker registration failed', e)
    return null
  })
  return registration
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  const p = await Notification.requestPermission()
  if (p === 'granted') await registerServiceWorker()
  return p
}

export async function showSystemNotification(n: { notificationId: string; deliveryId: string; title: string; body: string; priority: string }) {
  if (notificationPermission() !== 'granted') return
  const reg = await registerServiceWorker()
  const sw = reg?.active ?? navigator.serviceWorker?.controller
  if (sw) sw.postMessage({ type: 'SHOW', notification: n })
  else new Notification(n.title, { body: n.body, tag: n.deliveryId })
}

/** Unread count on the tab title and (where supported) the app badge. */
export function setUnreadBadge(count: number) {
  const base = 'Comrade'
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (count > 0) nav.setAppBadge?.(count).catch(() => undefined)
  else nav.clearAppBadge?.().catch(() => undefined)
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

/** Light haptic feedback on supported phones (no-op elsewhere). */
export function haptic(kind: 'tap' | 'success' | 'warning' = 'tap') {
  vibrate(kind === 'tap' ? 8 : kind === 'success' ? [12, 40, 18] : [30, 60, 30])
}
