import type { AudienceRule, LeadershipPosition, User } from '@/types'

export interface LabelNames {
  unitCode(id: string): string | undefined
  facultyName(id: string): string | undefined
  schoolCode(id: string): string | undefined
  courseCode(id: string): string | undefined
}

const ORDER = ['STUDENT_PRESIDENT', 'STUDENT_OFFICIAL', 'SCHOOL_REP', 'FACULTY_REP', 'CLASS_REP']

/**
 * Short "From:" label used in SMS and notices, e.g. "Lecturer COMP210", "Class Rep BSCS Y2".
 * Shared by the compose preview (client) and sendNotification (server) so the preview is exact.
 * `activePositions` must already be filtered to active positions.
 */
export function computeSenderLabel(
  user: Pick<User, 'userType' | 'role' | 'title' | 'schoolId' | 'facultyId'>,
  activePositions: Pick<LeadershipPosition, 'position' | 'title' | 'scopeId' | 'yearOfStudy'>[],
  rule: AudienceRule,
  names: LabelNames,
): string {
  if (user.userType === 'STAFF') {
    switch (user.role) {
      case 'LECTURER': {
        const code = rule.targetType === 'UNIT' ? names.unitCode(rule.targetId) : undefined
        return code ? `Lecturer ${code.replace(/\s/g, '')}` : 'Lecturer'
      }
      case 'HOD':
        return `HOD ${(names.facultyName(user.facultyId ?? '') ?? '').replace('Department of ', '').slice(0, 22)}`.trim()
      case 'SCHOOL_DEAN':
        return `Dean ${names.schoolCode(user.schoolId ?? '') ?? ''}`.trim()
      case 'INSTITUTION_ADMIN':
        return (user.title ?? 'Registrar').split(/[(,]/)[0].trim()
      case 'SUPER_ADMIN':
        return 'KSU Admin'
      default:
        return 'KSU Staff'
    }
  }
  const pos = [...activePositions].sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position))[0]
  if (!pos) return 'Student'
  switch (pos.position) {
    case 'STUDENT_PRESIDENT':
      return 'Student President'
    case 'STUDENT_OFFICIAL':
      return pos.title
    case 'SCHOOL_REP':
      return `School Rep ${names.schoolCode(pos.scopeId) ?? ''}`.trim()
    case 'FACULTY_REP':
      return 'Faculty Rep'
    case 'CLASS_REP':
      return `Class Rep ${names.courseCode(pos.scopeId) ?? ''} Y${pos.yearOfStudy ?? ''}`
  }
}
