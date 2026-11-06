import { applyRead } from '@/core/delivery/state'
import { can } from '@/core/permissions'
import { profileInput } from '@/core/schemas'
import { academicCalendar } from '@/data/generate'
import { INSTITUTION_ID } from '@/core/permissions'
import { env } from '@/lib/env'
import type { CollectionName, Delivery, Notification } from '@/types'
import {
  FunctionsError,
  type AuditService,
  type DeliveryService,
  type DemoControls,
  type DeviceService,
  type DirectoryService,
  type NotificationService,
  type SettingsService,
  type SmsService,
  type Unsubscribe,
} from '../types'
import { mockFunctions } from './functions'
import { fakeDelayMs, delay, getSessionUid, newId, principalOf, requireAuth } from './session'
import { store } from './store'
import { isKeepDataEnabled, resetDemoData, setKeepData } from './sync'
import { workerState } from './server'

/**
 * Client-side reads/writes of the mock backend. Each method enforces what `firestore.rules`
 * will enforce (own documents only, sender-only timelines, admin-only logs…).
 */

/** onSnapshot-like live query: first result after a fake network delay, then on every relevant change. */
function live<T>(cols: CollectionName[], compute: () => T, cb: (v: T) => void, paused?: () => boolean): Unsubscribe {
  let active = true
  const emit = () => {
    if (active && !paused?.()) cb(compute())
  }
  const t = setTimeout(emit, fakeDelayMs())
  const off = store.subscribe((changes, origin) => {
    if (origin === 'reset' || changes.some((c) => cols.includes(c.col))) emit()
  })
  return () => {
    active = false
    clearTimeout(t)
    off()
  }
}

