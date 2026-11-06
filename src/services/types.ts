import type {
  AppSettings,
  AuditLog,
  AudienceRule,
  Claims,
  Course,
  CourseUnit,
  Delivery,
  Device,
  Faculty,
  Institution,
  LeadershipPosition,
  Notification,
  PersonSummary,
  SavedGroup,
  School,
  Scope,
  SmsMessage,
  Unit,
  User,
  AckChannel,
  Category,
} from '@/types'
import type { AckResult } from '@/core/delivery/state'
import type { DraftInput, PositionInput, ProfileInput, SendNotificationInput, SettingsInput, UserInput } from '@/core/schemas'

/**
 * Service layer contract. The UI only ever talks to these interfaces (through hooks).
 * `mock/` implements them in memory now; `firebase/` implements them with the Firebase SDK in Phase 9.
 * Method names deliberately follow Firebase: onAuthStateChanged, subscribeTo* (= onSnapshot), callable functions.
 */

export type Unsubscribe = () => void

export interface AuthUser {
  uid: string
  email: string
  displayName: string
}

export interface AuthService {
  onAuthStateChanged(cb: (user: AuthUser | null) => void): Unsubscribe
  /** identifier = email, admission number or staff number. */
  signIn(identifier: string, password: string): Promise<AuthUser>
  signOut(): Promise<void>
  getIdTokenClaims(): Promise<Claims | null>
  readonly currentUser: AuthUser | null
}

export interface HierarchyData {
  institution: Institution
  schools: School[]
  faculties: Faculty[]
  courses: Course[]
  units: Unit[]
  courseUnits: CourseUnit[]
}

export interface MyUnitsData {
  course: Course | null
  yearOfStudy: number | null
  semester: number | null
  units: Array<Unit & { lecturers: string[] }>
}

export interface DirectoryService {
  getHierarchy(): Promise<HierarchyData>
  /** Own user document (full fields). */
  subscribeToProfile(uid: string, cb: (u: User | null) => void): Unsubscribe
  updateProfile(input: ProfileInput): Promise<void>
  completeOnboarding(): Promise<void>
  getMyUnits(): Promise<MyUnitsData>
  listMyPositions(): Promise<LeadershipPosition[]>
}

export interface NotificationService {
  /** The user's deliveries (= inbox), newest first. */
  subscribeToInbox(uid: string, cb: (items: Delivery[]) => void): Unsubscribe
  getNotice(notificationId: string): Promise<{ notification: Notification; delivery: Delivery | null }>
  findByShortCode(code: string): Promise<string | null>
  subscribeToSent(uid: string, cb: (items: Notification[]) => void): Unsubscribe
  subscribeToNotification(id: string, cb: (n: Notification | null) => void): Unsubscribe
  listDrafts(): Promise<Notification[]>
  saveDraft(input: DraftInput): Promise<string>
  deleteDraft(id: string): Promise<void>
  listSavedGroups(): Promise<SavedGroup[]>
  saveGroup(name: string, memberIds: string[]): Promise<string>
  deleteGroup(id: string): Promise<void>
  /** Mock upload now, Firebase Storage later. */
  uploadAttachment(file: File): Promise<{ name: string; size: number; contentType: string; url: string }>
}

export interface DeliveryService {
  ack(deliveryId: string, deviceId: string, channel: AckChannel): Promise<AckResult>
  markRead(deliveryId: string): Promise<void>
  archive(deliveryId: string, archived: boolean): Promise<void>
  /** Sender / admins only: live per-recipient statuses for one notice. */
  subscribeToNotificationDeliveries(notificationId: string, cb: (items: Delivery[]) => void): Unsubscribe
}

export interface SmsService {
  /** Demo only: every SMS "received" by demo phones. */
  subscribeToSmsInbox(cb: (items: SmsMessage[]) => void): Unsubscribe
  /** Admins: SMS log. */
  subscribeToSmsLogs(cb: (items: SmsMessage[]) => void): Unsubscribe
}

