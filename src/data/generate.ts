import type {
  AppSettings,
  AuditLog,
  Course,
  CourseLevel,
  CourseUnit,
  Delivery,
  DeliveryStatus,
  Device,
  Enrollment,
  Faculty,
  Institution,
  LeadershipPosition,
  Notification,
  PositionType,
  Role,
  SavedGroup,
  School,
  SmsMessage,
  Unit,
  UnitAssignment,
  User,
  AudienceRule,
  Category,
  Priority,
  CollectionName,
} from '@/types'
import { resolveAudience } from '@/core/audience'
import { buildSmsText } from '@/core/delivery/sms'
import { countDeliveries, newDelivery } from '@/core/delivery/state'
import { INSTITUTION_ID } from '@/core/permissions'
import { createRng, type Rng } from './random'
import { FIRST_NAMES_F, FIRST_NAMES_M, STAFF_TITLES, SURNAMES } from './names'
import { COMMON_UNITS, COURSE_TEMPLATES, courseSubject, DEPT_CATALOG } from './unitCatalog'

/**
 * Builds the complete demo dataset from `kisii-structure.json`. Deterministic for a given seed.
 * The output is keyed by Firestore collection name, so the Phase 9 seed script can upload it as-is
 * (and create Firebase Auth users from `users`).
 */

export interface KisiiStructure {
  institution: string
  retrievedAt: string
  schools: Array<{
    name: string
    code: string
    sourceUrl: string
    verified?: boolean
    faculties: Array<{
      name: string
      verified?: boolean
      courses: Array<{ name: string; code: string; level: string; durationYears: number; verified?: boolean }>
    }>
  }>
}

export interface Dataset {
  institutions: Institution[]
  schools: School[]
  faculties: Faculty[]
  courses: Course[]
  units: Unit[]
  courseUnits: CourseUnit[]
  users: User[]
  devices: Device[]
  leadershipPositions: LeadershipPosition[]
  enrollments: Enrollment[]
  unitAssignments: UnitAssignment[]
  notifications: Notification[]
  deliveries: Delivery[]
  smsMessages: SmsMessage[]
  savedGroups: SavedGroup[]
  auditLogs: AuditLog[]
  settings: AppSettings[]
}
// Compile-time check that Dataset covers every collection
const _check: Record<CollectionName, unknown> = {} as Dataset
void _check

export interface GenerateOptions {
  seed?: number
  now?: Date
  ackTimeoutSeconds?: number
}

export const DEMO_PASSWORD = 'comrade123'
export const EMAIL_DOMAIN = 'demo.kisiiuniversity.ac.ke'
export const POPULAR_COURSE_CODES = ['BSCS', 'BSIT', 'BSSE', 'BCOM', 'BSN', 'BEDA', 'LLB', 'BSPH', 'BBM', 'BACP']

export interface DemoAccount {
  key: string
  label: string
  description: string
  uid: string
  email: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'superadmin', label: 'Super Admin', description: 'Manages users, roles & settings', uid: 'u_superadmin', email: `superadmin@${EMAIL_DOMAIN}` },
  { key: 'registrar', label: 'Registrar', description: 'Institution admin, whole university', uid: 'u_registrar', email: `registrar@${EMAIL_DOMAIN}` },
  { key: 'dean', label: 'Dean (SIST)', description: 'School of Information Science & Tech', uid: 'u_dean_sist', email: `dean.sist@${EMAIL_DOMAIN}` },
  { key: 'hod', label: 'HOD (Computing)', description: 'Department of Computing Science', uid: 'u_hod_computing', email: `hod.computing@${EMAIL_DOMAIN}` },
  { key: 'lecturer', label: 'Lecturer', description: 'Teaches COMP 210 Data Structures', uid: 'u_lecturer', email: `lecturer@${EMAIL_DOMAIN}` },
  { key: 'president', label: 'Student President', description: 'Student government, whole university', uid: 'u_president', email: `president@${EMAIL_DOMAIN}` },
  { key: 'classrep', label: 'Class Rep', description: 'BSc Computer Science, Year 2', uid: 'u_classrep', email: `classrep@${EMAIL_DOMAIN}` },
  { key: 'student', label: 'Ordinary Student', description: 'BSc Computer Science, Year 2', uid: 'u_student', email: `student@${EMAIL_DOMAIN}` },
  { key: 'student2', label: 'Student B (offline demo)', description: 'BSc Computer Science, Year 2', uid: 'u_student2', email: `student2@${EMAIL_DOMAIN}` },
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const DAY = 86_400_000

