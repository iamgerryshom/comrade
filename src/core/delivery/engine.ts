import type { Delivery, Notification, SmsMessage, User } from '@/types'
import { buildSmsText } from './sms'
import { decideFallback, isDueForFallback, isDueForRetry, MAX_SMS_ATTEMPTS, retryDelayMs } from './state'

/**
 * Storage the fallback engine needs. The mock store implements it in memory;
 * Cloud Functions implement it with Firestore transactions (`transition` = runTransaction).
 */
export interface DeliveryRepo {
  /** Deliveries that may need work: awaiting ACK past deadline, or SMS retries due. */
  listCandidates(now: Date): Promise<Delivery[]>
  /**
   * Atomic conditional update: apply `patch` only if `when(current)` is true.
   * Returns the updated doc, or null if the condition failed (someone else handled it).
   */
  transition(id: string, when: (d: Delivery) => boolean, patch: (d: Delivery) => Partial<Delivery>): Promise<Delivery | null>
  getRecipient(uid: string): Promise<Pick<User, 'uid' | 'phone' | 'smsOptOut' | 'isActive'> | undefined>
  getNotification(id: string): Promise<Notification | undefined>
  saveSms(sms: SmsMessage): Promise<void>
  newId(): string
}

export interface SmsProvider {
  send(to: string, text: string, senderId: string): Promise<{ providerMessageId: string; costKes: number }>
}

export interface FallbackOptions {
  senderId: string
  defaultCostKes?: number
}

export interface FallbackReport {
  sent: string[]
  skipped: string[]
  failed: string[]
  retrying: string[]
}

/**
 * One pass of the SMS fallback worker. Safe to run concurrently: each delivery is claimed with a
 * conditional transition, so exactly one runner sends its SMS.
 */
export async function runFallbackCheck(
  repo: DeliveryRepo,
  sms: SmsProvider,
  now: Date,
  opts: FallbackOptions,
): Promise<FallbackReport> {
  const report: FallbackReport = { sent: [], skipped: [], failed: [], retrying: [] }
  const candidates = await repo.listCandidates(now)
  for (const c of candidates) {
    // 1. Claim. First attempt: PENDING/PUSHED → SMS_QUEUED. Retry: clear nextSmsAttemptAt.
    const claimed = await repo.transition(
      c.id,
      (d) => isDueForFallback(d, now) || isDueForRetry(d, now),
      (d) => ({ status: d.status === 'SMS_QUEUED' ? d.status : 'SMS_QUEUED', nextSmsAttemptAt: null, updatedAt: now }),
    )
    if (!claimed) continue

    const n = await repo.getNotification(claimed.notificationId)
    const recipient = await repo.getRecipient(claimed.userId)
    const decision = n ? decideFallback(recipient, n) : ({ action: 'SKIP', reason: 'Notification missing' } as const)

    if (decision.action === 'SKIP') {
      await repo.transition(
        claimed.id,
        (d) => d.status === 'SMS_QUEUED',
        () => ({ status: 'SMS_SKIPPED', skipReason: decision.reason, updatedAt: now }),
      )
      report.skipped.push(claimed.id)
      continue
    }

    const text = buildSmsText({
      senderId: opts.senderId,
      category: n!.category,
      title: n!.title,
      body: n!.body,
      senderLabel: n!.senderLabel,
      shortCode: n!.shortCode,
    })
    const attempt = claimed.smsAttempts + 1
    const smsId = claimed.smsId ?? repo.newId()
    const base: SmsMessage = {
      id: smsId,
      deliveryId: claimed.id,
      notificationId: claimed.notificationId,
      userId: claimed.userId,
      to: decision.to,
      text,
      senderId: opts.senderId,
      status: 'QUEUED',
      providerMessageId: null,
      costKes: 0,
      attempt,
      error: null,
      createdAt: now,
      deliveredAt: null,
    }

    try {
      const res = await sms.send(decision.to, text, opts.senderId)
      await repo.saveSms({ ...base, status: 'SENT', providerMessageId: res.providerMessageId, costKes: res.costKes })
      // A late ACK may have landed meanwhile (DELIVERED_AFTER_SMS): keep that status, just link the SMS.
      await repo.transition(
        claimed.id,
        () => true,
        (d) => ({
          status: d.status === 'SMS_QUEUED' ? 'SMS_SENT' : d.status,
          smsId,
          smsAttempts: attempt,
          updatedAt: now,
        }),
      )
      report.sent.push(claimed.id)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const final = attempt >= MAX_SMS_ATTEMPTS
      await repo.saveSms({ ...base, status: 'FAILED', error })
      await repo.transition(
        claimed.id,
        () => true,
        (d) => ({
          status: d.status === 'SMS_QUEUED' ? (final ? 'SMS_FAILED' : 'SMS_QUEUED') : d.status,
          smsId,
          smsAttempts: attempt,
          nextSmsAttemptAt: final ? null : new Date(now.getTime() + retryDelayMs(attempt)),
          updatedAt: now,
        }),
      )
      ;(final ? report.failed : report.retrying).push(claimed.id)
    }
  }
  return report
}

/** Exposed for the repo implementations' candidate query. */
export function isCandidate(d: Delivery, now: Date): boolean {
  return isDueForFallback(d, now) || isDueForRetry(d, now)
}
