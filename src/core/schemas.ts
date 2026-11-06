import { z } from 'zod'
import { CATEGORIES, PRIORITIES } from '@/types'
import { KENYAN_E164 } from './phone'

/** Zod schemas shared by forms, the mock callable functions, and (Phase 9) Cloud Functions. */

export const phoneSchema = z.string().regex(KENYAN_E164, 'Use Kenyan format +2547XXXXXXXX or +2541XXXXXXXX')

export const audienceSchema = z
  .object({
    targetType: z.enum(['INSTITUTION', 'SCHOOL', 'FACULTY', 'COURSE', 'COURSE_YEAR', 'UNIT', 'USER', 'GROUP']),
    targetId: z.string().min(1, 'Choose who should receive this'),
    yearOfStudy: z.number().int().min(1).max(6).optional(),
    includeStaff: z.boolean().optional(),
  })
  .refine((a) => a.targetType !== 'COURSE_YEAR' || a.yearOfStudy !== undefined, {
    message: 'Choose a year of study',
    path: ['yearOfStudy'],
  })

export const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024, 'Max 10 MB'),
  contentType: z.string(),
  url: z.string(),
})

export const notificationContentSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(1, 'Write a message').max(4000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  audience: audienceSchema,
  allowSmsFallback: z.boolean(),
  attachment: attachmentSchema.nullable().optional(),
  scheduledFor: z.date().nullable().optional(),
})

export const sendNotificationInput = notificationContentSchema.extend({
  draftId: z.string().optional(),
})
export type SendNotificationInput = z.infer<typeof sendNotificationInput>

export const draftInput = notificationContentSchema.partial().extend({ id: z.string().optional() })
export type DraftInput = z.infer<typeof draftInput>

export const lookupStudentInput = z.object({
  admissionNumber: z.string().trim().min(3, 'Enter an admission number').max(40),
})

export const ackInput = z.object({
  deliveryId: z.string().min(1),
  deviceId: z.string().min(1),
  channel: z.enum(['IN_APP', 'SERVICE_WORKER', 'WEB_PUSH']),
})

export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema.nullable(),
  smsOptOut: z.boolean(),
})
export type ProfileInput = z.infer<typeof profileInput>

export const userInput = z.object({
  uid: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  phone: phoneSchema.nullable(),
  userType: z.enum(['STAFF', 'STUDENT']),
  role: z.enum(['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'SCHOOL_DEAN', 'HOD', 'LECTURER', 'STAFF', 'STUDENT']),
  schoolId: z.string().nullable(),
  facultyId: z.string().nullable(),
  courseId: z.string().nullable(),
  yearOfStudy: z.number().int().min(1).max(6).nullable(),
  admissionNumber: z.string().optional(),
  staffNumber: z.string().optional(),
  title: z.string().optional(),
})
export type UserInput = z.infer<typeof userInput>

export const positionInput = z.object({
  userId: z.string().min(1),
  position: z.enum(['CLASS_REP', 'FACULTY_REP', 'SCHOOL_REP', 'STUDENT_PRESIDENT', 'STUDENT_OFFICIAL']),
  title: z.string().trim().min(2).max(60),
  scopeType: z.enum(['INSTITUTION', 'SCHOOL', 'FACULTY', 'COURSE_YEAR']),
  scopeId: z.string().min(1),
  yearOfStudy: z.number().int().min(1).max(6).optional(),
  unitId: z.string().optional(),
  startDate: z.date(),
  endDate: z.date(),
})
export type PositionInput = z.infer<typeof positionInput>

export const settingsInput = z.object({
  ackTimeoutSeconds: z.number().int().min(5).max(3600),
  rateLimits: z.object({
    CLASS_REP: z.number().int().min(0).max(1000),
    FACULTY_REP: z.number().int().min(0).max(1000),
    SCHOOL_REP: z.number().int().min(0).max(1000),
    STUDENT_PRESIDENT: z.number().int().min(0).max(1000),
    STUDENT_OFFICIAL: z.number().int().min(0).max(1000),
  }),
  smsSenderId: z.string().trim().min(3).max(11),
  smsCostKes: z.number().min(0).max(50),
})
export type SettingsInput = z.infer<typeof settingsInput>
