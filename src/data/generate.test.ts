import { describe, expect, it } from 'vitest'
import structure from './kisii-structure.json'
import { DEMO_ACCOUNTS, generateDataset, type KisiiStructure } from './generate'

const NOW = new Date('2026-11-06T09:00:00Z')

describe('generateDataset', () => {
  const ds = generateDataset(structure as KisiiStructure, { now: NOW })

  it('is deterministic for the same seed', () => {
    const again = generateDataset(structure as KisiiStructure, { now: NOW })
    expect(again.users.map((u) => u.admissionNumber ?? u.staffNumber)).toEqual(ds.users.map((u) => u.admissionNumber ?? u.staffNumber))
  })

  it('has the expected volume', () => {
    const students = ds.users.filter((u) => u.userType === 'STUDENT')
    const staff = ds.users.filter((u) => u.userType === 'STAFF')
    console.info({
      schools: ds.schools.length, faculties: ds.faculties.length, courses: ds.courses.length, units: ds.units.length,
      students: students.length, staff: staff.length, positions: ds.leadershipPositions.length,
      notifications: ds.notifications.length, deliveries: ds.deliveries.length, sms: ds.smsMessages.length,
      enrollments: ds.enrollments.length,
    })
    expect(students.length).toBeGreaterThanOrEqual(300)
    expect(students.length).toBeLessThanOrEqual(500)
    expect(ds.notifications.length).toBeGreaterThanOrEqual(38)
    for (const c of ds.courses) expect(students.some((s) => s.courseId === c.id)).toBe(true)
  })

  it('creates every demo account', () => {
    for (const a of DEMO_ACCOUNTS) expect(ds.users.find((u) => u.uid === a.uid)?.email).toBe(a.email)
  })

  it('gives the demo lecturer COMP 210 Data Structures with BSCS Y2 students enrolled', () => {
    const lec = ds.users.find((u) => u.uid === 'u_lecturer')!
    const unit = ds.units.find((u) => u.id === lec.unitIds[0])!
    expect(unit.name).toBe('Data Structures')
    expect(unit.code).toBe('COMP 210')
    const student = ds.users.find((u) => u.uid === 'u_student')!
    expect(student.unitIds).toContain(unit.id)
  })

  it('has unique ids per collection', () => {
    for (const [name, docs] of Object.entries(ds)) {
      const ids = (docs as Array<{ id?: string; uid?: string }>).map((d) => d.id ?? d.uid)
      expect(new Set(ids).size, name).toBe(ids.length)
    }
  })
})
