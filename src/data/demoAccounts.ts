/** Demo sign-in accounts (kept separate so the login page doesn't load the data generator). */
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
