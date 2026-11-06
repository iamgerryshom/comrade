import { beforeEach, describe, expect, it } from 'vitest'
import type { Delivery, Notification, SmsMessage, User } from '@/types'
import { runFallbackCheck, isCandidate, type DeliveryRepo, type SmsProvider } from './engine'
import { applyAck, applyRead, countDeliveries, markPushed, mergeDelivery, newDelivery } from './state'
import { buildSmsText, SMS_MAX } from './sms'

const T0 = new Date('2026-11-06T09:00:00Z')
const at = (s: number) => new Date(T0.getTime() + s * 1000)

const notification: Notification = {
  id: 'n1',
  shortCode: 'K7Q2',
  title: 'COMP 210 CAT moved to Fri 14 Nov, 10am, LH3',
  body: 'Same topics as before.',
  category: 'EXAM',
  priority: 'HIGH',
  senderId: 'lec',
  senderName: 'Dr. Ogeto',
  senderRole: 'LECTURER',
  senderPosition: null,
  senderLabel: 'Lecturer COMP210',
  audience: { targetType: 'UNIT', targetId: 'u1' },
  audienceLabel: 'COMP 210',
  attachment: null,
  allowSmsFallback: true,
  status: 'SENT',
  scheduledFor: null,
  ackTimeoutSeconds: 60,
  counts: countDeliveries([]),
  createdAt: T0,
  updatedAt: T0,
  sentAt: T0,
}

type Recipient = Pick<User, 'uid' | 'phone' | 'smsOptOut' | 'isActive'>

/** In-memory repo with the same atomic conditional-update semantics as a Firestore transaction. */
function makeRepo(recipients: Recipient[], n: Notification = notification) {
  const deliveries = new Map<string, Delivery>()
  const sms: SmsMessage[] = []
  let seq = 0
  for (const r of recipients) {
    const d = newDelivery(`d_${r.uid}`, n, { uid: r.uid, name: r.uid }, T0, n.ackTimeoutSeconds)
    deliveries.set(d.id, markPushed(d, T0)!)
  }
  const repo: DeliveryRepo = {
    async listCandidates(now) {
      return [...deliveries.values()].filter((d) => isCandidate(d, now))
    },
    async transition(id, when, patch) {
      // yield first so concurrent runners genuinely interleave
      await Promise.resolve()
      const cur = deliveries.get(id)
      if (!cur || !when(cur)) return null
      const next = { ...cur, ...patch(cur) }
      deliveries.set(id, next)
      return next
    },
    async getRecipient(uid) {
      return recipients.find((r) => r.uid === uid)
    },
    async getNotification() {
      return n
    },
    async saveSms(m) {
      const i = sms.findIndex((x) => x.id === m.id)
      if (i >= 0) sms[i] = m
      else sms.push(m)
    },
    newId: () => `sms_${++seq}`,
  }
  return { repo, deliveries, sms }
}

function provider(opts: { fail?: boolean } = {}) {
  const sent: Array<{ to: string; text: string }> = []
  const p: SmsProvider = {
    async send(to, text) {
      await new Promise((r) => setTimeout(r, 5))
      if (opts.fail) throw new Error('network')
      sent.push({ to, text })
      return { providerMessageId: `AT${sent.length}`, costKes: 0.8 }
    },
  }
  return { p, sent }
}

const student: Recipient = { uid: 'stu', phone: '+254700001234', smsOptOut: false, isActive: true }
const opts = { senderId: 'COMRADE-KSU' }

