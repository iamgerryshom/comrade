import type { Course, Faculty, School, Scope, Unit, User } from '@/types'

export type ScopedUser = Pick<
  User,
  'uid' | 'userType' | 'isActive' | 'schoolId' | 'facultyId' | 'courseId' | 'yearOfStudy' | 'unitIds'
>

/** Minimal lookup used by permission + audience logic. Works on the mock store or Firestore reads. */
export interface HierarchyLookup {
  school(id: string): School | undefined
  faculty(id: string): Faculty | undefined
  course(id: string): Course | undefined
  unit(id: string): Unit | undefined
  user(uid: string): ScopedUser | undefined
}

export function createLookup(data: {
  schools: School[]
  faculties: Faculty[]
  courses: Course[]
  units: Unit[]
  users: ScopedUser[]
}): HierarchyLookup {
  const idx = <T,>(arr: T[], key: (t: T) => string) => new Map(arr.map((x) => [key(x), x]))
  const s = idx(data.schools, (x) => x.id)
  const f = idx(data.faculties, (x) => x.id)
  const c = idx(data.courses, (x) => x.id)
  const u = idx(data.units, (x) => x.id)
  const p = idx(data.users, (x) => x.uid)
  return {
    school: (id) => s.get(id),
    faculty: (id) => f.get(id),
    course: (id) => c.get(id),
    unit: (id) => u.get(id),
    user: (id) => p.get(id),
  }
}

/** School that a scope lives in (null for INSTITUTION / unknown). */
export function schoolOf(scope: Scope, h: HierarchyLookup): string | null {
  switch (scope.type) {
    case 'SCHOOL':
      return scope.id
    case 'FACULTY':
      return h.faculty(scope.id)?.schoolId ?? null
    case 'COURSE':
    case 'COURSE_YEAR':
      return h.course(scope.id)?.schoolId ?? null
    case 'UNIT':
      return h.unit(scope.id)?.schoolId ?? null
    case 'USER':
      return h.user(scope.id)?.schoolId ?? null
    default:
      return null
  }
}

export function facultyOf(scope: Scope, h: HierarchyLookup): string | null {
  switch (scope.type) {
    case 'FACULTY':
      return scope.id
    case 'COURSE':
    case 'COURSE_YEAR':
      return h.course(scope.id)?.facultyId ?? null
    case 'UNIT':
      return h.unit(scope.id)?.facultyId ?? null
    case 'USER':
      return h.user(scope.id)?.facultyId ?? null
    default:
      return null
  }
}

/** Is `target` fully inside `granted`? */
export function scopeContains(granted: Scope, target: Scope, h: HierarchyLookup): boolean {
  switch (granted.type) {
    case 'INSTITUTION':
      return true
    case 'SCHOOL':
      return target.type !== 'INSTITUTION' && schoolOf(target, h) === granted.id
    case 'FACULTY':
      return !['INSTITUTION', 'SCHOOL'].includes(target.type) && facultyOf(target, h) === granted.id
    case 'COURSE': {
      if (target.type === 'COURSE' || target.type === 'COURSE_YEAR') return target.id === granted.id
      if (target.type === 'USER') return h.user(target.id)?.courseId === granted.id
      return false
    }
    case 'COURSE_YEAR': {
      if (target.type === 'COURSE_YEAR')
        return target.id === granted.id && target.yearOfStudy === granted.yearOfStudy
      if (target.type === 'USER') {
        const u = h.user(target.id)
        return !!u && u.courseId === granted.id && u.yearOfStudy === granted.yearOfStudy
      }
      return false
    }
    case 'UNIT': {
      if (target.type === 'UNIT') return target.id === granted.id
      if (target.type === 'USER') {
        const u = h.user(target.id)
        return !!u && u.userType === 'STUDENT' && u.unitIds.includes(granted.id)
      }
      return false
    }
    case 'USER':
      return target.type === 'USER' && target.id === granted.id
  }
}

export function scopeKey(s: Scope): string {
  return s.type === 'COURSE_YEAR' ? `${s.type}:${s.id}:${s.yearOfStudy}` : `${s.type}:${s.id}`
}
