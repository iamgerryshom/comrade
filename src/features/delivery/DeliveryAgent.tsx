import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getServices } from '@/services'
import { AWAITING_ACK, SMS_PATH } from '@/core/delivery/state'
import { setUnreadBadge, showSystemNotification, vibrate } from '@/lib/push'
import type { Delivery } from '@/types'
import { useAuth } from '@/features/auth/AuthProvider'

/**
 * Runs in every signed-in tab: the "device" side of the delivery engine.
 * When a delivery for this user arrives (push), it immediately ACKs it, so the server knows the
 * device really got it and cancels the SMS fallback. Then it shows a toast and a system
 * notification, and updates the unread badge.
 *
 * While "Simulate offline" is on, the inbox subscription is paused, so nothing arrives and nothing
 * is ACKed. When the device comes back online it catches up: late ACKs become DELIVERED_AFTER_SMS.
 */
export function DeliveryAgent() {
  const { profile } = useAuth()
  const uid = profile?.uid
  const navigate = useNavigate()
  const qc = useQueryClient()
  const handled = useRef(new Set<string>())
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (!uid) return
    const { notifications, deliveries, devices } = getServices()
    const deviceId = devices.getDeviceId()
    handled.current.clear()
    startedAt.current = Date.now()

    return notifications.subscribeToInbox(uid, (items: Delivery[]) => {
      qc.setQueryData(['inbox', uid], items)
      setUnreadBadge(items.filter((d) => !d.readAt && !d.archivedAt).length)

      for (const d of items) {
        if (d.ackedAt || handled.current.has(d.id)) continue
        const recent = Date.now() - d.createdAt.getTime() < 60 * 60_000
        // Push arrives now: awaiting ACK, or (late) after the SMS already went out
        const shouldAck = AWAITING_ACK.includes(d.status) || (recent && (SMS_PATH.includes(d.status) || d.status === 'SMS_SKIPPED'))
        if (!shouldAck) continue
        handled.current.add(d.id)
        const background = document.visibilityState !== 'visible'
        void deliveries.ack(d.id, deviceId, background ? 'SERVICE_WORKER' : 'IN_APP').catch(() => handled.current.delete(d.id))

        const isNew = d.createdAt.getTime() >= startedAt.current - 5000 || SMS_PATH.includes(d.status)
        if (!isNew) continue
        const loud = d.priority === 'HIGH' || d.priority === 'URGENT'
        if (loud) vibrate(d.priority === 'URGENT' ? [300, 100, 300, 100, 300] : [200, 100, 200])
        toast(d.title, {
          description: `${d.senderName} · ${d.category.toLowerCase()}`,
          action: { label: 'Open', onClick: () => navigate(`/notice/${d.notificationId}`) },
          duration: d.priority === 'URGENT' ? 15000 : 6000,
          className: d.priority === 'URGENT' ? 'border-red-500' : undefined,
        })
        if (background || loud) void showSystemNotification({ notificationId: d.notificationId, deliveryId: d.id, title: d.title, body: `From ${d.senderName}`, priority: d.priority })
      }
    })
  }, [uid, qc, navigate])

  // Keep this device's record fresh
  useEffect(() => {
    if (!uid) return
    const { devices } = getServices()
    void devices.registerDevice(uid, { notificationsEnabled: typeof Notification !== 'undefined' && Notification.permission === 'granted' })
  }, [uid])

  return null
}
