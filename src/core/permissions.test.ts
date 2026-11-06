import { describe, expect, it } from 'vitest'
import { can, computeClaims, dailySendLimit, INSTITUTION_SCOPE, phoneVisibility } from './permissions'
import { bscs, comp210, dataset, lookup, principal, user } from '@/test/fixtures'
import type { Scope } from '@/types'

const courseYear = (id: string, y: number): Scope => ({ type: 'COURSE_YEAR', id, yearOfStudy: y })
const otherCourse = dataset.courses.find((c) => c.code === 'BCOM')!
const studentIn = (courseId: string, year: number) =>
  dataset.users.find((u) => u.courseId === courseId && u.yearOfStudy === year && /^u_s\d/.test(u.uid))!

describe('ordinary student', () => {
  const p = principal('u_student')
  it('can view own feed and ack', () => {
    expect(can(p, 'notification.view_own')).toBe(true)
    expect(can(p, 'notification.ack')).toBe(true)
  })
  it('cannot search, send, explore or see analytics', () => {
    expect(can(p, 'student.search_by_admission')).toBe(false)
    expect(can(p, 'notification.send')).toBe(false)
    expect(can(p, 'notification.send', { type: 'USER', id: 'u_student2' }, lookup)).toBe(false)
    expect(can(p, 'directory.view')).toBe(false)
    expect(can(p, 'analytics.view')).toBe(false)
    expect(can(p, 'user.manage')).toBe(false)
  })
  it('sees no phone number of classmates', () => {
    expect(phoneVisibility(p, 'u_student2', lookup)).toBe('HIDDEN')
  })
})

describe('class rep (BSCS year 2)', () => {
  const p = principal('u_classrep')
  it('reaches their own course + year', () => {
    expect(can(p, 'notification.send', courseYear(bscs.id, 2), lookup)).toBe(true)
    expect(can(p, 'notification.send', { type: 'USER', id: 'u_student' }, lookup)).toBe(true)
    expect(can(p, 'student.search_by_admission', { type: 'USER', id: 'u_student' }, lookup)).toBe(true)
  })
  it('cannot reach another year, course, the faculty or the whole university', () => {
    expect(can(p, 'notification.send', courseYear(bscs.id, 3), lookup)).toBe(false)
    expect(can(p, 'notification.send', courseYear(otherCourse.id, 2), lookup)).toBe(false)
    expect(can(p, 'notification.send', { type: 'COURSE', id: bscs.id }, lookup)).toBe(false)
    expect(can(p, 'notification.send', { type: 'FACULTY', id: bscs.facultyId }, lookup)).toBe(false)
    expect(can(p, 'notification.send', INSTITUTION_SCOPE, lookup)).toBe(false)
    expect(can(p, 'notification.send', { type: 'USER', id: studentIn(bscs.id, 3).uid }, lookup)).toBe(false)
  })
  it('cannot send URGENT and sees masked phones', () => {
    expect(can(p, 'notification.send_urgent', courseYear(bscs.id, 2), lookup)).toBe(false)
    expect(phoneVisibility(p, 'u_student', lookup)).toBe('MASKED')
  })
  it('is rate limited', () => {
    expect(dailySendLimit(p.claims, dataset.settings[0])).toBe(10)
  })
})

describe('lecturer', () => {
  const p = principal('u_lecturer')
  it('can message the units they teach and their students', () => {
    expect(can(p, 'notification.send', { type: 'UNIT', id: comp210.id }, lookup)).toBe(true)
    expect(can(p, 'notification.send', { type: 'USER', id: 'u_student' }, lookup)).toBe(true)
    expect(can(p, 'notification.send_urgent', { type: 'UNIT', id: comp210.id }, lookup)).toBe(true)
  })
  it('cannot message other units, whole courses or unrelated students', () => {
    const other = dataset.units.find((u) => !user('u_lecturer').unitIds.includes(u.id))!
    expect(can(p, 'notification.send', { type: 'UNIT', id: other.id }, lookup)).toBe(false)
    expect(can(p, 'notification.send', { type: 'COURSE', id: bscs.id }, lookup)).toBe(false)
    expect(can(p, 'notification.send', { type: 'USER', id: studentIn(otherCourse.id, 1).uid }, lookup)).toBe(false)
    expect(can(p, 'notification.send', INSTITUTION_SCOPE, lookup)).toBe(false)
  })
  it('sees full phone numbers of their students', () => {
    expect(phoneVisibility(p, 'u_student', lookup)).toBe('FULL')
  })
})