describe('delivery engine', () => {
  let r: ReturnType<typeof makeRepo>
  let sms: ReturnType<typeof provider>
  beforeEach(() => {
    r = makeRepo([student])
    sms = provider()
  })

  it('ACK before the deadline → DELIVERED, no SMS ever', async () => {
    const d = r.deliveries.get('d_stu')!
    const { result, delivery } = applyAck(d, { userId: 'stu', deviceId: 'dev1', channel: 'IN_APP' }, at(3))
    expect(result).toBe('ACKED')
    r.deliveries.set(d.id, delivery)
    await runFallbackCheck(r.repo, sms.p, at(61), opts)
    await runFallbackCheck(r.repo, sms.p, at(600), opts)
    expect(sms.sent).toHaveLength(0)
    expect(r.deliveries.get('d_stu')!.status).toBe('DELIVERED')
  })

  it('never marks delivered at send time', () => {
    expect(r.deliveries.get('d_stu')!.status).toBe('PUSHED')
    expect(r.deliveries.get('d_stu')!.ackedAt).toBeNull()
  })

  it('no ACK → nothing before the deadline, exactly one SMS after it', async () => {
    await runFallbackCheck(r.repo, sms.p, at(59), opts)
    expect(sms.sent).toHaveLength(0)
    await runFallbackCheck(r.repo, sms.p, at(60), opts)
    await runFallbackCheck(r.repo, sms.p, at(62), opts)
    await runFallbackCheck(r.repo, sms.p, at(120), opts)
    expect(sms.sent).toHaveLength(1)
    expect(sms.sent[0].to).toBe(student.phone)
    const d = r.deliveries.get('d_stu')!
    expect(d.status).toBe('SMS_SENT')
    expect(d.smsId).toBe('sms_1')
    expect(r.sms[0]).toMatchObject({ status: 'SENT', providerMessageId: 'AT1', costKes: 0.8 })
  })

  it('late ACK after SMS → DELIVERED_AFTER_SMS and no second SMS', async () => {
    await runFallbackCheck(r.repo, sms.p, at(61), opts)
    const d = r.deliveries.get('d_stu')!
    const { result, delivery } = applyAck(d, { userId: 'stu', deviceId: 'dev1', channel: 'IN_APP' }, at(300))
    expect(result).toBe('LATE_ACK')
    r.deliveries.set(d.id, delivery)
    await runFallbackCheck(r.repo, sms.p, at(400), opts)
    expect(sms.sent).toHaveLength(1)
    expect(r.deliveries.get('d_stu')!).toMatchObject({ status: 'DELIVERED_AFTER_SMS', ackedAt: at(300) })
  })

  it('opted-out or phoneless students → SMS_SKIPPED with a reason', async () => {
    const r2 = makeRepo([
      { uid: 'optout', phone: '+254700001111', smsOptOut: true, isActive: true },
      { uid: 'nophone', phone: null, smsOptOut: false, isActive: true },
    ])
    await runFallbackCheck(r2.repo, sms.p, at(61), opts)
    expect(sms.sent).toHaveLength(0)
    expect(r2.deliveries.get('d_optout')).toMatchObject({ status: 'SMS_SKIPPED', skipReason: 'Recipient opted out of SMS' })
    expect(r2.deliveries.get('d_nophone')).toMatchObject({ status: 'SMS_SKIPPED', skipReason: 'No phone number on file' })
  })

  it('URGENT overrides SMS opt-out', async () => {
    const r2 = makeRepo([{ uid: 'optout', phone: '+254700001111', smsOptOut: true, isActive: true }], { ...notification, priority: 'URGENT' })
    await runFallbackCheck(r2.repo, sms.p, at(61), opts)
    expect(sms.sent).toHaveLength(1)
  })

  it('two worker checks at the same moment → still exactly one SMS', async () => {
    const many = makeRepo(Array.from({ length: 25 }, (_, i) => ({ ...student, uid: `s${i}`, phone: `+2547000${String(10000 + i)}` })))
    await Promise.all([
      runFallbackCheck(many.repo, sms.p, at(61), opts),
      runFallbackCheck(many.repo, sms.p, at(61), opts),
      runFallbackCheck(many.repo, sms.p, at(61), opts),
    ])
    expect(sms.sent).toHaveLength(25)
    expect(new Set(sms.sent.map((s) => s.to)).size).toBe(25)
  })

  it('retries failures up to 3 times with backoff, then SMS_FAILED', async () => {
    const bad = provider({ fail: true })
    await runFallbackCheck(r.repo, bad.p, at(61), opts)
    let d = r.deliveries.get('d_stu')!
    expect(d).toMatchObject({ status: 'SMS_QUEUED', smsAttempts: 1 })
    expect(d.nextSmsAttemptAt).toEqual(at(66))
    await runFallbackCheck(r.repo, bad.p, at(62), opts) // too early for retry
    expect(r.deliveries.get('d_stu')!.smsAttempts).toBe(1)
    await runFallbackCheck(r.repo, bad.p, at(66), opts)
    d = r.deliveries.get('d_stu')!
    expect(d.smsAttempts).toBe(2)
    expect(d.nextSmsAttemptAt).toEqual(at(76))
    await runFallbackCheck(r.repo, bad.p, at(76), opts)
    d = r.deliveries.get('d_stu')!
    expect(d).toMatchObject({ status: 'SMS_FAILED', smsAttempts: 3, nextSmsAttemptAt: null })
    await runFallbackCheck(r.repo, bad.p, at(1000), opts)
    expect(r.deliveries.get('d_stu')!.smsAttempts).toBe(3)
    expect(r.sms[0]).toMatchObject({ status: 'FAILED', attempt: 3 })
  })

  it('respects a sender who turned SMS fallback off (non-urgent)', async () => {
    const r2 = makeRepo([student], { ...notification, allowSmsFallback: false })
    await runFallbackCheck(r2.repo, sms.p, at(61), opts)
    expect(sms.sent).toHaveLength(0)
    expect(r2.deliveries.get('d_stu')!.status).toBe('SMS_SKIPPED')
  })
})

