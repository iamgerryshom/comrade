import { countDeliveries, markPushed, newDelivery } from '@/core/delivery/state'
import { isCandidate, runFallbackCheck, type DeliveryRepo, type SmsProvider } from '@/core/delivery/engine'
import { resolveAudience } from '@/core/audience'
import type { AuditLog, Notification, User } from '@/types'
import type { CallContext } from './session'
import { newId } from './session'
import { store } from './store'

/**
 * Server-side logic of the mock backend: fan-out, the SMS fallback worker, scheduled sends,
 * SMS delivery reports and notification counters. In Phase 9 these become Cloud Functions
 * (sendNotification fan-out, checkDelivery Cloud Task, scheduled safety net, AT webhook, onWrite trigger).
 */

export function settings() {
  return store.get('settings', 'app')!
}

export function writeAudit(ctx: CallContext, entry: Omit<AuditLog, 'id' | 'actorId' | 'actorName' | 'actorRole' | 'createdAt'>) {
  store.set('auditLogs', {
    id: newId('aud'),
    actorId: ctx.user.uid,
    actorName: ctx.user.name,
    actorRole: ctx.user.role,
    createdAt: ctx.now,
    ...entry,
  })
}

/** Create one delivery per recipient (batched like Firestore's 500-write limit) and "push" it. */
export function fanOut(n: Notification, now: Date): number {
  const recipients = resolveAudience(n.audience, { users: store.list('users'), groups: store.list('savedGroups') }, { excludeUid: n.senderId })
  const BATCH = 500
  for (let i = 0; i < recipients.length; i += BATCH) {
    store.transaction(() => {
      for (const uid of recipients.slice(i, i + BATCH)) {
        const u = store.get('users', uid) as User
        const d = newDelivery(newId('dlv'), n, u, now, n.ackTimeoutSeconds)
        // Push dispatched on every channel (mock: BroadcastChannel to the recipient's tabs + SW notification)
        store.set('deliveries', markPushed(d, now) ?? d)
      }
    })
  }
  store.update('notifications', n.id, { status: 'SENT', sentAt: now, updatedAt: now })
  recount(n.id)
  return recipients.length
}

export function recount(notificationId: string) {
  const ds = store.list('deliveries', (d) => d.notificationId === notificationId)
  store.update('notifications', notificationId, { counts: countDeliveries(ds) })
}

// ───────── Fallback worker ─────────

const repo: DeliveryRepo = {
  async listCandidates(now) {
    return store.list('deliveries', (d) => isCandidate(d, now))
  },
  async transition(id, when, patch) {
    // Synchronous check-and-set = atomic in a single JS thread (Firestore: runTransaction)
    const cur = store.get('deliveries', id)
    if (!cur || !when(cur)) return null
    return store.update('deliveries', id, patch(cur)) ?? null
  },
  async getRecipient(uid) {
    return store.get('users', uid)
  },
  async getNotification(id) {
    return store.get('notifications', id)
  },
  async saveSms(sms) {
    store.set('smsMessages', sms)
  },
  newId: () => newId('sms'),
}

/** Mock SMS provider. Numbers ending in 99999 are rejected (to demo retries → SMS_FAILED). */
export const mockSmsProvider: SmsProvider = {
  async send(to) {
    await new Promise((r) => setTimeout(r, 120))
    if (to.endsWith('99999')) throw new Error('Provider rejected the number (InvalidPhoneNumber)')
    return { providerMessageId: `ATXid_${Math.random().toString(36).slice(2, 12)}`, costKes: settings().smsCostKes }
  },
}

/** Simulated delivery-report webhook: SENT → DELIVERED a few seconds later. */
function processSmsReports(now: Date) {
  const due = store.list('smsMessages', (s) => s.status === 'SENT' && now.getTime() - s.createdAt.getTime() > 3000)
  for (const s of due) {
    store.transaction(() => {
      store.update('smsMessages', s.id, { status: 'DELIVERED', deliveredAt: now })
      if (s.deliveryId) {
        const d = store.get('deliveries', s.deliveryId)
        if (d?.status === 'SMS_SENT') store.update('deliveries', d.id, { status: 'SMS_DELIVERED', updatedAt: now })
      }
    })
  }
}

function processScheduled(now: Date) {
  const due = store.list('notifications', (n) => n.status === 'SCHEDULED' && !!n.scheduledFor && n.scheduledFor.getTime() <= now.getTime())
  for (const n of due) {
    // Claim first so two workers can't both send it
    const claimed = store.get('notifications', n.id)
    if (claimed?.status !== 'SCHEDULED') continue
    store.update('notifications', n.id, { status: 'SENT', sentAt: now, updatedAt: now })
    fanOut({ ...n, status: 'SENT' }, now)
  }
}

let running = false
export async function workerTick(now = new Date()) {
  if (running) return
  running = true
  try {
    processScheduled(now)
    const report = await runFallbackCheck(repo, mockSmsProvider, now, { senderId: settings().smsSenderId })
    processSmsReports(now)
    const touched = new Set(
      [...report.sent, ...report.skipped, ...report.failed, ...report.retrying].map((id) => store.get('deliveries', id)?.notificationId),
    )
    for (const id of dirty) touched.add(id)
    dirty.clear()
    for (const id of touched) if (id) recount(id)
  } finally {
    running = false
  }
}

/** Notifications whose deliveries changed (ACK/read from other tabs): an onWrite trigger recomputes counts. */
const dirty = new Set<string>()

let isWorker = false
const workerListeners = new Set<(on: boolean) => void>()
export const workerState = {
  get: () => isWorker,
  on(cb: (on: boolean) => void) {
    workerListeners.add(cb)
    return () => workerListeners.delete(cb)
  },
}

/**
 * Elect one tab as the "server" with the Web Locks API. The lock is held until the tab closes,
 * then the next waiting tab takes over.
 */
export function startWorker() {
  store.subscribe((changes) => {
    if (!isWorker) return
    for (const c of changes) {
      if (c.col === 'deliveries' && c.doc) dirty.add((c.doc as { notificationId: string }).notificationId)
    }
  })
  const run = () =>
    new Promise<void>(() => {
      isWorker = true
      for (const l of workerListeners) l(true)
      setInterval(() => void workerTick(), 2000)
    })
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    void navigator.locks.request('comrade-worker', run)
  } else {
    void run()
  }
}