const byNewest = <T extends { createdAt: Date }>(a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime()
const deny = (msg = "You don't have permission for this.") => new FunctionsError('permission-denied', msg)
const isAdmin = () => {
  const uid = getSessionUid()
  const u = uid ? store.get('users', uid) : undefined
  return !!u && can(principalOf(u), 'audit.view')
}

// ───────── Demo controls (simulate offline etc.) ─────────

const OFFLINE_KEY = 'comrade.simulateOffline'
let simulateOffline = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(OFFLINE_KEY) === '1'
const offlineListeners = new Set<(on: boolean) => void>()

export const mockDemo: DemoControls = {
  isSimulatingOffline: () => simulateOffline,
  setSimulateOffline(on) {
    simulateOffline = on
    sessionStorage.setItem(OFFLINE_KEY, on ? '1' : '0')
    for (const l of offlineListeners) l(on)
  },
  onSimulateOfflineChange(cb) {
    offlineListeners.add(cb)
    return () => offlineListeners.delete(cb)
  },
  resetData: resetDemoData,
  isKeepData: isKeepDataEnabled,
  setKeepData,
  async setAckTimeout(seconds) {
    store.update('settings', 'app', { ackTimeoutSeconds: Math.max(5, Math.round(seconds)), updatedAt: new Date() })
  },
  isWorkerTab: workerState.get,
  onWorkerChange: workerState.on,
}

// ───────── Directory ─────────

export const mockDirectory: DirectoryService = {
  async getHierarchy() {
    await delay()
    return {
      institution: store.get('institutions', INSTITUTION_ID)!,
      schools: store.list('schools'),
      faculties: store.list('faculties'),
      courses: store.list('courses'),
      units: store.list('units'),
      courseUnits: store.list('courseUnits'),
    }
  },

  subscribeToProfile(uid, cb) {
    return live(['users'], () => (getSessionUid() === uid ? (store.get('users', uid) ?? null) : null), cb)
  },

  async updateProfile(input) {
    await delay()
    const { user } = requireAuth()
    const parsed = profileInput.safeParse(input)
    if (!parsed.success) throw new FunctionsError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid input')
    store.update('users', user.uid, parsed.data)
  },

  async completeOnboarding() {
    const { user } = requireAuth()
    store.update('users', user.uid, { onboardedAt: new Date() })
  },

  async getMyUnits() {
    await delay()
    const { user } = requireAuth()
    const course = user.courseId ? (store.get('courses', user.courseId) ?? null) : null
    const lecturersOf = (unitId: string) =>
      store
        .list('unitAssignments', (a) => a.unitId === unitId)
        .map((a) => store.get('users', a.userId))
        .filter((x) => !!x)
        .map((x) => x!.name)
    return {
      course,
      yearOfStudy: user.yearOfStudy,
      semester: user.semester ?? academicCalendar(new Date()).semester,
      units: user.unitIds
        .map((id) => store.get('units', id))
        .filter((u) => !!u)
        .map((u) => ({ ...u!, lecturers: lecturersOf(u!.id) })),
    }
  },

  async listMyPositions() {
    await delay()
    const { user } = requireAuth()
    return store.list('leadershipPositions', (p) => p.userId === user.uid).sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  },
}

// ───────── Notifications ─────────

export const mockNotifications: NotificationService = {
  subscribeToInbox(uid, cb) {
    const compute = () => (getSessionUid() === uid ? store.list('deliveries', (d) => d.userId === uid).sort(byNewest) : [])
    // While "simulating offline" this device receives nothing; it catches up when back online.
    const off = live(['deliveries'], compute, cb, () => simulateOffline)
    const offToggle = mockDemo.onSimulateOfflineChange((on) => {
      if (!on) cb(compute())
    })
    return () => {
      off()
      offToggle()
    }
  },

  async getNotice(notificationId) {
    await delay()
    const { user, principal } = requireAuth()
    const n = store.get('notifications', notificationId)
    const delivery = store.list('deliveries', (d) => d.notificationId === notificationId && d.userId === user.uid)[0] ?? null
    if (!n || (n.status === 'DRAFT' && n.senderId !== user.uid)) throw new FunctionsError('not-found', 'Notice not found.')
    if (!delivery && n.senderId !== user.uid && !can(principal, 'audit.view')) throw deny('This notice was not sent to you.')
    return { notification: n, delivery }
  },

  async findByShortCode(code) {
    await delay()
    const { user } = requireAuth()
    const n = store.list('notifications', (x) => x.shortCode === code.trim().toUpperCase())[0]
    if (!n) return null
    const mine = n.senderId === user.uid || store.list('deliveries', (d) => d.notificationId === n.id && d.userId === user.uid).length > 0
    return mine ? n.id : null
  },

  subscribeToSent(uid, cb) {
    return live(
      ['notifications'],
      () => (getSessionUid() === uid ? store.list('notifications', (n) => n.senderId === uid && n.status !== 'DRAFT').sort(byNewest) : []),
      cb,
    )
  },

  subscribeToNotification(id, cb) {
    return live(
      ['notifications'],
      () => {
        const n = store.get('notifications', id)
        return n && (n.senderId === getSessionUid() || isAdmin()) ? n : null
      },
      cb,
    )
  },

  async listDrafts() {
    await delay()
    const { user } = requireAuth()
    return store.list('notifications', (n) => n.senderId === user.uid && n.status === 'DRAFT').sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  },

  async saveDraft(input) {
    await delay()
    const { user, now } = requireAuth()
    const existing = input.id ? store.get('notifications', input.id) : undefined
    if (existing && (existing.senderId !== user.uid || existing.status !== 'DRAFT')) throw deny()
    const id = existing?.id ?? newId('ntf')
    const base: Notification = existing ?? {
      id,
      shortCode: '',
      title: '',
      body: '',
      category: 'GENERAL',
      priority: 'NORMAL',
      senderId: user.uid,
      senderName: user.name,
      senderRole: user.role,
      senderPosition: null,
      senderLabel: '',
      audience: { targetType: 'INSTITUTION', targetId: '' },
      audienceLabel: '',
      attachment: null,
      allowSmsFallback: true,
      status: 'DRAFT',
      scheduledFor: null,
      ackTimeoutSeconds: 0,
      counts: { total: 0, pending: 0, delivered: 0, read: 0, sms: 0, failed: 0, skipped: 0 },
      createdAt: now,
      updatedAt: now,
      sentAt: null,
    }
    store.set('notifications', {
      ...base,
      title: input.title ?? base.title,
      body: input.body ?? base.body,
      category: input.category ?? base.category,
      priority: input.priority ?? base.priority,
      audience: input.audience ?? base.audience,
      allowSmsFallback: input.allowSmsFallback ?? base.allowSmsFallback,
      attachment: input.attachment ?? base.attachment,
      scheduledFor: input.scheduledFor ?? base.scheduledFor,
      updatedAt: now,
    })
    return id
  },

  async deleteDraft(id) {
    await delay()
    const { user } = requireAuth()
    const n = store.get('notifications', id)
    if (!n || n.senderId !== user.uid || n.status !== 'DRAFT') throw deny()
    store.delete('notifications', id)
  },

  async listSavedGroups() {
    await delay()
    const { user } = requireAuth()
    return store.list('savedGroups', (g) => g.ownerId === user.uid)
  },

  async saveGroup(name, memberIds) {
    await delay()
    const { user, now } = requireAuth()
    const id = newId('grp')
    store.set('savedGroups', { id, ownerId: user.uid, name, memberIds: [...new Set(memberIds)], createdAt: now })
    return id
  },

  async deleteGroup(id) {
    await delay()
    const { user } = requireAuth()
    const g = store.get('savedGroups', id)
    if (!g || g.ownerId !== user.uid) throw deny()
    store.delete('savedGroups', id)
  },

  async uploadAttachment(file) {
    requireAuth()
    if (file.size > 2 * 1024 * 1024) throw new FunctionsError('invalid-argument', 'Demo uploads are limited to 2 MB.')
    // Data URL so the attachment works in every tab (Firebase Storage URL in Phase 9)
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(file)
    })
    await delay(400)
    return { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream', url }
  },
}

