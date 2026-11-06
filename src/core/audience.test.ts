import { describe, expect, it } from 'vitest'
import { resolveAudience, ruleToScopes } from './audience'
import type { ScopedUser } from './hierarchy'

const mk = (uid: string, o: Partial<ScopedUser> = {}): ScopedUser => ({
  uid,
  userType: 'STUDENT',
  isActive: true,
  schoolId: 's1',
  facultyId: 'f1',
  courseId: 'c1',
  yearOfStudy: 1,
  unitIds: [],
  ...o,
})
const users: ScopedUser[] = [
  mk('a', { unitIds: ['u1', 'u2'] }),
  mk('b', { yearOfStudy: 2, unitIds: ['u1'] }),
  mk('c', { courseId: 'c2', facultyId: 'f2', unitIds: ['u2'] }),
  mk('d', { schoolId: 's2', facultyId: 'f3', courseId: 'c3' }),
  mk('e', { isActive: false }),
  mk('lec', { userType: 'STAFF', courseId: null, yearOfStudy: null, unitIds: ['u1'] }),
]
const groups = [{ id: 'g1', ownerId: 'lec', memberIds: ['a', 'a', 'c', 'e'] }]
const sorted = (x: string[]) => [...x].sort()

describe('resolveAudience', () => {
  it('INSTITUTION: all active students, staff only when asked', () => {
    expect(sorted(resolveAudience({ targetType: 'INSTITUTION', targetId: 'ksu' }, { users }))).toEqual(['a', 'b', 'c', 'd'])
    expect(resolveAudience({ targetType: 'INSTITUTION', targetId: 'ksu', includeStaff: true }, { users })).toContain('lec')
  })
  it('SCHOOL', () => expect(sorted(resolveAudience({ targetType: 'SCHOOL', targetId: 's1' }, { users }))).toEqual(['a', 'b', 'c']))
  it('FACULTY', () => expect(sorted(resolveAudience({ targetType: 'FACULTY', targetId: 'f1' }, { users }))).toEqual(['a', 'b']))
  it('COURSE', () => expect(sorted(resolveAudience({ targetType: 'COURSE', targetId: 'c1' }, { users }))).toEqual(['a', 'b']))
  it('COURSE_YEAR', () =>
    expect(resolveAudience({ targetType: 'COURSE_YEAR', targetId: 'c1', yearOfStudy: 2 }, { users })).toEqual(['b']))
  it('UNIT: enrolled students only (not the lecturer)', () =>
    expect(sorted(resolveAudience({ targetType: 'UNIT', targetId: 'u1' }, { users }))).toEqual(['a', 'b']))
  it('UNIT shared across courses', () =>
    expect(sorted(resolveAudience({ targetType: 'UNIT', targetId: 'u2' }, { users }))).toEqual(['a', 'c']))
  it('USER', () => expect(resolveAudience({ targetType: 'USER', targetId: 'd' }, { users })).toEqual(['d']))
  it('USER that is inactive → nobody', () =>
    expect(resolveAudience({ targetType: 'USER', targetId: 'e' }, { users })).toEqual([]))
  it('GROUP: deduplicated, inactive members dropped', () =>
    expect(sorted(resolveAudience({ targetType: 'GROUP', targetId: 'g1' }, { users, groups }))).toEqual(['a', 'c']))
  it('excludes the sender', () =>
    expect(
      resolveAudience({ targetType: 'INSTITUTION', targetId: 'ksu', includeStaff: true }, { users }, { excludeUid: 'lec' }),
    ).not.toContain('lec'))
  it('never returns duplicates even if the source has them', () => {
    const r = resolveAudience({ targetType: 'INSTITUTION', targetId: 'ksu' }, { users: [...users, users[0]] })
    expect(r.length).toBe(new Set(r).size)
  })
  it('ruleToScopes expands groups to their members', () => {
    expect(ruleToScopes({ targetType: 'GROUP', targetId: 'g1' }, { users, groups }).map((s) => s.id)).toEqual([
      'a',
      'a',
      'c',
      'e',
    ])
    expect(ruleToScopes({ targetType: 'COURSE_YEAR', targetId: 'c1', yearOfStudy: 2 }, { users })).toEqual([
      { type: 'COURSE_YEAR', id: 'c1', yearOfStudy: 2 },
    ])
  })
})
