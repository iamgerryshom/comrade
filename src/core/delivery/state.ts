import type { AckChannel, Delivery, DeliveryCounts, DeliveryStatus, Notification, User } from '@/types'

/**
 * Delivery state machine (pure).
 *
 *   PENDING → PUSHED → DELIVERED (ACK) → READ
 *   PENDING/PUSHED → SMS_QUEUED → SMS_SENT → SMS_DELIVERED | SMS_FAILED
 *   any SMS_* + late ACK → DELIVERED_AFTER_SMS   (never a second SMS)
 *   PENDING/PUSHED + no phone / opted out → SMS_SKIPPED
 */

export const AWAITING_ACK: DeliveryStatus[] = ['PENDING', 'PUSHED']
export const ACKED: DeliveryStatus[] = ['DELIVERED', 'READ', 'DELIVERED_AFTER_SMS']
export const SMS_PATH: DeliveryStatus[] = ['SMS_QUEUED', 'SMS_SENT', 'SMS_DELIVERED', 'SMS_FAILED']

export function newDelivery(
  id: string,
  n: Pick<Notification, 'id' | 'title' | 'category' | 'priority' | 'senderName' | 'senderId' | 'audience'>,
  recipient: { uid: string; name: string },
  now: Date,
  ackTimeoutSeconds: number,
): Delivery {
  return {
    id,
    notificationId: n.id,
    userId: recipient.uid,
    recipientName: recipient.name,
    senderId: n.senderId,
    status: 'PENDING',
    title: n.title,
    category: n.category,
    priority: n.priority,
    senderName: n.senderName,
    unitId: n.audience.targetType === 'UNIT' ? n.audience.targetId : null,
    createdAt: now,
    ackDeadline: new Date(now.getTime() + ackTimeoutSeconds * 1000),
    pushedAt: null,
    ackedAt: null,
    ackChannel: null,
    ackDeviceId: null,
    readAt: null,
    archivedAt: null,
    smsId: null,
    smsAttempts: 0,
    nextSmsAttemptAt: null,
    skipReason: null,
    updatedAt: now,
  }
}

export function markPushed(d: Delivery, now: Date): Delivery | null {
  if (d.status !== 'PENDING') return null
  return { ...d, status: 'PUSHED', pushedAt: now, updatedAt: now }
}

export type AckResult = 'ACKED' | 'ALREADY_ACKED' | 'LATE_ACK' | 'REJECTED'

/** Idempotent ACK. Only the recipient may ACK. Never changes SMS bookkeeping. */
export function applyAck(
  d: Delivery,
  by: { userId: string; deviceId: string; channel: AckChannel },
  now: Date,
): { result: AckResult; delivery: Delivery } {
  if (by.userId !== d.userId) return { result: 'REJECTED', delivery: d }
  if (d.ackedAt) return { result: 'ALREADY_ACKED', delivery: d }
  const ack = { ackedAt: now, ackChannel: by.channel, ackDeviceId: by.deviceId, updatedAt: now }
  if (AWAITING_ACK.includes(d.status)) return { result: 'ACKED', delivery: { ...d, ...ack, status: 'DELIVERED' } }
  if (d.status === 'SMS_SKIPPED') return { result: 'ACKED', delivery: { ...d, ...ack, status: 'DELIVERED' } }
  if (SMS_PATH.includes(d.status))
    return { result: 'LATE_ACK', delivery: { ...d, ...ack, status: 'DELIVERED_AFTER_SMS' } }
  return { result: 'ALREADY_ACKED', delivery: d }
}

/** Opening a notice proves the device has it: also counts as an ACK if none yet. */
export function applyRead(d: Delivery, userId: string, deviceId: string, now: Date): Delivery | null {
  if (userId !== d.userId) return null
  if (d.readAt) return d
  const acked = applyAck(d, { userId, deviceId, channel: 'IN_APP' }, now).delivery
  const status: DeliveryStatus = acked.status === 'DELIVERED' ? 'READ' : acked.status
  return { ...acked, status, readAt: now, updatedAt: now }
}

export function isDueForFallback(d: Delivery, now: Date): boolean {
  return AWAITING_ACK.includes(d.status) && !d.ackedAt && d.ackDeadline.getTime() <= now.getTime()
}

