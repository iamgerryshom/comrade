import type { z } from 'zod'
import { ruleToScopes, resolveAudience } from '@/core/audience'
import { applyAck } from '@/core/delivery/state'
import { scopeContains } from '@/core/hierarchy'
import { POSITION_LABEL } from '@/core/labels'
import { computeSenderLabel } from '@/core/senderLabel'
import { maskPhone } from '@/core/phone'
import { can, canSendAtAll, dailySendLimit, INSTITUTION_ID, phoneVisibility, type Principal } from '@/core/permissions'
import {
  ackInput,
  lookupStudentInput,
  positionInput,
  sendNotificationInput,
  settingsInput,
  userInput,
  audienceSchema,
} from '@/core/schemas'
import type { AudienceRule, Notification, PersonSummary, Scope, User } from '@/types'
import { FunctionsError, type AnalyticsData, type Functions, type LookupResult, type NodeDetails } from '../types'
import { academicCalendar } from '@/data/generate'
import { delay, lookup, newId, principalOf, requireAuth, shortCode, type CallContext } from './session'
import { fanOut, settings, writeAudit } from './server'
import { store } from './store'

/**
 * Mock "Callable Cloud Functions". Each one follows the exact pipeline the real functions will:
 *   check auth → validate with Zod → check permissions → do the work → audit log → typed result.
 */

function callable<S extends z.ZodType, O>(
  schema: S,
  handler: (input: z.infer<S>, ctx: CallContext) => O | Promise<O>,
): (raw: z.input<S>) => Promise<O> {
  return async (raw) => {
    await delay()
    const ctx = requireAuth()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) throw new FunctionsError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid input', parsed.error.issues)
    return handler(parsed.data, ctx)
  }
}

/** Callable without a Zod schema (input is trivial or already typed). */
function call<I, O>(handler: (input: I, ctx: CallContext) => O | Promise<O>): (raw: I) => Promise<O> {
  return async (raw) => {
    await delay()
    return handler(raw, requireAuth())
  }
}

function deny(message = "You don't have permission for this."): never {
  throw new FunctionsError('permission-denied', message)
}

// ───────── Helpers ─────────

export function toSummary(viewer: Principal, u: User): PersonSummary {
  const vis = phoneVisibility(viewer, u.uid, lookup)
  const positions = store
    .list('leadershipPositions', (p) => p.userId === u.uid && p.isActive && p.endDate.getTime() >= Date.now())
    .map((p) => p.position)
  return {
    uid: u.uid,
    name: u.name,
    userType: u.userType,
    role: u.role,
    positions,
    photoURL: u.photoURL,
    admissionNumber: u.admissionNumber,
    staffNumber: u.staffNumber,
    title: u.title,
    courseId: u.courseId,
    facultyId: u.facultyId,
    schoolId: u.schoolId,
    yearOfStudy: u.yearOfStudy,
    phone: !u.phone || vis === 'HIDDEN' ? null : vis === 'FULL' ? u.phone : maskPhone(u.phone),
    phoneVisibility: vis,
    email: vis === 'FULL' || viewer.claims.userType === 'STAFF' ? u.email : null,
    isActive: u.isActive,
  }
}

export function audienceLabel(rule: AudienceRule): string {
  switch (rule.targetType) {
    case 'INSTITUTION':
      return rule.includeStaff ? 'Whole university (students & staff)' : 'Whole university'
    case 'SCHOOL':
      return store.get('schools', rule.targetId)?.name ?? 'School'
    case 'FACULTY':
      return store.get('faculties', rule.targetId)?.name ?? 'Department'
    case 'COURSE':
      return store.get('courses', rule.targetId)?.name ?? 'Course'
    case 'COURSE_YEAR':
      return `${store.get('courses', rule.targetId)?.name ?? 'Course'} · Year ${rule.yearOfStudy}`
    case 'UNIT': {
      const u = store.get('units', rule.targetId)
      return u ? `${u.code} – ${u.name}` : 'Unit'
    }
    case 'USER': {
      const u = store.get('users', rule.targetId)
      return u ? `${u.name}${u.admissionNumber ? ` (${u.admissionNumber})` : ''}` : 'One person'
    }
    case 'GROUP':
      return store.get('savedGroups', rule.targetId)?.name ?? 'Saved group'
  }
}

