import { beforeEach, describe, expect, it } from 'vitest'
import { dataset, bscs, comp210 } from '@/test/fixtures'
import { mockFunctions as fn } from './functions'
import { mockAuth } from './auth'
import { setFakeDelay, setSessionUid } from './session'
import { store } from './store'
import { workerTick } from './server'
import { DEMO_PASSWORD } from '@/data/demoAccounts'

const clone = () => structuredClone(dataset)
const as = (uid: string | null) => setSessionUid(uid)
const msg = { title: 'Test notice', body: 'Hello class', category: 'GENERAL' as const, priority: 'NORMAL' as const, allowSmsFallback: true }

describe('mock callable functions enforce auth + permissions', () => {
  beforeEach(() => {
    setFakeDelay(0)
    store.load(clone())
    as(null)
  })

  it('rejects unauthenticated calls', async () => {
    await expect(fn.sendNotification({ ...msg, audience: { targetType: 'UNIT', targetId: comp210.id } })).rejects.toMatchObject({
      code: 'unauthenticated',
    })
    await expect(fn.lookupStudent({ admissionNumber: 'X' })).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('an ordinary student cannot send or look up students', async () => {
    as('u_student')
    await expect(
      fn.sendNotification({ ...msg, audience: { targetType: 'COURSE_YEAR', targetId: bscs.id, yearOfStudy: 2 } }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(fn.lookupStudent({ admissionNumber: store.get('users', 'u_student2')!.admissionNumber! })).rejects.toMatchObject({
      code: 'permission-denied',
    })
    await expect(fn.adminListUsers()).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('a class rep can only send to their course + year', async () => {
    as('u_classrep')
    await expect(
      fn.sendNotification({ ...msg, audience: { targetType: 'COURSE_YEAR', targetId: bscs.id, yearOfStudy: 3 } }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(
      fn.sendNotification({ ...msg, priority: 'URGENT', audience: { targetType: 'COURSE_YEAR', targetId: bscs.id, yearOfStudy: 2 } }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    const ok = await fn.sendNotification({ ...msg, audience: { targetType: 'COURSE_YEAR', targetId: bscs.id, yearOfStudy: 2 } })
    expect(ok.recipientCount).toBeGreaterThan(3)
    expect(store.list('auditLogs', (a) => a.action === 'notification.send' && a.actorId === 'u_classrep')).toHaveLength(1)
  })

  it('validates input with Zod', async () => {
    as('u_lecturer')
    await expect(fn.sendNotification({ ...msg, title: 'x', audience: { targetType: 'UNIT', targetId: comp210.id } })).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  it('rate-limits student senders', async () => {
    as('u_classrep')
    store.update('settings', 'app', { rateLimits: { ...store.get('settings', 'app')!.rateLimits, CLASS_REP: 2 } })
    const send = () => fn.sendNotification({ ...msg, audience: { targetType: 'COURSE_YEAR', targetId: bscs.id, yearOfStudy: 2 } })
    await send()
    await send()
    await expect(send()).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  it('lookups are scoped, masked for student leaders and audited', async () => {
    as('u_classrep')
    const target = store.get('users', 'u_student')!
    const res = await fn.lookupStudent({ admissionNumber: target.admissionNumber! })
    expect(res.phone).toMatch(/^\+2547•+\d{3}$/)
    expect(res.phoneVisibility).toBe('MASKED')
    const other = store.list('users', (u) => u.courseId === bscs.id && u.yearOfStudy === 3)[0]
    await expect(fn.lookupStudent({ admissionNumber: other.admissionNumber! })).rejects.toMatchObject({ code: 'not-found' })
    expect(store.list('auditLogs', (a) => a.action === 'student.search_by_admission' && a.actorId === 'u_classrep')).toHaveLength(2)
    as('u_lecturer')
    expect((await fn.lookupStudent({ admissionNumber: target.admissionNumber! })).phone).toBe(target.phone)
  })

  it('only the recipient can ACK, and ACKs are idempotent', async () => {
    as('u_lecturer')
    const { notificationId } = await fn.sendNotification({ ...msg, audience: { targetType: 'UNIT', targetId: comp210.id } })
    const d = store.list('deliveries', (x) => x.notificationId === notificationId && x.userId === 'u_student')[0]
    expect(d.status).toBe('PUSHED')
    as('u_student2')
    await expect(fn.ackDelivery({ deliveryId: d.id, deviceId: 'x', channel: 'IN_APP' })).rejects.toMatchObject({ code: 'permission-denied' })
    as('u_student')
    expect((await fn.ackDelivery({ deliveryId: d.id, deviceId: 'x', channel: 'IN_APP' })).result).toBe('ACKED')
    expect((await fn.ackDelivery({ deliveryId: d.id, deviceId: 'x', channel: 'IN_APP' })).result).toBe('ALREADY_ACKED')
  })

  it('end to end in the mock backend: online student DELIVERED, offline student gets exactly one SMS', async () => {
    store.update('settings', 'app', { ackTimeoutSeconds: 5 })
    as('u_lecturer')
    const { notificationId } = await fn.sendNotification({ ...msg, audience: { targetType: 'UNIT', targetId: comp210.id } })
    const mine = (uid: string) => store.list('deliveries', (x) => x.notificationId === notificationId && x.userId === uid)[0]
    as('u_student')
    await fn.ackDelivery({ deliveryId: mine('u_student').id, deviceId: 'x', channel: 'IN_APP' })
    const later = new Date(Date.now() + 6000)
    await Promise.all([workerTick(later), workerTick(later)])
    await workerTick(new Date(Date.now() + 8000))
    expect(mine('u_student').status).toBe('DELIVERED')
    expect(mine('u_student2').status).toMatch(/^SMS_(SENT|DELIVERED)$/)
    expect(store.list('smsMessages', (s) => s.userId === 'u_student2' && s.notificationId === notificationId)).toHaveLength(1)
    expect(store.get('notifications', notificationId)!.counts.delivered).toBeGreaterThanOrEqual(1)
  })
})

describe('mock auth', () => {
  beforeEach(() => {
    setFakeDelay(0)
    store.load(clone())
    as(null)
  })
  it('signs in with email or admission number, and exposes claims', async () => {
    await mockAuth.signIn('classrep@demo.kisiiuniversity.ac.ke', DEMO_PASSWORD)
    expect((await mockAuth.getIdTokenClaims())?.positions).toEqual(['CLASS_REP'])
    await mockAuth.signOut()
    const adm = store.get('users', 'u_student')!.admissionNumber!
    expect((await mockAuth.signIn(adm, DEMO_PASSWORD)).uid).toBe('u_student')
  })
  it('rejects wrong passwords and deactivated users', async () => {
    await expect(mockAuth.signIn('student@demo.kisiiuniversity.ac.ke', 'nope')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    store.update('users', 'u_student', { isActive: false })
    await expect(mockAuth.signIn('student@demo.kisiiuniversity.ac.ke', DEMO_PASSWORD)).rejects.toMatchObject({ code: 'auth/user-disabled' })
  })
})
