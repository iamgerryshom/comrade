import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Ban, CheckCircle2, CirclePlus, Crown, Pencil, Star, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAdminMutations, useAdminPositions, useAdminUsers, useHierarchyIndex } from '@/hooks/data'
import { DataTable } from '@/components/DataTable'
import { PageHeader, RoleBadge, UserAvatar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/overlays'
import { Badge, FieldError, Input, Label, NativeSelect, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { Combobox } from '@/components/ui/combobox'
import { POSITION_LABEL, ROLE_LABEL } from '@/core/labels'
import { normalizeKenyanPhone } from '@/core/phone'
import { INSTITUTION_ID, isPositionActive } from '@/core/permissions'
import { errorMessage, shortDate } from '@/lib/utils'
import type { LeadershipPosition, PositionType, Role, User } from '@/types'

const userForm = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  email: z.email('Enter a valid email'),
  phone: z.string().refine((p) => !p.trim() || normalizeKenyanPhone(p) !== null, 'Use a Kenyan number like 0712 345 678'),
  userType: z.enum(['STAFF', 'STUDENT']),
  role: z.enum(['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'SCHOOL_DEAN', 'HOD', 'LECTURER', 'STAFF', 'STUDENT']),
  schoolId: z.string(),
  facultyId: z.string(),
  courseId: z.string(),
  yearOfStudy: z.string(),
  admissionNumber: z.string(),
  staffNumber: z.string(),
  title: z.string(),
})
type UserForm = z.infer<typeof userForm>

function UserEditor({ user, onDone }: { user: User | null; onDone: () => void }) {
  const h = useHierarchyIndex()
  const { profile } = useAuth()
  const { saveUser } = useAdminMutations()
  const { register, handleSubmit, control, formState, setValue } = useForm<UserForm>({
    resolver: zodResolver(userForm),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      userType: user?.userType ?? 'STUDENT',
      role: user?.role ?? 'STUDENT',
      schoolId: user?.schoolId ?? '',
      facultyId: user?.facultyId ?? '',
      courseId: user?.courseId ?? '',
      yearOfStudy: user?.yearOfStudy ? String(user.yearOfStudy) : '1',
      admissionNumber: user?.admissionNumber ?? '',
      staffNumber: user?.staffNumber ?? '',
      title: user?.title ?? '',
    },
  })
  const v = useWatch({ control })
  const isStudent = v.userType === 'STUDENT'
  const course = v.courseId ? h?.courseById.get(v.courseId) : undefined

  const submit = async (f: UserForm) => {
    try {
      await saveUser.mutateAsync({
        uid: user?.uid,
        name: f.name,
        email: f.email,
        phone: f.phone.trim() ? normalizeKenyanPhone(f.phone) : null,
        userType: f.userType,
        role: isStudent ? 'STUDENT' : f.role,
        schoolId: f.schoolId || null,
        facultyId: f.facultyId || null,
        courseId: isStudent ? f.courseId || null : null,
        yearOfStudy: isStudent ? Number(f.yearOfStudy) : null,
        admissionNumber: isStudent ? f.admissionNumber || undefined : undefined,
        staffNumber: !isStudent ? f.staffNumber || undefined : undefined,
        title: f.title || undefined,
      })
      toast.success(user ? 'User updated' : 'User created')
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="u-name">Full name</Label>
          <Input id="u-name" {...register('name')} aria-invalid={!!formState.errors.name} />
          <FieldError>{formState.errors.name?.message}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-email">Email</Label>
          <Input id="u-email" type="email" {...register('email')} aria-invalid={!!formState.errors.email} />
          <FieldError>{formState.errors.email?.message}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-phone">Phone (for SMS fallback)</Label>
          <Input id="u-phone" type="tel" placeholder="+2547XXXXXXXX" {...register('phone')} aria-invalid={!!formState.errors.phone} />
          <FieldError>{formState.errors.phone?.message}</FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-type">User type</Label>
          <NativeSelect id="u-type" {...register('userType', { onChange: (e) => setValue('role', e.target.value === 'STUDENT' ? 'STUDENT' : 'LECTURER') })}>
            <option value="STUDENT">Student</option>
            <option value="STAFF">Staff</option>
          </NativeSelect>
        </div>
        {!isStudent && (
          <div className="space-y-2">
            <Label htmlFor="u-role">Role</Label>
            <NativeSelect id="u-role" {...register('role')}>
              {(['LECTURER', 'HOD', 'SCHOOL_DEAN', 'STAFF', 'INSTITUTION_ADMIN', 'SUPER_ADMIN'] as Role[]).map((r) => (
                <option key={r} value={r} disabled={r === 'SUPER_ADMIN' && profile?.role !== 'SUPER_ADMIN'}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        {isStudent ? (
          <>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="u-course">Course</Label>
              <Combobox id="u-course" value={v.courseId ?? ''} onChange={(id) => setValue('courseId', id)} placeholder="Choose a course…" options={(h?.courses ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-year">Year of study</Label>
              <NativeSelect id="u-year" {...register('yearOfStudy')}>
                {Array.from({ length: Math.min(course?.durationYears ?? 5, 6) }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Year {i + 1}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-adm">Admission number</Label>
              <Input id="u-adm" className="font-mono" placeholder="BSCS/0123/2025" {...register('admissionNumber')} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="u-school">School</Label>
              <NativeSelect id="u-school" {...register('schoolId')}>
                <option value="">—</option>
                {h?.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-fac">Faculty / Department</Label>
              <NativeSelect id="u-fac" {...register('facultyId')}>
                <option value="">—</option>
                {h?.faculties
                  .filter((f) => !v.schoolId || f.schoolId === v.schoolId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-staffno">Staff number</Label>
              <Input id="u-staffno" className="font-mono" {...register('staffNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-title">Title</Label>
              <Input id="u-title" placeholder="e.g. Senior Lecturer" {...register('title')} />
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          {user ? 'Save changes' : 'Create user'}
        </Button>
      </div>
    </form>
  )
}

const positionForm = z.object({
  position: z.enum(['CLASS_REP', 'FACULTY_REP', 'SCHOOL_REP', 'STUDENT_PRESIDENT', 'STUDENT_OFFICIAL']),
  title: z.string().trim().min(2, 'Enter a title'),
  scopeId: z.string(),
  yearOfStudy: z.string(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

function AssignPosition({ student, onDone }: { student: User; onDone: () => void }) {
  const h = useHierarchyIndex()
  const { assignPosition } = useAdminMutations()
  const today = new Date().toISOString().slice(0, 10)
  const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
  const { register, handleSubmit, control, setValue, formState } = useForm<z.infer<typeof positionForm>>({
    resolver: zodResolver(positionForm),
    defaultValues: { position: 'CLASS_REP', title: 'Class Rep', scopeId: student.courseId ?? '', yearOfStudy: String(student.yearOfStudy ?? 1), startDate: today, endDate: nextYear },
  })
  const v = useWatch({ control })
  const scopeType = v.position === 'CLASS_REP' ? 'COURSE_YEAR' : v.position === 'FACULTY_REP' ? 'FACULTY' : v.position === 'SCHOOL_REP' ? 'SCHOOL' : 'INSTITUTION'
  const submit = async (f: z.infer<typeof positionForm>) => {
    try {
      await assignPosition.mutateAsync({
        userId: student.uid,
        position: f.position,
        title: f.title,
        scopeType,
        scopeId: scopeType === 'INSTITUTION' ? INSTITUTION_ID : f.scopeId,
        yearOfStudy: scopeType === 'COURSE_YEAR' ? Number(f.yearOfStudy) : undefined,
        startDate: new Date(f.startDate),
        endDate: new Date(f.endDate),
      })
      toast.success(`${POSITION_LABEL[f.position]} assigned to ${student.name}`)
      onDone()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-pos">Position</Label>
          <NativeSelect
            id="p-pos"
            {...register('position', {
              onChange: (e) => {
                const p = e.target.value as PositionType
                setValue('title', POSITION_LABEL[p])
                setValue('scopeId', p === 'CLASS_REP' ? (student.courseId ?? '') : p === 'FACULTY_REP' ? (student.facultyId ?? '') : p === 'SCHOOL_REP' ? (student.schoolId ?? '') : INSTITUTION_ID)
              },
            })}
          >
            {(Object.keys(POSITION_LABEL) as PositionType[]).map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-title">Title</Label>
          <Input id="p-title" {...register('title')} />
          <FieldError>{formState.errors.title?.message}</FieldError>
        </div>
        {scopeType === 'COURSE_YEAR' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="p-course">Course</Label>
              <Combobox id="p-course" value={v.scopeId ?? ''} onChange={(id) => setValue('scopeId', id)} options={(h?.courses ?? []).map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-year">Year</Label>
              <NativeSelect id="p-year" {...register('yearOfStudy')}>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        )}
        {scopeType === 'FACULTY' && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-fac">Faculty / Department</Label>
            <Combobox id="p-fac" value={v.scopeId ?? ''} onChange={(id) => setValue('scopeId', id)} options={(h?.faculties ?? []).map((f) => ({ value: f.id, label: f.name }))} />
          </div>
        )}
        {scopeType === 'SCHOOL' && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-school">School</Label>
            <NativeSelect id="p-school" {...register('scopeId')}>
              {h?.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="p-start">Start</Label>
          <Input id="p-start" type="date" {...register('startDate')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-end">End of term</Label>
          <Input id="p-end" type="date" {...register('endDate')} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The position grants rights only between these dates. Ended positions stay in the history.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={formState.isSubmitting}>
          Assign position
        </Button>
      </div>
    </form>
  )
}

export function UsersPage() {
  const { can, profile } = useAuth()
  const enabled = can('user.manage')
  const { data: users, isLoading } = useAdminUsers(enabled)
  const { data: positions, isLoading: loadingPos } = useAdminPositions(can('role.assign'))
  const { setActive, endPosition } = useAdminMutations()
  const h = useHierarchyIndex()
  const [editing, setEditing] = useState<User | null | 'new'>(null)
  const [assigning, setAssigning] = useState<User | null>(null)
  const [typeFilter, setTypeFilter] = useState<'' | 'STAFF' | 'STUDENT' | 'LEADER'>('')
  const usersById = useMemo(() => new Map((users ?? []).map((u) => [u.uid, u])), [users])
  const leaderIds = useMemo(() => new Set((positions ?? []).filter((p) => isPositionActive(p, new Date())).map((p) => p.userId)), [positions])
  const activePositions = (uid: string) => (positions ?? []).filter((p) => p.userId === uid && isPositionActive(p, new Date())).map((p) => p.position)

  const filtered = (users ?? []).filter((u) => (typeFilter === 'LEADER' ? leaderIds.has(u.uid) : !typeFilter || u.userType === typeFilter))
  const scopeName = (p: LeadershipPosition) =>
    p.scopeType === 'INSTITUTION' ? 'Whole university' : p.scopeType === 'SCHOOL' ? h?.schoolById.get(p.scopeId)?.name : p.scopeType === 'FACULTY' ? h?.facultyById.get(p.scopeId)?.name : `${h?.courseById.get(p.scopeId)?.code ?? ''} Year ${p.yearOfStudy}`

  const toggleActive = async (u: User) => {
    try {
      await setActive.mutateAsync({ uid: u.uid, isActive: !u.isActive })
      toast.success(u.isActive ? `${u.name} deactivated` : `${u.name} reactivated`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & roles"
        icon={Users}
        description={`${users?.length ?? '…'} accounts · ${leaderIds.size} active student leaders`}
        actions={
          <Button onClick={() => setEditing('new')}>
            <UserPlus /> New user
          </Button>
        }
      />
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">
            <Users /> Users
          </TabsTrigger>
          <TabsTrigger value="positions">
            <Crown /> Leadership positions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <DataTable
            rows={filtered}
            loading={isLoading}
            rowKey={(u) => u.uid}
            searchText={(u) => `${u.name} ${u.email} ${u.admissionNumber ?? ''} ${u.staffNumber ?? ''}`}
            initialSort={{ key: 'name', dir: 'asc' }}
            toolbar={
              <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="Filter by type" className="w-40">
                <option value="">Everyone</option>
                <option value="STUDENT">Students</option>
                <option value="LEADER">Student leaders</option>
                <option value="STAFF">Staff</option>
              </NativeSelect>
            }
            columns={[
              {
                key: 'name',
                header: 'Name',
                sortValue: (u) => u.name,
                cell: (u) => (
                  <span className="flex items-center gap-3">
                    <UserAvatar name={u.name} userType={u.userType} leader={leaderIds.has(u.uid)} className="size-8" />
                    <span className="min-w-0">
                      <span className="block font-medium">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </span>
                ),
              },
              { key: 'role', header: 'Role', sortValue: (u) => u.role, cell: (u) => <RoleBadge role={u.role} userType={u.userType} positions={activePositions(u.uid)} /> },
              { key: 'id', header: 'Number', sortValue: (u) => u.admissionNumber ?? u.staffNumber ?? '', cell: (u) => <span className="font-mono text-xs">{u.admissionNumber ?? u.staffNumber}</span> },
              {
                key: 'where',
                header: 'Course / Department',
                cell: (u) => <span className="line-clamp-1 max-w-56 text-xs text-muted-foreground">{u.courseId ? `${h?.courseById.get(u.courseId)?.code} · Y${u.yearOfStudy}` : (h?.facultyById.get(u.facultyId ?? '')?.name ?? h?.schoolById.get(u.schoolId ?? '')?.code ?? '—')}</span>,
              },
              { key: 'status', header: 'Status', sortValue: (u) => (u.isActive ? 1 : 0), cell: (u) => (u.isActive ? <Badge className="border-green-500/30 text-green-700 dark:text-green-300">Active</Badge> : <Badge className="border-red-500/30 text-red-600">Inactive</Badge>) },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                cell: (u) => (
                  <span className="flex justify-end gap-1">
                    {u.userType === 'STUDENT' && (
                      <Button size="icon-sm" variant="ghost" onClick={() => setAssigning(u)} aria-label={`Assign a position to ${u.name}`}>
                        <Star />
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" disabled={u.uid === profile?.uid} onClick={() => void toggleActive(u)} aria-label={u.isActive ? `Deactivate ${u.name}` : `Activate ${u.name}`}>
                      {u.isActive ? <Ban /> : <CheckCircle2 />}
                    </Button>
                  </span>
                ),
              },
            ]}
            mobileCard={(u) => (
              <div className="flex items-start gap-3">
                <UserAvatar name={u.name} userType={u.userType} leader={leaderIds.has(u.uid)} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{u.admissionNumber ?? u.staffNumber}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <RoleBadge role={u.role} userType={u.userType} positions={activePositions(u.uid)} />
                    {!u.isActive && <Badge className="border-red-500/30 text-red-600">Inactive</Badge>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                      <Pencil /> Edit
                    </Button>
                    {u.userType === 'STUDENT' && (
                      <Button size="sm" variant="outline" onClick={() => setAssigning(u)}>
                        <Star /> Position
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={u.uid === profile?.uid} onClick={() => void toggleActive(u)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          />
        </TabsContent>
        <TabsContent value="positions">
          <DataTable
            rows={positions}
            loading={loadingPos}
            rowKey={(p) => p.id}
            searchText={(p) => `${usersById.get(p.userId)?.name ?? ''} ${p.title}`}
            initialSort={{ key: 'start', dir: 'desc' }}
            columns={[
              { key: 'who', header: 'Student', sortValue: (p) => usersById.get(p.userId)?.name ?? '', cell: (p) => <span className="font-medium">{usersById.get(p.userId)?.name ?? p.userId}</span> },
              { key: 'pos', header: 'Position', sortValue: (p) => p.position, cell: (p) => <span>{p.title}</span> },
              { key: 'scope', header: 'Scope', cell: (p) => <span className="text-xs text-muted-foreground">{scopeName(p)}</span> },
              { key: 'start', header: 'Term', sortValue: (p) => p.startDate.getTime(), cell: (p) => <span className="text-xs">{shortDate(p.startDate)} – {shortDate(p.endDate)}</span> },
              {
                key: 'state',
                header: 'State',
                cell: (p) =>
                  isPositionActive(p, new Date()) ? <Badge className="border-green-500/30 text-green-700 dark:text-green-300">Active</Badge> : <Badge className="text-muted-foreground">Ended</Badge>,
              },
              {
                key: 'end',
                header: '',
                className: 'text-right',
                cell: (p) =>
                  isPositionActive(p, new Date()) && (
                    <Button size="sm" variant="ghost" onClick={() => void endPosition.mutateAsync(p.id).then(() => toast.success('Position ended'), (e) => toast.error(errorMessage(e)))}>
                      End now
                    </Button>
                  ),
              },
            ]}
            mobileCard={(p) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{usersById.get(p.userId)?.name}</p>
                  {isPositionActive(p, new Date()) ? <Badge className="border-green-500/30 text-green-700">Active</Badge> : <Badge>Ended</Badge>}
                </div>
                <p className="text-sm">{p.title}</p>
                <p className="text-xs text-muted-foreground">{scopeName(p)} · {shortDate(p.startDate)} – {shortDate(p.endDate)}</p>
              </div>
            )}
            toolbar={
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CirclePlus className="size-3.5" /> Assign from the Users tab (★)
              </p>
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === 'new' ? 'New user' : 'Edit user'} description="Changes apply immediately and are audited.">
          {editing !== null && <UserEditor user={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent title="Assign leadership position" description={assigning?.name}>
          {assigning && <AssignPosition student={assigning} onDone={() => setAssigning(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