export function senderLabel(user: User, p: Principal, rule: AudienceRule): string {
  const now = Date.now()
  const active = store.list(
    'leadershipPositions',
    (x) => x.userId === user.uid && x.isActive && p.claims.positions.includes(x.position) && x.startDate.getTime() <= now && x.endDate.getTime() >= now,
  )
  return computeSenderLabel(user, active, rule, {
    unitCode: (id) => store.get('units', id)?.code,
    facultyName: (id) => store.get('faculties', id)?.name,
    schoolCode: (id) => store.get('schools', id)?.code,
    courseCode: (id) => store.get('courses', id)?.code,
  })
}

function checkAudience(ctx: CallContext, rule: AudienceRule, urgent: boolean) {
  if (!canSendAtAll(ctx.principal.claims)) deny('Only staff and student leaders can send notifications.')
  if (rule.targetType === 'GROUP') {
    const g = store.get('savedGroups', rule.targetId)
    if (!g || g.ownerId !== ctx.user.uid) throw new FunctionsError('not-found', 'Saved group not found.')
  }
  if (rule.targetType === 'USER' && !store.get('users', rule.targetId)) throw new FunctionsError('not-found', 'Recipient not found.')
  const scopes = ruleToScopes(rule, { users: [], groups: store.list('savedGroups') })
  for (const s of scopes) {
    if (!can(ctx.principal, 'notification.send', s, lookup)) deny('That audience is outside your scope.')
    if (urgent && !can(ctx.principal, 'notification.send_urgent', s, lookup))
      deny('Only staff and the Student President can send URGENT notices.')
  }
}

function sentToday(uid: string, now: Date) {
  const since = now.getTime() - 86_400_000
  return store.list('notifications', (n) => n.senderId === uid && n.status !== 'DRAFT' && n.createdAt.getTime() >= since).length
}

function inScopeForAnalytics(p: Principal, u: User | undefined) {
  if (!u) return false
  return p.claims.scopes.some((s) => scopeContains(s, { type: 'USER', id: u.uid }, lookup))
}

function nodeTitle(scope: Scope): { title: string; subtitle: string } {
  switch (scope.type) {
    case 'INSTITUTION':
      return { title: store.get('institutions', INSTITUTION_ID)?.name ?? 'Kisii University', subtitle: 'Institution' }
    case 'SCHOOL':
      return { title: store.get('schools', scope.id)?.name ?? '', subtitle: 'School' }
    case 'FACULTY':
      return { title: store.get('faculties', scope.id)?.name ?? '', subtitle: 'Faculty / Department' }
    case 'COURSE':
    case 'COURSE_YEAR': {
      const c = store.get('courses', scope.id)
      return { title: `${c?.name ?? ''}${scope.type === 'COURSE_YEAR' ? ` · Year ${scope.yearOfStudy}` : ''}`, subtitle: `Course · ${c?.code ?? ''}` }
    }
    case 'UNIT': {
      const u = store.get('units', scope.id)
      return { title: u ? `${u.code} – ${u.name}` : '', subtitle: 'Unit' }
    }
    case 'USER':
      return { title: store.get('users', scope.id)?.name ?? '', subtitle: 'Person' }
  }
}

// ───────── Callable functions ─────────

