import type { Category, DeliveryStatus, PositionType, Priority, Role, TargetType } from '@/types'

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  INSTITUTION_ADMIN: 'Institution Admin',
  SCHOOL_DEAN: 'School Dean',
  HOD: 'Head of Department',
  LECTURER: 'Lecturer',
  STAFF: 'Staff',
  STUDENT: 'Student',
}

export const POSITION_LABEL: Record<PositionType, string> = {
  CLASS_REP: 'Class Rep',
  FACULTY_REP: 'Faculty Rep',
  SCHOOL_REP: 'School Rep',
  STUDENT_PRESIDENT: 'Student President',
  STUDENT_OFFICIAL: 'Student Official',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  ACADEMIC: 'Academic',
  EXAM: 'Exam',
  FINANCE: 'Finance',
  EVENT: 'Event',
  EMERGENCY: 'Emergency',
  GENERAL: 'General',
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
}

export const TARGET_LABEL: Record<TargetType, string> = {
  INSTITUTION: 'Whole university',
  SCHOOL: 'School',
  FACULTY: 'Faculty / Department',
  COURSE: 'Course',
  COURSE_YEAR: 'Course + year',
  UNIT: 'Unit',
  USER: 'One person',
  GROUP: 'Saved group',
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  PENDING: 'Pending',
  PUSHED: 'Pushed',
  DELIVERED: 'Delivered',
  READ: 'Read',
  SMS_QUEUED: 'SMS queued',
  SMS_SENT: 'Sent via SMS',
  SMS_DELIVERED: 'SMS delivered',
  SMS_FAILED: 'Failed',
  DELIVERED_AFTER_SMS: 'Delivered after SMS',
  SMS_SKIPPED: 'SMS skipped',
}

export const LEVEL_LABEL = {
  CERTIFICATE: 'Certificate',
  DIPLOMA: 'Diploma',
  UNDERGRADUATE: 'Undergraduate',
  MASTERS: 'Masters',
  PHD: 'PhD',
} as const