export interface AuditService {
  subscribeToAuditLogs(cb: (items: AuditLog[]) => void): Unsubscribe
}

export interface SettingsService {
  subscribeToSettings(cb: (s: AppSettings) => void): Unsubscribe
}

export interface DeviceService {
  getDeviceId(): string
  registerDevice(uid: string, opts: { notificationsEnabled: boolean; pushToken?: string | null }): Promise<void>
  subscribeToDevices(uid: string, cb: (items: Device[]) => void): Unsubscribe
  removeDevice(id: string): Promise<void>
}

export interface NodeDetails {
  scope: Scope
  title: string
  subtitle: string
  stats: { students: number; staff: number; units: number; courses: number }
  members: PersonSummary[]
  membersTruncated: boolean
}

export interface AnalyticsData {
  totals: {
    notifications: number
    deliveries: number
    inApp: number
    sms: number
    failed: number
    skipped: number
    pending: number
    avgAckSeconds: number | null
    smsCostKes: number
  }
  overTime: Array<{ date: string; inApp: number; sms: number; failed: number }>
  bySchool: Array<{ name: string; code: string; total: number; inApp: number; sms: number; failed: number }>
  byCourse: Array<{ name: string; code: string; total: number; inApp: number; sms: number }>
  byCategory: Array<{ category: Category; total: number }>
  recent: Notification[]
}

export interface LookupResult extends PersonSummary {
  courseName: string | null
  facultyName: string | null
  schoolName: string | null
  units: Array<{ code: string; name: string }>
}

/** Trusted server actions: Firebase Callable Cloud Functions in Phase 9. */
export interface Functions {
  sendNotification(input: SendNotificationInput): Promise<{ notificationId: string; recipientCount: number; scheduled: boolean }>
  previewAudience(audience: AudienceRule): Promise<{ count: number; label: string }>
  lookupStudent(input: { admissionNumber: string }): Promise<LookupResult>
  searchRecipients(input: { query: string }): Promise<PersonSummary[]>
  ackDelivery(input: { deliveryId: string; deviceId: string; channel: AckChannel }): Promise<{ result: AckResult }>
  getNodeDetails(input: { scope: Scope }): Promise<NodeDetails>
  getAnalytics(): Promise<AnalyticsData>
  resolveLoginIdentifier(input: { identifier: string }): Promise<{ email: string }>
  getSendQuota(): Promise<{ limit: number | null; used: number }>
  updateSettings(input: SettingsInput): Promise<void>
  adminListUsers(): Promise<User[]>
  adminSaveUser(input: UserInput): Promise<{ uid: string }>
  adminSetUserActive(input: { uid: string; isActive: boolean }): Promise<void>
  adminListPositions(): Promise<LeadershipPosition[]>
  adminAssignPosition(input: PositionInput): Promise<{ id: string }>
  adminEndPosition(input: { positionId: string }): Promise<void>
}

/** Demo-only controls (mock mode). */
export interface DemoControls {
  isSimulatingOffline(): boolean
  setSimulateOffline(on: boolean): void
  onSimulateOfflineChange(cb: (on: boolean) => void): Unsubscribe
  resetData(): Promise<void>
  isKeepData(): boolean
  setKeepData(on: boolean): Promise<void>
  setAckTimeout(seconds: number): Promise<void>
  isWorkerTab(): boolean
  onWorkerChange(cb: (isWorker: boolean) => void): Unsubscribe
}

export interface Services {
  auth: AuthService
  directory: DirectoryService
  notifications: NotificationService
  deliveries: DeliveryService
  sms: SmsService
  audit: AuditService
  settings: SettingsService
  devices: DeviceService
  functions: Functions
  demo: DemoControls | null
}

export type FunctionsErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'not-found'
  | 'resource-exhausted'
  | 'failed-precondition'
  | 'internal'

/** Same shape as Firebase `FunctionsError` / `HttpsError`. */
export class FunctionsError extends Error {
  constructor(
    public code: FunctionsErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'FunctionsError'
  }
}