export const mockFunctions: Functions = {
  sendNotification: callable(sendNotificationInput, (input, ctx) => {
    const urgent = input.priority === 'URGENT'
    checkAudience(ctx, input.audience, urgent)

    const limit = dailySendLimit(ctx.principal.claims, settings())
    if (limit !== null && sentToday(ctx.user.uid, ctx.now) >= limit)
      throw new FunctionsError('resource-exhausted', `Daily limit reached (${limit} notifications per day). Try again tomorrow.`)

    const recipients = resolveAudience(input.audience, { users: store.list('users'), groups: store.list('savedGroups') }, { excludeUid: ctx.user.uid })
    if (recipients.length === 0) throw new FunctionsError('failed-precondition', 'This audience has no active recipients.')

    const scheduled = !!input.scheduledFor && input.scheduledFor.getTime() > ctx.now.getTime() + 5000
    const id = input.draftId && store.get('notifications', input.draftId)?.senderId === ctx.user.uid ? input.draftId : newId('ntf')
    const n: Notification = {
      id,
      shortCode: shortCode(),
      title: input.title,
      body: input.body,
      category: input.category,
      priority: input.priority,
      senderId: ctx.user.uid,
      senderName: ctx.user.name,
      senderRole: ctx.user.role,
      senderPosition: ctx.principal.claims.positions[0] ?? null,
      senderLabel: senderLabel(ctx.user, ctx.principal, input.audience),
      audience: input.audience,
      audienceLabel: audienceLabel(input.audience),
      attachment: input.attachment ?? null,
      allowSmsFallback: urgent ? true : input.allowSmsFallback,
      status: scheduled ? 'SCHEDULED' : 'SENT',
      scheduledFor: scheduled ? input.scheduledFor! : null,
      ackTimeoutSeconds: settings().ackTimeoutSeconds,
      counts: { total: recipients.length, pending: recipients.length, delivered: 0, read: 0, sms: 0, failed: 0, skipped: 0 },
      createdAt: ctx.now,
      updatedAt: ctx.now,
      sentAt: scheduled ? null : ctx.now,
    }
    store.set('notifications', n)
    if (!scheduled) fanOut(n, ctx.now)
    writeAudit(ctx, {
      action: scheduled ? 'notification.schedule' : 'notification.send',
      targetType: input.audience.targetType,
      targetId: input.audience.targetId,
      targetLabel: n.audienceLabel,
      scope: ruleToScopes(input.audience, { users: [], groups: [] })[0] ?? null,
      metadata: { notificationId: id, title: n.title, priority: n.priority, recipients: recipients.length },
    })
    return { notificationId: id, recipientCount: recipients.length, scheduled }
  }),

  previewAudience: callable(audienceSchema, (rule, ctx) => {
    checkAudience(ctx, rule, false)
    const count = resolveAudience(rule, { users: store.list('users'), groups: store.list('savedGroups') }, { excludeUid: ctx.user.uid }).length
    return { count, label: audienceLabel(rule) }
  }),

  lookupStudent: callable(lookupStudentInput, (input, ctx): LookupResult => {
    if (!can(ctx.principal, 'student.search_by_admission')) deny('Only staff and student leaders can look up students.')
    const q = input.admissionNumber.trim().toUpperCase()
    const u = store.list('users', (x) => x.userType === 'STUDENT' && x.admissionNumber?.toUpperCase() === q)[0]
    const inScope = !!u && can(ctx.principal, 'student.search_by_admission', { type: 'USER', id: u.uid }, lookup)
    writeAudit(ctx, {
      action: 'student.search_by_admission',
      targetType: 'USER',
      targetId: u?.uid ?? '',
      targetLabel: q,
      scope: null,
      metadata: { found: inScope, byStudent: ctx.user.userType === 'STUDENT' },
    })
    // Same error whether the student doesn't exist or is out of scope: don't leak existence
    if (!u || !inScope) throw new FunctionsError('not-found', 'No student with that admission number in your scope.')
    const course = u.courseId ? store.get('courses', u.courseId) : undefined
    return {
      ...toSummary(ctx.principal, u),
      courseName: course?.name ?? null,
      facultyName: u.facultyId ? (store.get('faculties', u.facultyId)?.name ?? null) : null,
      schoolName: u.schoolId ? (store.get('schools', u.schoolId)?.name ?? null) : null,
      units: u.unitIds.map((id) => store.get('units', id)).filter((x) => !!x).map((x) => ({ code: x!.code, name: x!.name })),
    }
  }),

  searchRecipients: call((input: { query: string }, ctx) => {
    if (!canSendAtAll(ctx.principal.claims)) deny()
    const q = input.query.trim().toLowerCase()
    if (q.length < 2) return []
    const out = store
      .list('users', (u) => u.isActive && u.uid !== ctx.user.uid && (u.name.toLowerCase().includes(q) || (u.admissionNumber ?? '').toLowerCase().includes(q) || (u.staffNumber ?? '').toLowerCase().includes(q)))
      .filter((u) => can(ctx.principal, 'notification.send', { type: 'USER', id: u.uid }, lookup))
      .slice(0, 10)
    if (ctx.user.userType === 'STUDENT')
      writeAudit(ctx, { action: 'student.search', targetType: 'QUERY', targetId: '', targetLabel: input.query, scope: null, metadata: { results: out.length } })
    return out.map((u) => ({ ...toSummary(ctx.principal, u), phone: null, phoneVisibility: 'HIDDEN' as const }))
  }),

  ackDelivery: callable(ackInput, (input, ctx) => {
    const d = store.get('deliveries', input.deliveryId)
    if (!d) throw new FunctionsError('not-found', 'Delivery not found.')
    if (d.userId !== ctx.user.uid) deny('Only the recipient can acknowledge a notice.')
    const { result, delivery } = applyAck(d, { userId: ctx.user.uid, deviceId: input.deviceId, channel: input.channel }, new Date())
    if (delivery !== d) store.set('deliveries', delivery)
    const devId = `${ctx.user.uid}_${input.deviceId}`
    if (store.get('devices', devId)) store.update('devices', devId, { lastSeenAt: new Date() })
    return { result }
  }),

  getNodeDetails: call((input: { scope: Scope }, ctx): NodeDetails => {
    const scope = input.scope
    if (!can(ctx.principal, 'directory.view', scope, lookup)) deny('This part of the university is outside your scope.')
    const users = store.list('users', (u) => u.isActive)
    let members: User[]
    let unitCount = 0
    let courseCount = 0
    switch (scope.type) {
      case 'INSTITUTION':
        members = users
        unitCount = store.list('units').length
        courseCount = store.list('courses').length
        break
      case 'SCHOOL':
        members = users.filter((u) => u.schoolId === scope.id)
        unitCount = store.list('units', (u) => u.schoolId === scope.id).length
        courseCount = store.list('courses', (c) => c.schoolId === scope.id).length
        break
      case 'FACULTY':
        members = users.filter((u) => u.facultyId === scope.id)
        unitCount = store.list('units', (u) => u.facultyId === scope.id).length
        courseCount = store.list('courses', (c) => c.facultyId === scope.id).length
        break
      case 'COURSE':
      case 'COURSE_YEAR': {
        members = users.filter((u) => u.courseId === scope.id && (scope.type === 'COURSE' || u.yearOfStudy === scope.yearOfStudy))
        const cus = store.list('courseUnits', (cu) => cu.courseId === scope.id && (scope.type === 'COURSE' || cu.yearOfStudy === scope.yearOfStudy))
        unitCount = new Set(cus.map((c) => c.unitId)).size
        courseCount = 1
        break
      }
      case 'UNIT':
        members = users.filter((u) => u.unitIds.includes(scope.id))
        unitCount = 1
        courseCount = new Set(store.list('courseUnits', (cu) => cu.unitId === scope.id).map((c) => c.courseId)).size
        break
      default:
        members = users.filter((u) => u.uid === scope.id)
    }
    const students = members.filter((m) => m.userType === 'STUDENT')
    const staff = members.filter((m) => m.userType === 'STAFF')
    const LIMIT = 150
    const sorted = [...staff, ...students.sort((a, b) => (a.yearOfStudy ?? 0) - (b.yearOfStudy ?? 0) || a.name.localeCompare(b.name))]
    return {
      scope,
      ...nodeTitle(scope),
      stats: { students: students.length, staff: staff.length, units: unitCount, courses: courseCount },
      members: sorted.slice(0, LIMIT).map((u) => toSummary(ctx.principal, u)),
      membersTruncated: sorted.length > LIMIT,
    }
  }),

  getAnalytics: call((_: void, ctx): AnalyticsData => {
    if (!can(ctx.principal, 'analytics.view')) deny()
    const users = new Map(store.list('users').map((u) => [u.uid, u]))
    const ds = store.list('deliveries', (d) => inScopeForAnalytics(ctx.principal, users.get(d.userId)))
    const smsById = new Map(store.list('smsMessages').map((s) => [s.id, s]))
    const t = { notifications: 0, deliveries: ds.length, inApp: 0, sms: 0, failed: 0, skipped: 0, pending: 0, avgAckSeconds: null as number | null, smsCostKes: 0 }
    const days = new Map<string, { date: string; inApp: number; sms: number; failed: number }>()
    const bySchool = new Map<string, { name: string; code: string; total: number; inApp: number; sms: number; failed: number }>()
    const byCourse = new Map<string, { name: string; code: string; total: number; inApp: number; sms: number }>()
    const nIds = new Set<string>()
    let ackSum = 0
    let ackN = 0
    for (const d of ds) {
      nIds.add(d.notificationId)
      const kind = ['DELIVERED', 'READ'].includes(d.status) ? 'inApp' : ['SMS_SENT', 'SMS_DELIVERED', 'DELIVERED_AFTER_SMS'].includes(d.status) ? 'sms' : d.status === 'SMS_FAILED' ? 'failed' : d.status === 'SMS_SKIPPED' ? 'skipped' : 'pending'
      t[kind]++
      if (d.ackedAt && kind === 'inApp') {
        ackSum += (d.ackedAt.getTime() - d.createdAt.getTime()) / 1000
        ackN++
      }
      if (d.smsId) t.smsCostKes += smsById.get(d.smsId)?.costKes ?? 0
      const day = d.createdAt.toISOString().slice(0, 10)
      const row = days.get(day) ?? { date: day, inApp: 0, sms: 0, failed: 0 }
      if (kind === 'inApp' || kind === 'sms' || kind === 'failed') row[kind]++
      days.set(day, row)
      const u = users.get(d.userId)
      if (u?.schoolId) {
        const s = store.get('schools', u.schoolId)!
        const r = bySchool.get(s.id) ?? { name: s.name, code: s.code, total: 0, inApp: 0, sms: 0, failed: 0 }
        r.total++
        if (kind === 'inApp' || kind === 'sms' || kind === 'failed') r[kind]++
        bySchool.set(s.id, r)
      }
      if (u?.courseId) {
        const c = store.get('courses', u.courseId)!
        const r = byCourse.get(c.id) ?? { name: c.name, code: c.code, total: 0, inApp: 0, sms: 0 }
        r.total++
        if (kind === 'inApp' || kind === 'sms') r[kind]++
        byCourse.set(c.id, r)
      }
    }
    t.notifications = nIds.size
    t.avgAckSeconds = ackN ? Math.round((ackSum / ackN) * 10) / 10 : null
    t.smsCostKes = Math.round(t.smsCostKes * 100) / 100
    const notifs = [...nIds].map((id) => store.get('notifications', id)!).filter(Boolean)
    const byCat = new Map<string, number>()
    for (const n of notifs) byCat.set(n.category, (byCat.get(n.category) ?? 0) + 1)
    return {
      totals: t,
      overTime: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      bySchool: [...bySchool.values()].sort((a, b) => b.total - a.total),
      byCourse: [...byCourse.values()].sort((a, b) => b.total - a.total).slice(0, 10),
      byCategory: [...byCat.entries()].map(([category, total]) => ({ category: category as Notification['category'], total })),
      recent: notifs.sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0)).slice(0, 8),
    }
  }),

  // Public (no auth): Firebase Auth needs an email, so admission/staff numbers are resolved first.
  resolveLoginIdentifier: async ({ identifier }) => {
    await delay()
    const id = identifier.trim()
    if (id.includes('@')) return { email: id.toLowerCase() }
    const up = id.toUpperCase()
    const u = store.list('users', (x) => x.admissionNumber?.toUpperCase() === up || x.staffNumber?.toUpperCase() === up)[0]
    if (!u) throw new FunctionsError('not-found', 'No account with that admission or staff number.')
    return { email: u.email }
  },

  getSendQuota: call((_: void, ctx) => ({
    limit: dailySendLimit(ctx.principal.claims, settings()),
    used: sentToday(ctx.user.uid, ctx.now),
  })),

  updateSettings: callable(settingsInput, (input, ctx) => {
    if (!can(ctx.principal, 'settings.manage')) deny()
    store.update('settings', 'app', { ...input, updatedAt: ctx.now })
    writeAudit(ctx, { action: 'settings.update', targetType: 'settings', targetId: 'app', targetLabel: 'App settings', scope: null, metadata: { ...input } })
  }),

  adminListUsers: call((_: void, ctx) => {
    if (!can(ctx.principal, 'user.manage')) deny()
    return store.list('users').sort((a, b) => a.name.localeCompare(b.name))
  }),

  adminSaveUser: callable(userInput, (input, ctx) => {
    if (!can(ctx.principal, 'user.manage')) deny()
    if (input.role === 'SUPER_ADMIN' && ctx.user.role !== 'SUPER_ADMIN') deny('Only a Super Admin can create Super Admins.')
    if ((input.userType === 'STUDENT') !== (input.role === 'STUDENT')) throw new FunctionsError('invalid-argument', 'Students must have the STUDENT role; staff need a staff role.')
    const email = input.email.toLowerCase()
    const dup = store.list('users', (u) => u.uid !== input.uid && (u.email.toLowerCase() === email || (!!input.admissionNumber && u.admissionNumber === input.admissionNumber)))[0]
    if (dup) throw new FunctionsError('failed-precondition', 'Another user already has that email or admission number.')
    const course = input.courseId ? store.get('courses', input.courseId) : undefined
    const cal = academicCalendar(ctx.now)
    const unitIds =
      input.userType === 'STUDENT' && course && input.yearOfStudy
        ? store.list('courseUnits', (cu) => cu.courseId === course.id && cu.yearOfStudy === input.yearOfStudy && cu.semester === cal.semester).map((cu) => cu.unitId)
        : undefined
    const existing = input.uid ? store.get('users', input.uid) : undefined
    const uid = existing?.uid ?? newId('u')
    const base: User = existing ?? {
      uid,
      name: input.name,
      email,
      phone: null,
      userType: input.userType,
      role: input.role,
      photoURL: null,
      isActive: true,
      smsOptOut: false,
      schoolId: null,
      facultyId: null,
      courseId: null,
      yearOfStudy: null,
      unitIds: [],
      createdAt: ctx.now,
      onboardedAt: null,
    }
    const next: User = {
      ...base,
      name: input.name,
      email,
      phone: input.phone,
      userType: input.userType,
      role: input.role,
      schoolId: course?.schoolId ?? input.schoolId,
      facultyId: course?.facultyId ?? input.facultyId,
      courseId: input.userType === 'STUDENT' ? input.courseId : null,
      yearOfStudy: input.userType === 'STUDENT' ? input.yearOfStudy : null,
      unitIds: unitIds ?? (input.userType === 'STAFF' ? base.unitIds : []),
      admissionNumber: input.userType === 'STUDENT' ? input.admissionNumber : undefined,
      staffNumber: input.userType === 'STAFF' ? input.staffNumber : undefined,
      title: input.title,
      semester: input.userType === 'STUDENT' ? cal.semester : undefined,
      status: input.userType === 'STUDENT' ? (base.status ?? 'ACTIVE') : undefined,
      intakeYear: base.intakeYear ?? (input.userType === 'STUDENT' && input.yearOfStudy ? cal.startYear - input.yearOfStudy + 1 : undefined),
    }
    store.set('users', next)
    writeAudit(ctx, { action: existing ? 'user.update' : 'user.create', targetType: 'USER', targetId: uid, targetLabel: next.name, scope: null, metadata: { role: next.role } })
    return { uid }
  }),

  adminSetUserActive: call((input: { uid: string; isActive: boolean }, ctx) => {
    if (!can(ctx.principal, 'user.manage')) deny()
    if (input.uid === ctx.user.uid) throw new FunctionsError('failed-precondition', "You can't deactivate yourself.")
    const u = store.update('users', input.uid, { isActive: input.isActive })
    if (!u) throw new FunctionsError('not-found', 'User not found.')
    writeAudit(ctx, { action: input.isActive ? 'user.activate' : 'user.deactivate', targetType: 'USER', targetId: u.uid, targetLabel: u.name, scope: null, metadata: {} })
  }),

  adminListPositions: call((_: void, ctx) => {
    if (!can(ctx.principal, 'role.assign')) deny()
    return store.list('leadershipPositions').sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
  }),

  adminAssignPosition: callable(positionInput, (input, ctx) => {
    if (!can(ctx.principal, 'role.assign')) deny()
    const u = store.get('users', input.userId)
    if (!u || u.userType !== 'STUDENT') throw new FunctionsError('failed-precondition', 'Leadership positions are for students only.')
    if (input.endDate <= input.startDate) throw new FunctionsError('invalid-argument', 'End date must be after start date.')
    const exists =
      input.scopeType === 'INSTITUTION' ? input.scopeId === INSTITUTION_ID
      : input.scopeType === 'SCHOOL' ? !!store.get('schools', input.scopeId)
      : input.scopeType === 'FACULTY' ? !!store.get('faculties', input.scopeId)
      : !!store.get('courses', input.scopeId) && !!input.yearOfStudy
    if (!exists) throw new FunctionsError('invalid-argument', 'Choose a valid scope for this position.')
    const id = newId('pos')
    store.set('leadershipPositions', { id, ...input, isActive: true })
    writeAudit(ctx, { action: 'role.assign', targetType: 'USER', targetId: u.uid, targetLabel: u.name, scope: { type: input.scopeType, id: input.scopeId, yearOfStudy: input.yearOfStudy }, metadata: { position: POSITION_LABEL[input.position], title: input.title } })
    return { id }
  }),

  adminEndPosition: call((input: { positionId: string }, ctx) => {
    if (!can(ctx.principal, 'role.assign')) deny()
    const p = store.update('leadershipPositions', input.positionId, { isActive: false, endDate: ctx.now })
    if (!p) throw new FunctionsError('not-found', 'Position not found.')
    writeAudit(ctx, { action: 'role.revoke', targetType: 'USER', targetId: p.userId, targetLabel: store.get('users', p.userId)?.name ?? p.userId, scope: null, metadata: { position: p.title } })
  }),
}

export { principalOf }
