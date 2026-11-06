import type { AppSettings, Claims, LeadershipPosition, PositionType, Role, Scope, User } from '@/types'
import { scopeContains, type HierarchyLookup } from './hierarchy'

/**
 * Central permission model. Pure functions: the mock "callable functions" use them now,
 * Cloud Functions import the same file in Phase 9.
 */

export type Action =
  | 'notification.view_own'
  | 'notification.ack'
  | 'notification.send'
  | 'notification.send_urgent'
  | 'student.search_by_admission'
  | 'student.view_contact'
  | 'directory.view'
  | 'analytics.view'
  | 'sms_logs.view'
  | 'user.manage'
  | 'role.assign'
  | 'settings.manage'
  | 'audit.view'

export interface Principal {
  uid: string
  isActive: boolean
  claims: Claims
}

export const INSTITUTION_ID = 'ksu'
export const INSTITUTION_SCOPE: Scope = { type: 'INSTITUTION', id: INSTITUTION_ID }

const SENDING_STAFF: Role[] = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'SCHOOL_DEAN', 'HOD', 'LECTURER']
const ADMINS: Role[] = ['SUPER_ADMIN', 'INSTITUTION_ADMIN']
const ANALYTICS: Role[] = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'SCHOOL_DEAN', 'HOD']

export function isPositionActive(p: LeadershipPosition, now: Date): boolean {
  return p.isActive && p.startDate.getTime() <= now.getTime() && now.getTime() <= p.endDate.getTime()
}

export function positionScope(p: LeadershipPosition): Scope {
  if (p.scopeType === 'COURSE_YEAR') return { type: 'COURSE_YEAR', id: p.scopeId, yearOfStudy: p.yearOfStudy }
  return { type: p.scopeType, id: p.scopeId }
}

/** Build the custom-claims object for a user. Cloud Functions will set exactly this. */
export function computeClaims(
  user: Pick<User, 'role' | 'userType' | 'schoolId' | 'facultyId' | 'unitIds'>,
  positions: LeadershipPosition[],
  now: Date,
): Claims {
  const scopes: Scope[] = []
  const readScopes: Scope[] = []
  const active = positions.filter((p) => isPositionActive(p, now))
  if (user.userType === 'STAFF') {
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'INSTITUTION_ADMIN':
        scopes.push(INSTITUTION_SCOPE)
        break
      case 'SCHOOL_DEAN':
        if (user.schoolId) scopes.push({ type: 'SCHOOL', id: user.schoolId })
        break
      case 'HOD':
        if (user.facultyId) scopes.push({ type: 'FACULTY', id: user.facultyId })
        break
      case 'LECTURER':
        for (const u of user.unitIds) scopes.push({ type: 'UNIT', id: u })
        break
      case 'STAFF':
        if (user.facultyId) readScopes.push({ type: 'FACULTY', id: user.facultyId })
        else if (user.schoolId) readScopes.push({ type: 'SCHOOL', id: user.schoolId })
        break
    }
  } else {
    for (const p of active) {
      scopes.push(positionScope(p))
      if (p.position === 'CLASS_REP' && p.unitId) scopes.push({ type: 'UNIT', id: p.unitId })
    }
  }
  return {
    role: user.role,
    userType: user.userType,
    scopes,
    readScopes,
    positions: user.userType === 'STUDENT' ? [...new Set(active.map((p) => p.position))] : [],
  }
}

export function isStudentLeader(claims: Claims): boolean {
  return claims.userType === 'STUDENT' && claims.positions.length > 0
}

export function canSendAtAll(claims: Claims): boolean {
  if (claims.userType === 'STAFF') return SENDING_STAFF.includes(claims.role) && claims.scopes.length > 0
  return isStudentLeader(claims) && claims.scopes.length > 0
}

function within(scopes: Scope[], target: Scope | undefined, h: HierarchyLookup | undefined): boolean {
  if (!target) return scopes.length > 0
  if (!h) return scopes.some((s) => s.type === 'INSTITUTION')
  return scopes.some((s) => scopeContains(s, target, h))
}

/**
 * The single permission check. `target` is the scope being acted on (audience, student, node).
 * Without a target it answers "can the user do this anywhere?" (used to show/hide UI).
 */
export function can(p: Principal, action: Action, target?: Scope, h?: HierarchyLookup): boolean {
  if (!p.isActive) return false
  const c = p.claims
  switch (action) {
    case 'notification.view_own':
    case 'notification.ack':
      return true
    case 'notification.send':
      return canSendAtAll(c) && within(c.scopes, target, h)
    case 'notification.send_urgent':
      return (
        canSendAtAll(c) &&
        (c.userType === 'STAFF' || c.positions.includes('STUDENT_PRESIDENT')) &&
        within(c.scopes, target, h)
      )
    case 'student.search_by_admission':
    case 'directory.view':
      if (c.userType === 'STUDENT' && !isStudentLeader(c)) return false
      return within([...c.scopes, ...c.readScopes], target, h)
    case 'student.view_contact':
      return c.userType === 'STAFF' && within([...c.scopes, ...c.readScopes], target, h)
    case 'analytics.view':
      return c.userType === 'STAFF' && ANALYTICS.includes(c.role) && within(c.scopes, target, h)
    case 'sms_logs.view':
    case 'user.manage':
    case 'role.assign':
    case 'audit.view':
      return c.userType === 'STAFF' && ADMINS.includes(c.role)
    case 'settings.manage':
      return c.userType === 'STAFF' && c.role === 'SUPER_ADMIN'
  }
}

/** How much of another user's phone number the caller may see. */
export function phoneVisibility(
  p: Principal,
  targetUid: string,
  h: HierarchyLookup,
): 'FULL' | 'MASKED' | 'HIDDEN' {
  if (p.uid === targetUid) return 'FULL'
  const target: Scope = { type: 'USER', id: targetUid }
  if (can(p, 'student.view_contact', target, h)) return 'FULL'
  if (isStudentLeader(p.claims) && can(p, 'student.search_by_admission', target, h)) return 'MASKED'
  return 'HIDDEN'
}

/** Daily send limit for student senders (null = unlimited / staff). Uses the most generous active position. */
export function dailySendLimit(claims: Claims, settings: Pick<AppSettings, 'rateLimits'>): number | null {
  if (claims.userType === 'STAFF') return null
  if (claims.positions.length === 0) return 0
  return Math.max(...claims.positions.map((pos: PositionType) => settings.rateLimits[pos] ?? 0))
}
