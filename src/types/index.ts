/**
 * Comrade data model. Every interface here maps 1:1 to a Firestore document.
 * Collection names are in `COLLECTIONS`. Timestamps are JS `Date`s (the Firebase
 * implementation converts Firestore `Timestamp` → `Date` at the boundary).
 */

export const COLLECTIONS = [
  'institutions',
  'schools',
  'faculties',
  'courses',
  'units',
  'courseUnits',
  'users',
  'devices',
  'leadershipPositions',
  'enrollments',
  'unitAssignments',
  'notifications',
  'deliveries',
  'smsMessages',
  'savedGroups',
  'auditLogs',
  'settings',
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

// ───────────────────────── Hierarchy ─────────────────────────

export interface Institution {
  id: string
  name: string
  code: string
}

export interface School {
  id: string
  institutionId: string
  name: string
  code: string
  sourceUrl: string
  verified: boolean
}

/** "Faculty / Department" level. Kisii University calls these Departments. */
export interface Faculty {
  id: string
  institutionId: string
  schoolId: string
  name: string
  verified: boolean
}

export type CourseLevel = 'CERTIFICATE' | 'DIPLOMA' | 'UNDERGRADUATE' | 'MASTERS' | 'PHD'

export interface Course {
  id: string
  institutionId: string
  schoolId: string
  facultyId: string
  name: string
  code: string
  level: CourseLevel
  durationYears: number
  verified: boolean
}

export interface Unit {
  id: string
  code: string
  name: string
  /** Owning department; a unit may still be offered to several courses (see CourseUnit). */
  schoolId: string
  facultyId: string
  demo: boolean
}

export interface CourseUnit {
  id: string
  courseId: string
  unitId: string
  yearOfStudy: number
  semester: 1 | 2
}

// ───────────────────────── People ─────────────────────────

export type UserType = 'STAFF' | 'STUDENT'
export type StaffRole = 'SUPER_ADMIN' | 'INSTITUTION_ADMIN' | 'SCHOOL_DEAN' | 'HOD' | 'LECTURER' | 'STAFF'
export type Role = StaffRole | 'STUDENT'
export const STAFF_ROLES: StaffRole[] = ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'SCHOOL_DEAN', 'HOD', 'LECTURER', 'STAFF']

export type StudentStatus = 'ACTIVE' | 'DEFERRED' | 'GRADUATED' | 'SUSPENDED'

export interface User {
  uid: string
  name: string
  email: string
  /** Kenyan E.164 (+2547XXXXXXXX / +2541XXXXXXXX) or null. Private field. */
  phone: string | null
  userType: UserType
  role: Role
  photoURL: string | null
  isActive: boolean
  smsOptOut: boolean
  // Denormalised for fast audience queries
  schoolId: string | null
  facultyId: string | null
  courseId: string | null
  yearOfStudy: number | null
  /** Students: units enrolled this semester. Lecturers: units taught (mirrors unitAssignments). */
  unitIds: string[]
  // Student fields
  admissionNumber?: string
  intakeYear?: number
  semester?: 1 | 2
  status?: StudentStatus
  // Staff fields
  staffNumber?: string
  title?: string
  onboardedAt?: Date | null
  createdAt: Date
}

export type PositionType = 'CLASS_REP' | 'FACULTY_REP' | 'SCHOOL_REP' | 'STUDENT_PRESIDENT' | 'STUDENT_OFFICIAL'

export interface LeadershipPosition {
  id: string
  userId: string
  position: PositionType
  /** Human title, e.g. "Secretary General". */
  title: string
  scopeType: 'INSTITUTION' | 'SCHOOL' | 'FACULTY' | 'COURSE_YEAR'
  scopeId: string
  yearOfStudy?: number
  /** Optional: a class rep may also represent one unit. */
  unitId?: string
  startDate: Date
  endDate: Date
  isActive: boolean
}

export interface Enrollment {
  id: string
  userId: string
  unitId: string
  courseId: string
  academicYear: string // "2026/2027"
  semester: 1 | 2
}

export interface UnitAssignment {
  id: string
  userId: string
  unitId: string
  academicYear: string
}

/** users/{uid}/devices/{deviceId}: stored flat with userId in the mock. */
export interface Device {
  id: string
  userId: string
  kind: 'WEB'
  browser: string
  label: string
  pushToken: string | null
  notificationsEnabled: boolean
  lastSeenAt: Date
  createdAt: Date
}

// ───────────────────────── Scopes & claims ─────────────────────────

export type ScopeType = 'INSTITUTION' | 'SCHOOL' | 'FACULTY' | 'COURSE' | 'COURSE_YEAR' | 'UNIT' | 'USER'

export interface Scope {
  type: ScopeType
  id: string
  /** Only for COURSE_YEAR. */
  yearOfStudy?: number
}

