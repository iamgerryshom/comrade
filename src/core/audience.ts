import type { AudienceRule, SavedGroup, Scope } from '@/types'
import type { ScopedUser } from './hierarchy'

export interface AudienceSource {
  users: ScopedUser[]
  groups?: Pick<SavedGroup, 'id' | 'memberIds' | 'ownerId'>[]
}

/**
 * Resolve an audience rule into a deduplicated list of active recipient uids.
 * Firestore equivalent: one `where()` query per rule (users by schoolId / facultyId /
 * courseId+yearOfStudy / unitIds array-contains), executed inside the sendNotification Cloud Function.
 */
export function resolveAudience(rule: AudienceRule, src: AudienceSource, opts: { excludeUid?: string } = {}): string[] {
  const studentsOrStaff = (u: ScopedUser) => u.userType === 'STUDENT' || (rule.includeStaff ?? false)
  let match: (u: ScopedUser) => boolean
  switch (rule.targetType) {
    case 'INSTITUTION':
      match = studentsOrStaff
      break
    case 'SCHOOL':
      match = (u) => studentsOrStaff(u) && u.schoolId === rule.targetId
      break
    case 'FACULTY':
      match = (u) => studentsOrStaff(u) && u.facultyId === rule.targetId
      break
    case 'COURSE':
      match = (u) => u.userType === 'STUDENT' && u.courseId === rule.targetId
      break
    case 'COURSE_YEAR':
      match = (u) => u.userType === 'STUDENT' && u.courseId === rule.targetId && u.yearOfStudy === rule.yearOfStudy
      break
    case 'UNIT':
      match = (u) => u.userType === 'STUDENT' && u.unitIds.includes(rule.targetId)
      break
    case 'USER':
      match = (u) => u.uid === rule.targetId
      break
    case 'GROUP': {
      const group = src.groups?.find((g) => g.id === rule.targetId)
      const members = new Set(group?.memberIds ?? [])
      match = (u) => members.has(u.uid)
      break
    }
  }
  const out = new Set<string>()
  for (const u of src.users) {
    if (!u.isActive || u.uid === opts.excludeUid) continue
    if (match(u)) out.add(u.uid)
  }
  return [...out]
}

/** The permission scope(s) a rule targets. A GROUP expands to one USER scope per member. */
export function ruleToScopes(rule: AudienceRule, src: AudienceSource): Scope[] {
  switch (rule.targetType) {
    case 'GROUP': {
      const g = src.groups?.find((x) => x.id === rule.targetId)
      return (g?.memberIds ?? []).map((id) => ({ type: 'USER' as const, id }))
    }
    case 'COURSE_YEAR':
      return [{ type: 'COURSE_YEAR', id: rule.targetId, yearOfStudy: rule.yearOfStudy }]
    default:
      return [{ type: rule.targetType, id: rule.targetId }]
  }
}