export function isDueForRetry(d: Delivery, now: Date): boolean {
  return d.status === 'SMS_QUEUED' && !!d.nextSmsAttemptAt && d.nextSmsAttemptAt.getTime() <= now.getTime()
}

export type FallbackDecision = { action: 'SEND'; to: string } | { action: 'SKIP'; reason: string }

export function decideFallback(
  recipient: Pick<User, 'phone' | 'smsOptOut' | 'isActive'> | undefined,
  n: Pick<Notification, 'allowSmsFallback' | 'priority'>,
): FallbackDecision {
  const urgent = n.priority === 'URGENT'
  if (!n.allowSmsFallback && !urgent) return { action: 'SKIP', reason: 'Sender turned off SMS fallback' }
  if (!recipient || !recipient.isActive) return { action: 'SKIP', reason: 'Recipient inactive' }
  if (!recipient.phone) return { action: 'SKIP', reason: 'No phone number on file' }
  if (recipient.smsOptOut && !urgent) return { action: 'SKIP', reason: 'Recipient opted out of SMS' }
  return { action: 'SEND', to: recipient.phone }
}

export const MAX_SMS_ATTEMPTS = 3
/** Exponential backoff: 5s, 10s, 20s… */
export function retryDelayMs(attempt: number): number {
  return 5000 * 2 ** Math.max(0, attempt - 1)
}

export function emptyCounts(): DeliveryCounts {
  return { total: 0, pending: 0, delivered: 0, read: 0, sms: 0, failed: 0, skipped: 0 }
}

/** Aggregate counts shown on the sender's timeline and stored on the notification. */
export function countDeliveries(ds: Pick<Delivery, 'status' | 'readAt'>[]): DeliveryCounts {
  const c = emptyCounts()
  for (const d of ds) {
    c.total++
    if (d.readAt) c.read++
    switch (d.status) {
      case 'PENDING':
      case 'PUSHED':
      case 'SMS_QUEUED':
        c.pending++
        break
      case 'DELIVERED':
      case 'READ':
        c.delivered++
        break
      case 'SMS_SENT':
      case 'SMS_DELIVERED':
      case 'DELIVERED_AFTER_SMS':
        c.sms++
        break
      case 'SMS_FAILED':
        c.failed++
        break
      case 'SMS_SKIPPED':
        c.skipped++
        break
    }
  }
  return c
}

const RANK: Record<DeliveryStatus, number> = {
  PENDING: 0,
  PUSHED: 1,
  SMS_QUEUED: 2,
  SMS_SENT: 3,
  SMS_DELIVERED: 4,
  SMS_FAILED: 4,
  SMS_SKIPPED: 4,
  DELIVERED: 5,
  READ: 6,
  DELIVERED_AFTER_SMS: 6,
}
const earliest = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() <= b.getTime() ? a : b)

/**
 * Merge two concurrent versions of a delivery (mock multi-tab sync only; Firestore transactions
 * make this unnecessary). ACK/read facts are monotonic and never lost; SMS facts are never lost.
 */
export function mergeDelivery(local: Delivery, remote: Delivery): Delivery {
  const ackedAt = earliest(local.ackedAt, remote.ackedAt)
  const readAt = earliest(local.readAt, remote.readAt)
  const ackSrc = ackedAt && ackedAt === local.ackedAt ? local : remote
  const smsId = remote.smsId ?? local.smsId
  const smsTouched = !!smsId || SMS_PATH.includes(local.status) || SMS_PATH.includes(remote.status)
  let status: DeliveryStatus
  if (ackedAt && smsTouched) status = 'DELIVERED_AFTER_SMS'
  else if (ackedAt) status = readAt ? 'READ' : 'DELIVERED'
  else status = RANK[local.status] > RANK[remote.status] ? local.status : remote.status
  return {
    ...remote,
    status,
    ackedAt,
    readAt,
    ackChannel: ackSrc.ackChannel,
    ackDeviceId: ackSrc.ackDeviceId,
    smsId,
    smsAttempts: Math.max(local.smsAttempts, remote.smsAttempts),
    archivedAt: remote.archivedAt ?? local.archivedAt,
  }
}