/** Shape of Firebase Auth custom claims: `{ role, userType, scopes }`. */
export interface Claims {
  role: Role
  userType: UserType
  /** Scopes the user may act in (send / look up / explore). */
  scopes: Scope[]
  /** Active leadership positions (students only). */
  positions: PositionType[]
  /** For STAFF general: read-only scope. */
  readScopes: Scope[]
}

// ───────────────────────── Notifications ─────────────────────────

export const CATEGORIES = ['ACADEMIC', 'EXAM', 'FINANCE', 'EVENT', 'EMERGENCY', 'GENERAL'] as const
export type Category = (typeof CATEGORIES)[number]
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export type Priority = (typeof PRIORITIES)[number]

export type TargetType = 'INSTITUTION' | 'SCHOOL' | 'FACULTY' | 'COURSE' | 'COURSE_YEAR' | 'UNIT' | 'USER' | 'GROUP'

export interface AudienceRule {
  targetType: TargetType
  targetId: string
  yearOfStudy?: number
  /** Also include staff attached to the scope (institution/school/faculty only). */
  includeStaff?: boolean
}

export interface Attachment {
  name: string
  size: number
  contentType: string
  /** Mock: object URL / data URL. Firebase: Storage download URL. */
  url: string
}

export type NotificationStatus = 'DRAFT' | 'SCHEDULED' | 'SENT'

export interface DeliveryCounts {
  total: number
  pending: number
  delivered: number
  read: number
  sms: number
  failed: number
  skipped: number
}

export interface Notification {
  id: string
  shortCode: string
  title: string
  body: string
  category: Category
  priority: Priority
  senderId: string
  senderName: string
  senderRole: Role
  senderPosition: PositionType | null
  /** Short label used in SMS "From:" e.g. "Lecturer COMP210". */
  senderLabel: string
  audience: AudienceRule
  audienceLabel: string
  attachment: Attachment | null
  allowSmsFallback: boolean
  status: NotificationStatus
  scheduledFor: Date | null
  ackTimeoutSeconds: number
  counts: DeliveryCounts
  createdAt: Date
  updatedAt: Date
  sentAt: Date | null
}

export const DELIVERY_STATUSES = [
  'PENDING',
  'PUSHED',
  'DELIVERED',
  'READ',
  'SMS_QUEUED',
  'SMS_SENT',
  'SMS_DELIVERED',
  'SMS_FAILED',
  'DELIVERED_AFTER_SMS',
  'SMS_SKIPPED',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]
export type AckChannel = 'IN_APP' | 'SERVICE_WORKER' | 'WEB_PUSH'

export interface Delivery {
  id: string
  notificationId: string
  userId: string
  recipientName: string
  /** Denormalised so security rules can let the sender read their timeline without a get(). */
  senderId: string
  status: DeliveryStatus
  // Denormalised so the inbox is a single query on `deliveries`
  title: string
  category: Category
  priority: Priority
  senderName: string
  unitId: string | null
  createdAt: Date
  ackDeadline: Date
  pushedAt: Date | null
  ackedAt: Date | null
  ackChannel: AckChannel | null
  ackDeviceId: string | null
  readAt: Date | null
  archivedAt: Date | null
  smsId: string | null
  smsAttempts: number
  nextSmsAttemptAt: Date | null
  skipReason: string | null
  updatedAt: Date
}

export type SmsStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'

export interface SmsMessage {
  id: string
  deliveryId: string | null
  notificationId: string | null
  userId: string | null
  to: string
  text: string
  senderId: string
  status: SmsStatus
  providerMessageId: string | null
  costKes: number
  attempt: number
  error: string | null
  createdAt: Date
  deliveredAt: Date | null
}

export interface SavedGroup {
  id: string
  ownerId: string
  name: string
  memberIds: string[]
  createdAt: Date
}

export interface AuditLog {
  id: string
  actorId: string
  actorName: string
  actorRole: Role
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  scope: Scope | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface AppSettings {
  id: 'app'
  ackTimeoutSeconds: number
  /** Notifications per day for student senders, by position. */
  rateLimits: Record<PositionType, number>
  smsSenderId: string
  smsCostKes: number
  updatedAt: Date
}

// ───────────────────────── Read models returned by callable functions ─────────────────────────

/** A user as another user is allowed to see them. Phone may be masked or absent. */
export interface PersonSummary {
  uid: string
  name: string
  userType: UserType
  role: Role
  positions: PositionType[]
  photoURL: string | null
  admissionNumber?: string
  staffNumber?: string
  title?: string
  courseId: string | null
  facultyId: string | null
  schoolId: string | null
  yearOfStudy: number | null
  phone: string | null
  phoneVisibility: 'FULL' | 'MASKED' | 'HIDDEN'
  email: string | null
  isActive: boolean
}