describe('ACK and read rules', () => {
  const d = markPushed(newDelivery('d1', notification, { uid: 'stu', name: 'S' }, T0, 60), T0)!
  it('only the recipient can ACK', () => {
    expect(applyAck(d, { userId: 'someone-else', deviceId: 'x', channel: 'IN_APP' }, at(1)).result).toBe('REJECTED')
  })
  it('ACK is idempotent', () => {
    const first = applyAck(d, { userId: 'stu', deviceId: 'x', channel: 'IN_APP' }, at(1)).delivery
    const second = applyAck(first, { userId: 'stu', deviceId: 'y', channel: 'SERVICE_WORKER' }, at(5))
    expect(second.result).toBe('ALREADY_ACKED')
    expect(second.delivery).toBe(first)
  })
  it('reading counts as an ACK and moves to READ', () => {
    const read = applyRead(d, 'stu', 'dev', at(10))!
    expect(read).toMatchObject({ status: 'READ', ackedAt: at(10), readAt: at(10) })
    expect(applyRead(d, 'other', 'dev', at(10))).toBeNull()
  })
  it('a concurrent tab merge never loses the ACK or the SMS', () => {
    const smsSide = { ...d, status: 'SMS_SENT' as const, smsId: 'sms1', smsAttempts: 1 }
    const ackSide = applyAck(d, { userId: 'stu', deviceId: 'x', channel: 'IN_APP' }, at(59)).delivery
    expect(mergeDelivery(smsSide, ackSide)).toMatchObject({ status: 'DELIVERED_AFTER_SMS', smsId: 'sms1', ackedAt: at(59) })
    expect(mergeDelivery(ackSide, smsSide)).toMatchObject({ status: 'DELIVERED_AFTER_SMS', smsId: 'sms1', ackedAt: at(59) })
  })
})

describe('SMS text', () => {
  it('matches the template for the spec example', () => {
    const text = buildSmsText({
      category: 'EXAM',
      title: 'COMP 210 CAT moved to Fri 14 Nov, 10am, LH3',
      body: '',
      senderLabel: 'Lecturer COMP210',
      shortCode: 'K7Q2',
    })
    expect(text).toBe('[COMRADE-KSU] EXAM: COMP 210 CAT moved to Fri 14 Nov, 10am, LH3. From: Lecturer COMP210. Ref:K7Q2')
  })
  it('includes a short body and stays within 160 chars', () => {
    const text = buildSmsText({
      category: 'ACADEMIC',
      title: 'Assignment 2 posted',
      body: 'Implement an AVL tree in Java or Python and submit on the e-learning portal by next Monday midnight. Late work loses 10% per day.',
      senderLabel: 'Lecturer COMP210',
      shortCode: 'AB12',
    })
    expect(text.length).toBeLessThanOrEqual(SMS_MAX)
    expect(text).toMatch(/^\[COMRADE-KSU\] ACADEMIC: Assignment 2 posted\. Implement an AVL tree.*…/)
    expect(text.endsWith('From: Lecturer COMP210. Ref:AB12')).toBe(true)
  })
  it('truncates very long titles cleanly and always keeps the Ref', () => {
    const text = buildSmsText({ category: 'GENERAL', title: 'A'.repeat(300), body: 'x', senderLabel: 'Registrar', shortCode: 'ZZ99' })
    expect(text.length).toBeLessThanOrEqual(SMS_MAX)
    expect(text).toContain('…')
    expect(text.endsWith('Ref:ZZ99')).toBe(true)
  })
})