/** Academic year string for a date (Sept–Aug), and current semester (Sept–Dec = 1, Jan–Aug = 2). */
export function academicCalendar(now: Date) {
  const y = now.getFullYear()
  const start = now.getMonth() >= 8 ? y : y - 1
  return { academicYear: `${start}/${start + 1}`, startYear: start, semester: (now.getMonth() >= 8 ? 1 : 2) as 1 | 2 }
}

export function generateDataset(structure: KisiiStructure, opts: GenerateOptions = {}): Dataset {
  const rng: Rng = createRng(opts.seed ?? 2026)
  const now = opts.now ?? new Date()
  const ackTimeoutSeconds = opts.ackTimeoutSeconds ?? 60
  const cal = academicCalendar(now)
  const created = new Date(now.getTime() - 120 * DAY)

  const ds: Dataset = {
    institutions: [{ id: INSTITUTION_ID, name: structure.institution, code: 'KSU' }],
    schools: [],
    faculties: [],
    courses: [],
    units: [],
    courseUnits: [],
    users: [],
    devices: [],
    leadershipPositions: [],
    enrollments: [],
    unitAssignments: [],
    notifications: [],
    deliveries: [],
    smsMessages: [],
    savedGroups: [],
    auditLogs: [],
    settings: [
      {
        id: 'app',
        ackTimeoutSeconds,
        rateLimits: { CLASS_REP: 10, FACULTY_REP: 15, SCHOOL_REP: 20, STUDENT_PRESIDENT: 30, STUDENT_OFFICIAL: 5 },
        smsSenderId: 'COMRADE-KSU',
        smsCostKes: 0.8,
        updatedAt: created,
      },
    ],
  }

  // ───────── Hierarchy ─────────
  const unitByKey = new Map<string, Unit>()
  const addUnit = (code: string, name: string, schoolId: string, facultyId: string): Unit => {
    const existing = unitByKey.get(code)
    if (existing) return existing
    const u: Unit = { id: `unit_${slug(code).replace(/-/g, '')}`, code, name, schoolId, facultyId, demo: true }
    unitByKey.set(code, u)
    ds.units.push(u)
    return u
  }
  const offer = (courseId: string, unitId: string, yearOfStudy: number, semester: 1 | 2) =>
    ds.courseUnits.push({ id: `cu_${courseId}_${unitId}_${yearOfStudy}`, courseId, unitId, yearOfStudy, semester })

  const firstSchool = structure.schools[0]
  const commonOwner = { schoolId: `sch_${slug(firstSchool.code)}`, facultyId: '' }
  const usedPrefixes = new Set<string>()

  for (const s of structure.schools) {
    const school: School = {
      id: `sch_${slug(s.code)}`,
      institutionId: INSTITUTION_ID,
      name: s.name,
      code: s.code,
      sourceUrl: s.sourceUrl,
      verified: s.verified ?? false,
    }
    ds.schools.push(school)
    s.faculties.forEach((f, fi) => {
      const faculty: Faculty = {
        id: `fac_${slug(s.code)}_${fi + 1}`,
        institutionId: INSTITUTION_ID,
        schoolId: school.id,
        name: f.name,
        verified: f.verified ?? false,
      }
      ds.faculties.push(faculty)
      if (!commonOwner.facultyId) commonOwner.facultyId = faculty.id
      const cat = DEPT_CATALOG.find(([re]) => re.test(f.name))?.[1]
      let prefix = cat?.prefix ?? s.code.slice(0, 4).toUpperCase()
      while (usedPrefixes.has(prefix)) prefix = prefix.slice(0, 3) + String.fromCharCode(65 + rng.int(0, 25))
      usedPrefixes.add(prefix)
      const shared = cat?.shared ?? []

      f.courses.forEach((c, ci) => {
        const course: Course = {
          id: `crs_${slug(c.code)}`,
          institutionId: INSTITUTION_ID,
          schoolId: school.id,
          facultyId: faculty.id,
          name: c.name,
          code: c.code,
          level: c.level as CourseLevel,
          durationYears: c.durationYears,
          verified: c.verified ?? false,
        }
        ds.courses.push(course)
        const years = Math.min(course.durationYears, 6)
        const subject = courseSubject(c.name)
        for (let y = 1; y <= years; y++) {
          // Year-1 university common units
          if (y === 1 && ['CERTIFICATE', 'DIPLOMA', 'UNDERGRADUATE'].includes(course.level)) {
            for (const cu of COMMON_UNITS) {
              const u = addUnit(cu.code, cu.name, commonOwner.schoolId, commonOwner.facultyId)
              offer(course.id, u.id, 1, 1)
            }
          }
          // Shared department units (3 per year, semester 1), shared across the department's courses
          for (let k = 0; k < 3; k++) {
            const topic = shared[(y - 1) * 3 + k]
            if (!topic) continue
            const u = addUnit(`${prefix} ${y}1${k}`, topic, school.id, faculty.id)
            offer(course.id, u.id, y, 1)
          }
          // Course-specific units (2 in semester 1, 2 in semester 2)
          for (let k = 0; k < 4; k++) {
            const tpl = COURSE_TEMPLATES[((y - 1) * 2 + k) % COURSE_TEMPLATES.length]
            const suffix = years > 1 && k >= 2 ? ' II' : ''
            const name = tpl.replace('S', subject) + (tpl.includes('Project') ? '' : suffix)
            const num = y * 100 + 20 + ci * 5 + k
            const code = `${prefix} ${num}`
            const u = addUnit(code, name, school.id, faculty.id)
            offer(course.id, u.id, y, k < 2 ? 1 : 2)
          }
        }
      })
    })
  }

  const unitsFor = (courseId: string, year: number, semester: 1 | 2) =>
    ds.courseUnits.filter((cu) => cu.courseId === courseId && cu.yearOfStudy === year && cu.semester === semester).map((cu) => cu.unitId)

  // ───────── People ─────────
  let phoneSeq = 1000
  const phone = () => `+2547000${String(phoneSeq++).padStart(5, '0')}`
  const usedNames = new Set<string>()
  const personName = () => {
    for (;;) {
      const female = rng.chance(0.5)
      const n = `${rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M)} ${rng.pick(SURNAMES)}`
      if (!usedNames.has(n)) {
        usedNames.add(n)
        return n
      }
    }
  }
  const emailFor = (name: string, uid: string) =>
    `${slug(name).replace(/-/g, '.').replace(/'/g, '')}.${uid.slice(-4)}@${EMAIL_DOMAIN}`

  const baseUser = (uid: string, name: string, userType: 'STAFF' | 'STUDENT', role: Role): User => ({
    uid,
    name,
    email: emailFor(name, uid),
    phone: phone(),
    userType,
    role,
    photoURL: null,
    isActive: true,
    smsOptOut: false,
    schoolId: null,
    facultyId: null,
    courseId: null,
    yearOfStudy: null,
    unitIds: [],
    onboardedAt: created,
    createdAt: created,
  })

  // Staff
  let staffSeq = 1
  const staffNo = () => `KSU/STF/${String(staffSeq++).padStart(4, '0')}`
  const addStaff = (uid: string, role: Role, extra: Partial<User> = {}) => {
    const name = extra.name ?? personName()
    const u: User = { ...baseUser(uid, name, 'STAFF', role), staffNumber: staffNo(), title: rng.pick(STAFF_TITLES), ...extra }
    ds.users.push(u)
    return u
  }

  const sist = ds.schools.find((s) => s.code === 'SIST') ?? ds.schools[0]
  const computing = ds.faculties.find((f) => /Computing/i.test(f.name)) ?? ds.faculties[0]
  const bscs = ds.courses.find((c) => c.code === 'BSCS') ?? ds.courses[0]

  addStaff('u_superadmin', 'SUPER_ADMIN', { name: 'Peter Nyakundi', email: DEMO_ACCOUNTS[0].email, title: 'Mr.' })
  addStaff('u_registrar', 'INSTITUTION_ADMIN', { name: 'Dr. Grace Moraa', email: DEMO_ACCOUNTS[1].email, title: 'Registrar (Academic Affairs)' })
  addStaff('u_dean_students', 'INSTITUTION_ADMIN', { title: 'Dean of Students' })
  for (const s of ds.schools) {
    const isSist = s.id === sist.id
    addStaff(isSist ? 'u_dean_sist' : `u_dean_${slug(s.code)}`, 'SCHOOL_DEAN', {
      schoolId: s.id,
      title: `Dean, ${s.name}`,
      ...(isSist ? { name: 'Prof. Samuel Ondieki', email: DEMO_ACCOUNTS[2].email } : {}),
    })
  }
  for (const f of ds.faculties) {
    const isComp = f.id === computing.id
    addStaff(isComp ? 'u_hod_computing' : `u_hod_${f.id.replace('fac_', '')}`, 'HOD', {
      schoolId: f.schoolId,
      facultyId: f.id,
      title: `Head, ${f.name}`,
      ...(isComp ? { name: 'Dr. Esther Kerubo', email: DEMO_ACCOUNTS[3].email } : {}),
    })
  }

  // Lecturers: teach current-semester units of popular courses
  const popular = POPULAR_COURSE_CODES.map((code) => ds.courses.find((c) => c.code === code)).filter((c): c is Course => !!c)
  const teachable: Unit[] = []
  for (const c of popular) {
    for (let y = 1; y <= Math.min(c.durationYears, 4); y++) {
      for (const uid of unitsFor(c.id, y, cal.semester)) {
        const u = ds.units.find((x) => x.id === uid)!
        if (!u.code.startsWith('UCC') && !teachable.includes(u)) teachable.push(u)
      }
    }
  }
  const comp210 = ds.units.find((u) => u.name === 'Data Structures')
  const assign = (lecturer: User, unit: Unit) => {
    lecturer.unitIds.push(unit.id)
    ds.unitAssignments.push({ id: `ua_${lecturer.uid}_${unit.id}`, userId: lecturer.uid, unitId: unit.id, academicYear: cal.academicYear })
  }
  const demoLecturer = addStaff('u_lecturer', 'LECTURER', {
    name: 'Dr. Daniel Ogeto',
    email: DEMO_ACCOUNTS[4].email,
    schoolId: sist.id,
    facultyId: computing.id,
    title: 'Lecturer',
  })
  if (comp210) assign(demoLecturer, comp210)
  const oop = ds.units.find((u) => u.name === 'Object-Oriented Programming')
  if (oop) assign(demoLecturer, oop)
  const remaining = teachable.filter((u) => u.id !== comp210?.id && u.id !== oop?.id)
  let li = 0
  for (let i = 0; i < 20 && li < remaining.length; i++) {
    const first = remaining[li]
    const lec = addStaff(`u_lec_${String(i + 1).padStart(2, '0')}`, 'LECTURER', {
      schoolId: first.schoolId,
      facultyId: first.facultyId,
      title: rng.pick(['Lecturer', 'Senior Lecturer', 'Assistant Lecturer', 'Tutorial Fellow']),
    })
    const n = rng.int(3, 4)
    for (let k = 0; k < n && li < remaining.length; k++) {
      if (remaining[li].facultyId !== lec.facultyId && k > 0) break
      assign(lec, remaining[li++])
    }
  }
  // Common units get a lecturer too
  const commonLec = addStaff('u_lec_common', 'LECTURER', { schoolId: commonOwner.schoolId, facultyId: commonOwner.facultyId, title: 'Lecturer, Common Units' })
  for (const cu of COMMON_UNITS) assign(commonLec, unitByKey.get(cu.code)!)
  // General staff
  for (let i = 0; i < 4; i++) {
    const s = ds.schools[i % ds.schools.length]
    const f = ds.faculties.find((x) => x.schoolId === s.id)
    addStaff(`u_staff_${i + 1}`, 'STAFF', { schoolId: s.id, facultyId: i % 2 === 0 ? (f?.id ?? null) : null, title: rng.pick(['Administrative Assistant', 'Records Officer', 'Secretary']) })
  }

  // Students
  const serialByCourse = new Map<string, number>()
  const addStudent = (uid: string, course: Course, year: number, extra: Partial<User> = {}) => {
    const serial = (serialByCourse.get(course.id) ?? 0) + rng.int(1, 9)
    serialByCourse.set(course.id, serial)
    const intakeYear = cal.startYear - (year - 1)
    const name = extra.name ?? personName()
    const unitIds = unitsFor(course.id, year, cal.semester)
    const u: User = {
      ...baseUser(uid, name, 'STUDENT', 'STUDENT'),
      schoolId: course.schoolId,
      facultyId: course.facultyId,
      courseId: course.id,
      yearOfStudy: year,
      unitIds,
      admissionNumber: `${course.code}/${String(serial).padStart(4, '0')}/${intakeYear}`,
      intakeYear,
      semester: cal.semester,
      status: 'ACTIVE',
      ...extra,
    }
    if (!extra.phone && rng.chance(0.03)) u.phone = null
    if (rng.chance(0.05) && !extra.email) u.smsOptOut = true
    ds.users.push(u)
    // Enrollment history: every semester so far in this course
    for (let yy = 1; yy <= year; yy++) {
      for (const sem of [1, 2] as const) {
        if (yy === year && sem > cal.semester) continue
        const ay = `${intakeYear + yy - 1}/${intakeYear + yy}`
        for (const unitId of unitsFor(course.id, yy, sem))
          ds.enrollments.push({ id: `en_${uid}_${unitId}_${ay.slice(0, 4)}`, userId: uid, unitId, courseId: course.id, academicYear: ay, semester: sem })
      }
    }
    return u
  }

  // Demo students first (fixed identities, BSCS year 2)
  const demoStudents = {
    president: addStudent('u_president', ds.courses.find((c) => c.code === 'LLB') ?? bscs, 3, { name: 'Ian Mokaya', email: DEMO_ACCOUNTS[5].email }),
    classrep: addStudent('u_classrep', bscs, 2, { name: 'Faith Kemunto', email: DEMO_ACCOUNTS[6].email }),
    student: addStudent('u_student', bscs, 2, { name: 'Brian Onchiri', email: DEMO_ACCOUNTS[7].email }),
    student2: addStudent('u_student2', bscs, 2, { name: 'Mercy Nyaboke', email: DEMO_ACCOUNTS[8].email }),
  }
  for (const s of Object.values(demoStudents)) {
    s.smsOptOut = false
    if (!s.phone) s.phone = phone()
  }

  let stuSeq = 1
  const nextUid = () => `u_s${String(stuSeq++).padStart(4, '0')}`
  for (const c of ds.courses) {
    const years = Math.min(c.durationYears, 5)
    const isPopular = POPULAR_COURSE_CODES.includes(c.code)
    const count = isPopular ? rng.int(24, 29) : rng.int(2, 3)
    for (let i = 0; i < count; i++) {
      const year = isPopular ? (i % years) + 1 : rng.int(1, years)
      addStudent(nextUid(), c, year)
    }
  }
  // A couple of SMS edge cases for the demo
  const students = ds.users.filter((u) => u.userType === 'STUDENT' && !u.uid.startsWith('u_p') && !['u_classrep', 'u_student', 'u_student2'].includes(u.uid))
  if (students[3]) students[3].phone = '+254700099999' // provider rejects → retries → SMS_FAILED
  if (students[5]) students[5].phone = null

  // ───────── Leadership positions ─────────
  const termStart = new Date(cal.startYear, 7, 1)
  const termEnd = new Date(cal.startYear + 1, 6, 31)
  let posSeq = 1
  const addPosition = (userId: string, position: PositionType, title: string, scopeType: LeadershipPosition['scopeType'], scopeId: string, extra: Partial<LeadershipPosition> = {}) =>
    ds.leadershipPositions.push({ id: `pos_${String(posSeq++).padStart(3, '0')}`, userId, position, title, scopeType, scopeId, startDate: termStart, endDate: termEnd, isActive: true, ...extra })

  addPosition('u_president', 'STUDENT_PRESIDENT', 'Student President', 'INSTITUTION', INSTITUTION_ID)
  const studentPool = ds.users.filter((u) => u.userType === 'STUDENT' && /^u_s\d/.test(u.uid))
  const used = new Set<string>()
  const pickStudent = (pred: (u: User) => boolean) => {
    const u = studentPool.find((x) => !used.has(x.uid) && pred(x))
    if (u) used.add(u.uid)
    return u
  }
  const secGen = pickStudent((u) => u.yearOfStudy === 3)
  if (secGen) addPosition(secGen.uid, 'STUDENT_OFFICIAL', 'Secretary General', 'INSTITUTION', INSTITUTION_ID)
  const acSec = pickStudent((u) => u.yearOfStudy === 3)
  if (acSec) addPosition(acSec.uid, 'STUDENT_OFFICIAL', 'Academic Secretary', 'INSTITUTION', INSTITUTION_ID)
  for (const s of ds.schools) {
    const u = pickStudent((x) => x.schoolId === s.id)
    if (u) addPosition(u.uid, 'SCHOOL_REP', `School Rep, ${s.code}`, 'SCHOOL', s.id)
  }
  for (const f of ds.faculties) {
    const u = pickStudent((x) => x.facultyId === f.id)
    if (u) addPosition(u.uid, 'FACULTY_REP', `Faculty Rep, ${f.name.replace('Department of ', '')}`, 'FACULTY', f.id)
  }
  addPosition('u_classrep', 'CLASS_REP', `Class Rep, ${bscs.code} Year 2`, 'COURSE_YEAR', bscs.id, { yearOfStudy: 2 })
  used.add('u_classrep')
  for (const c of ds.courses) {
    for (let y = 1; y <= Math.min(c.durationYears, 5); y++) {
      if (c.id === bscs.id && y === 2) continue
      const group = studentPool.filter((u) => u.courseId === c.id && u.yearOfStudy === y)
      if (group.length < 2 || !rng.chance(0.85)) continue
      const u = pickStudent((x) => x.courseId === c.id && x.yearOfStudy === y)
      if (u) addPosition(u.uid, 'CLASS_REP', `Class Rep, ${c.code} Year ${y}`, 'COURSE_YEAR', c.id, { yearOfStudy: y })
    }
  }
  // An expired position (last year's class rep) to show history
  addPosition('u_student', 'CLASS_REP', `Class Rep, ${bscs.code} Year 1`, 'COURSE_YEAR', bscs.id, {
    yearOfStudy: 1,
    startDate: new Date(cal.startYear - 1, 7, 1),
    endDate: new Date(cal.startYear, 6, 31),
    isActive: false,
  })

  // ───────── Saved group ─────────
  ds.savedGroups.push({
    id: 'grp_project_team',
    ownerId: 'u_lecturer',
    name: 'COMP 210 project leads',
    memberIds: ds.users.filter((u) => comp210 && u.unitIds.includes(comp210.id) && u.userType === 'STUDENT').slice(0, 6).map((u) => u.uid),
    createdAt: created,
  })

  // ───────── Notification history ─────────
  generateHistory(ds, rng, now, ackTimeoutSeconds, { bscs, sist, computing, comp210 })

  ds.auditLogs.push({
    id: 'aud_seed_1',
    actorId: 'u_superadmin',
    actorName: 'Peter Nyakundi',
    actorRole: 'SUPER_ADMIN',
    action: 'settings.update',
    targetType: 'settings',
    targetId: 'app',
    targetLabel: 'App settings',
    scope: null,
    metadata: { ackTimeoutSeconds },
    createdAt: created,
  })
  return ds
}