// ───────── Deliveries ─────────

export const mockDeliveries: DeliveryService = {
  async ack(deliveryId, deviceId, channel) {
    return (await mockFunctions.ackDelivery({ deliveryId, deviceId, channel })).result
  },

  async markRead(deliveryId) {
    const { user } = requireAuth()
    const d = store.get('deliveries', deliveryId)
    if (!d || d.userId !== user.uid) throw deny()
    const next = applyRead(d, user.uid, mockDevices.getDeviceId(), new Date())
    if (next && next !== d) store.set('deliveries', next)
  },

  async archive(deliveryId, archived) {
    const { user } = requireAuth()
    const d = store.get('deliveries', deliveryId)
    if (!d || d.userId !== user.uid) throw deny()
    store.update('deliveries', deliveryId, { archivedAt: archived ? new Date() : null })
  },

  subscribeToNotificationDeliveries(notificationId, cb) {
    return live(
      ['deliveries'],
      (): Delivery[] => {
        const n = store.get('notifications', notificationId)
        if (!n || (n.senderId !== getSessionUid() && !isAdmin())) return []
        return store.list('deliveries', (d) => d.notificationId === notificationId).sort((a, b) => a.recipientName.localeCompare(b.recipientName))
      },
      cb,
    )
  },
}

// ───────── SMS, audit, settings ─────────

export const mockSms: SmsService = {
  subscribeToSmsInbox(cb) {
    return live(['smsMessages'], () => (env.demoMode ? store.list('smsMessages').sort(byNewest) : []), cb)
  },
  subscribeToSmsLogs(cb) {
    return live(
      ['smsMessages'],
      () => {
        const uid = getSessionUid()
        const u = uid ? store.get('users', uid) : undefined
        return u && can(principalOf(u), 'sms_logs.view') ? store.list('smsMessages').sort(byNewest) : []
      },
      cb,
    )
  },
}

export const mockAudit: AuditService = {
  subscribeToAuditLogs(cb) {
    return live(['auditLogs'], () => (isAdmin() ? store.list('auditLogs').sort(byNewest) : []), cb)
  },
}

export const mockSettings: SettingsService = {
  subscribeToSettings(cb) {
    return live(['settings'], () => store.get('settings', 'app')!, cb)
  },
}

// ───────── Devices ─────────

const DEVICE_KEY = 'comrade.deviceId'
function browserName() {
  if (typeof navigator === 'undefined') return 'Browser'
  const ua = navigator.userAgent
  const name = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${name} on ${os}` : name
}

export const mockDevices: DeviceService = {
  getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = newId('web')
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  },
  async registerDevice(uid, opts) {
    const deviceId = mockDevices.getDeviceId()
    const id = `${uid}_${deviceId}`
    const now = new Date()
    const existing = store.get('devices', id)
    store.set('devices', {
      id,
      userId: uid,
      kind: 'WEB',
      browser: browserName(),
      label: browserName(),
      pushToken: opts.pushToken ?? existing?.pushToken ?? null,
      notificationsEnabled: opts.notificationsEnabled,
      lastSeenAt: now,
      createdAt: existing?.createdAt ?? now,
    })
  },
  subscribeToDevices(uid, cb) {
    return live(['devices'], () => (getSessionUid() === uid ? store.list('devices', (d) => d.userId === uid) : []), cb)
  },
  async removeDevice(id) {
    const { user } = requireAuth()
    const d = store.get('devices', id)
    if (!d || d.userId !== user.uid) throw deny()
    store.delete('devices', id)
  },
}