describe('student president', () => {
  const p = principal('u_president')
  it('reaches the whole university, including URGENT', () => {
    expect(can(p, 'notification.send', INSTITUTION_SCOPE, lookup)).toBe(true)
    expect(can(p, 'notification.send', { type: 'SCHOOL', id: dataset.schools[3].id }, lookup)).toBe(true)
    expect(can(p, 'notification.send_urgent', INSTITUTION_SCOPE, lookup)).toBe(true)
    expect(can(p, 'student.view_contact', { type: 'USER', id: 'u_student' }, lookup)).toBe(false)
  })
  it('student officials cannot send URGENT and have a tighter limit', () => {
    const official = dataset.leadershipPositions.find((x) => x.position === 'STUDENT_OFFICIAL')!
    const po = principal(official.userId)
    expect(can(po, 'notification.send', INSTITUTION_SCOPE, lookup)).toBe(true)
    expect(can(po, 'notification.send_urgent', INSTITUTION_SCOPE, lookup)).toBe(false)
    expect(dailySendLimit(po.claims, dataset.settings[0])!).toBeLessThan(dailySendLimit(p.claims, dataset.settings[0])!)
  })
})

describe('leadership positions', () => {
  it('an expired position loses its rights', () => {
    // u_student held "Class Rep BSCS Year 1" last year (expired, history kept)
    expect(dataset.leadershipPositions.some((x) => x.userId === 'u_student' && !x.isActive)).toBe(true)
    expect(principal('u_student').claims.positions).toEqual([])
    // The class rep's term ends on 31 July: the day after, the rights are gone
    const pos = dataset.leadershipPositions.find((x) => x.userId === 'u_classrep')!
    const after = new Date(pos.endDate.getTime() + 86_400_000)
    const claims = computeClaims(user('u_classrep'), [pos], after)
    expect(claims.scopes).toEqual([])
    const p = { uid: 'u_classrep', isActive: true, claims }
    expect(can(p, 'notification.send')).toBe(false)
    expect(can(p, 'student.search_by_admission')).toBe(false)
  })
  it('a position that has not started yet grants nothing', () => {
    const pos = dataset.leadershipPositions.find((x) => x.userId === 'u_classrep')!
    expect(computeClaims(user('u_classrep'), [pos], new Date(pos.startDate.getTime() - 1000)).scopes).toEqual([])
  })
})

describe('staff roles', () => {
  it('dean is limited to their school, HOD to their faculty', () => {
    const dean = principal('u_dean_sist')
    expect(can(dean, 'notification.send', { type: 'COURSE', id: bscs.id }, lookup)).toBe(true)
    expect(can(dean, 'notification.send', { type: 'COURSE', id: otherCourse.id }, lookup)).toBe(false)
    const hod = principal('u_hod_computing')
    expect(can(hod, 'notification.send', courseYear(bscs.id, 4), lookup)).toBe(true)
    expect(can(hod, 'notification.send', { type: 'SCHOOL', id: bscs.schoolId }, lookup)).toBe(false)
    expect(can(hod, 'analytics.view')).toBe(true)
  })
  it('general staff are read-only in their scope', () => {
    const p = principal('u_staff_1')
    expect(can(p, 'notification.send')).toBe(false)
    expect(can(p, 'directory.view')).toBe(true)
    expect(can(p, 'settings.manage')).toBe(false)
  })
  it('only super admin manages settings; admins manage users and audit', () => {
    expect(can(principal('u_superadmin'), 'settings.manage')).toBe(true)
    expect(can(principal('u_registrar'), 'settings.manage')).toBe(false)
    expect(can(principal('u_registrar'), 'user.manage')).toBe(true)
    expect(can(principal('u_registrar'), 'audit.view')).toBe(true)
    expect(can(principal('u_dean_sist'), 'audit.view')).toBe(false)
  })
  it('inactive users can do nothing', () => {
    const p = { ...principal('u_lecturer'), isActive: false }
    expect(can(p, 'notification.view_own')).toBe(false)
    expect(can(p, 'notification.send', { type: 'UNIT', id: comp210.id }, lookup)).toBe(false)
  })
})

it('claims have the custom-claims shape', () => {
  const c = principal('u_classrep').claims
  expect(c).toMatchObject({ role: 'STUDENT', userType: 'STUDENT', positions: ['CLASS_REP'] })
  expect(c.scopes[0]).toEqual({ type: 'COURSE_YEAR', id: bscs.id, yearOfStudy: 2 })
})