const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function seededShortCode(rng: Rng) {

  return Array.from({ length: 4 }, () => CODE_ALPHABET[rng.int(0, CODE_ALPHABET.length - 1)]).join('')
}

function generateHistory(
  ds: Dataset,
  rng: Rng,
  now: Date,
  ackTimeoutSeconds: number,
  refs: { bscs: Course; sist: School; computing: Faculty; comp210?: Unit },
) {
  const userById = new Map(ds.users.map((u) => [u.uid, u]))
  const settings = ds.settings[0]
  const posOf = (uid: string) => ds.leadershipPositions.find((p) => p.userId === uid && p.isActive)
  type Seed = { sender: string; audience: AudienceRule; category: Category; priority: Priority; title: string; body: string; label: string; audienceLabel: string }
  const lecturers = ds.users.filter((u) => u.role === 'LECTURER' && u.unitIds.length)
  const unitById = new Map(ds.units.map((u) => [u.id, u]))
  const schoolSeeds = ds.schools.slice(0, 4)

  const seeds: Seed[] = [
    { sender: 'u_registrar', audience: { targetType: 'INSTITUTION', targetId: INSTITUTION_ID }, category: 'EXAM', priority: 'HIGH', title: 'End of semester examination timetable released', body: 'The provisional end of semester exam timetable is now available on the student portal. Report clashes to your HOD by Friday.', label: 'Registrar', audienceLabel: 'Whole university' },
    { sender: 'u_registrar', audience: { targetType: 'INSTITUTION', targetId: INSTITUTION_ID }, category: 'FINANCE', priority: 'NORMAL', title: 'Fee payment deadline', body: 'All students must clear at least 50% of semester fees to sit CATs. Pay via the official bank accounts only.', label: 'Registrar', audienceLabel: 'Whole university' },
    { sender: 'u_dean_students', audience: { targetType: 'INSTITUTION', targetId: INSTITUTION_ID }, category: 'EMERGENCY', priority: 'URGENT', title: 'Main campus water interruption', body: 'Water supply in hostels A–D will be interrupted from 8am to 2pm today due to repairs. Tankers will be at the main gate.', label: 'Dean of Students', audienceLabel: 'Whole university' },
    { sender: 'u_president', audience: { targetType: 'INSTITUTION', targetId: INSTITUTION_ID }, category: 'EVENT', priority: 'NORMAL', title: 'Comrades cultural week kicks off Monday', body: 'Join us at the main field for the opening ceremony at 2pm. All clubs should register their stands with KUSO.', label: 'Student President', audienceLabel: 'Whole university' },
    { sender: 'u_dean_sist', audience: { targetType: 'SCHOOL', targetId: refs.sist.id }, category: 'ACADEMIC', priority: 'NORMAL', title: 'SIST industrial attachment briefing', body: 'All third-year students in SIST should attend the attachment briefing in the ICT Lab at 10am Thursday.', label: 'Dean SIST', audienceLabel: refs.sist.name },
    { sender: 'u_hod_computing', audience: { targetType: 'FACULTY', targetId: refs.computing.id }, category: 'ACADEMIC', priority: 'NORMAL', title: 'Department meeting with class reps', body: 'Class reps from all computing programmes to meet the HOD in Room 12 on Wednesday at 4pm.', label: 'HOD Computing', audienceLabel: refs.computing.name },
    { sender: 'u_classrep', audience: { targetType: 'COURSE_YEAR', targetId: refs.bscs.id, yearOfStudy: 2 }, category: 'GENERAL', priority: 'NORMAL', title: 'Class photo on Friday', body: 'We meet at the library steps at 1pm for the class photo. Wear your student ID.', label: `Class Rep ${refs.bscs.code} Y2`, audienceLabel: `${refs.bscs.name} · Year 2` },
  ]
  if (refs.comp210) {
    seeds.push(
      { sender: 'u_lecturer', audience: { targetType: 'UNIT', targetId: refs.comp210.id }, category: 'EXAM', priority: 'HIGH', title: 'COMP 210 CAT moved to Fri 14 Nov, 10am, LH3', body: 'The Data Structures CAT has been moved due to the graduation rehearsal. Same topics: trees, heaps and hashing.', label: 'Lecturer COMP210', audienceLabel: `${refs.comp210.code} – ${refs.comp210.name}` },
      { sender: 'u_lecturer', audience: { targetType: 'UNIT', targetId: refs.comp210.id }, category: 'ACADEMIC', priority: 'NORMAL', title: 'Assignment 2 posted', body: 'Implement an AVL tree in Java or Python. Submit on the e-learning portal by next Monday midnight.', label: 'Lecturer COMP210', audienceLabel: `${refs.comp210.code} – ${refs.comp210.name}` },
    )
  }
  for (const s of schoolSeeds) {
    seeds.push({ sender: `u_dean_${s.code.toLowerCase()}`, audience: { targetType: 'SCHOOL', targetId: s.id }, category: rng.pick(['ACADEMIC', 'EVENT', 'GENERAL'] as const), priority: 'NORMAL', title: `${s.code} school assembly`, body: `All students in the ${s.name} are invited to the school assembly this Thursday at 11am in the main hall.`, label: `Dean ${s.code}`, audienceLabel: s.name })
  }
  const lectureTitles = ['Class rescheduled to 2pm', 'Lab session cancelled this week', 'Notes uploaded to e-learning', 'Group presentations next week', 'Make-up class on Saturday', 'Quiz on Tuesday', 'Field trip forms due', 'Marks for CAT 1 released']
  while (seeds.length < 40) {
    const lec = rng.pick(lecturers)
    const unit = unitById.get(rng.pick(lec.unitIds))!
    const t = rng.pick(lectureTitles)
    seeds.push({ sender: lec.uid, audience: { targetType: 'UNIT', targetId: unit.id }, category: t.includes('Quiz') || t.includes('CAT') ? 'EXAM' : 'ACADEMIC', priority: rng.chance(0.2) ? 'HIGH' : 'NORMAL', title: `${unit.code}: ${t}`, body: `${t}. Please check the unit page on the e-learning portal for details and reach out to your class rep with questions.`, label: `Lecturer ${unit.code.replace(' ', '')}`, audienceLabel: `${unit.code} – ${unit.name}` })
  }

  let dSeq = 1
  let smsSeq = 1
  seeds.forEach((seed, i) => {
    const sender = userById.get(seed.sender) ?? userById.get('u_registrar')!
    const sentAt = new Date(now.getTime() - (40 - i) * 0.75 * DAY - rng.int(0, 8) * 3600_000)
    const recipients = resolveAudience(seed.audience, { users: ds.users, groups: ds.savedGroups }, { excludeUid: sender.uid })
    const n: Notification = {
      id: `ntf_${String(i + 1).padStart(4, '0')}`,
      shortCode: seededShortCode(rng),
      title: seed.title,
      body: seed.body,
      category: seed.category,
      priority: seed.priority,
      senderId: sender.uid,
      senderName: sender.name,
      senderRole: sender.role,
      senderPosition: posOf(sender.uid)?.position ?? null,
      senderLabel: seed.label,
      audience: seed.audience,
      audienceLabel: seed.audienceLabel,
      attachment: null,
      allowSmsFallback: true,
      status: 'SENT',
      scheduledFor: null,
      ackTimeoutSeconds,
      counts: countDeliveries([]),
      createdAt: sentAt,
      updatedAt: sentAt,
      sentAt,
    }
    const ds2: Delivery[] = []
    for (const uid of recipients) {
      const r = userById.get(uid)!
      const d = newDelivery(`dlv_h${String(dSeq++).padStart(6, '0')}`, n, r, sentAt, ackTimeoutSeconds)
      d.pushedAt = sentAt
      const roll = rng.next()
      const ack = (secs: number) => new Date(sentAt.getTime() + secs * 1000)
      let status: DeliveryStatus
      if (roll < 0.78) {
        d.ackedAt = ack(rng.int(1, ackTimeoutSeconds - 5))
        d.ackChannel = rng.chance(0.7) ? 'IN_APP' : 'SERVICE_WORKER'
        d.ackDeviceId = `dev_${uid}`
        status = 'DELIVERED'
        if (rng.chance(0.7)) {
          d.readAt = new Date(d.ackedAt.getTime() + rng.int(60, 7200) * 1000)
          status = 'READ'
        }
      } else if (!r.phone || (r.smsOptOut && n.priority !== 'URGENT')) {
        status = 'SMS_SKIPPED'
        d.skipReason = r.phone ? 'Recipient opted out of SMS' : 'No phone number on file'
      } else {
        const failed = roll > 0.965 || r.phone === '+254700099999'
        const sms: SmsMessage = {
          id: `sms_h${String(smsSeq++).padStart(5, '0')}`,
          deliveryId: d.id,
          notificationId: n.id,
          userId: uid,
          to: r.phone,
          text: buildSmsText({ senderId: settings.smsSenderId, category: n.category, title: n.title, body: n.body, senderLabel: n.senderLabel, shortCode: n.shortCode }),
          senderId: settings.smsSenderId,
          status: failed ? 'FAILED' : 'DELIVERED',
          providerMessageId: failed ? null : `ATXid_${rng.int(100000, 999999)}`,
          costKes: failed ? 0 : settings.smsCostKes,
          attempt: failed ? 3 : 1,
          error: failed ? 'Provider rejected the number' : null,
          createdAt: ack(ackTimeoutSeconds + 2),
          deliveredAt: failed ? null : ack(ackTimeoutSeconds + rng.int(4, 30)),
        }
        ds.smsMessages.push(sms)
        d.smsId = sms.id
        d.smsAttempts = sms.attempt
        status = failed ? 'SMS_FAILED' : 'SMS_DELIVERED'
        if (!failed && rng.chance(0.3)) {
          d.ackedAt = ack(rng.int(ackTimeoutSeconds + 120, ackTimeoutSeconds + 3 * 3600))
          d.ackChannel = 'IN_APP'
          d.ackDeviceId = `dev_${uid}`
          status = 'DELIVERED_AFTER_SMS'
        }
      }
      d.status = status
      d.updatedAt = d.readAt ?? d.ackedAt ?? sentAt
      ds2.push(d)
    }
    n.counts = countDeliveries(ds2)
    ds.notifications.push(n)
    ds.deliveries.push(...ds2)
  })

}
