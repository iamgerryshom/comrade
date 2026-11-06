import { Link } from 'react-router'
import { BookOpen, Building2, GraduationCap, Library, UserRound } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useHierarchyIndex, useInbox, useMyUnits } from '@/hooks/data'
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/primitives'
import { LEVEL_LABEL } from '@/core/labels'

export function MyUnitsPage() {
  const { profile } = useAuth()
  const { data, isLoading } = useMyUnits(profile?.uid)
  const { data: inbox } = useInbox(profile?.uid)
  const h = useHierarchyIndex()
  if (isLoading || !data) return <PageSkeleton />
  const course = data.course
  const faculty = course ? h?.facultyById.get(course.facultyId) : undefined
  const school = course ? h?.schoolById.get(course.schoolId) : undefined
  const noticeCount = (unitId: string) => (inbox ?? []).filter((d) => d.unitId === unitId).length

  return (
    <div>
      <PageHeader title="My course & units" icon={BookOpen} description={`Semester ${data.semester ?? '—'} · Year ${data.yearOfStudy ?? '—'}`} />
      {course && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-primary/30 bg-primary-soft text-primary">{course.code}</Badge>
              <Badge>{LEVEL_LABEL[course.level]}</Badge>
              <Badge>{course.durationYears} years</Badge>
            </div>
            <CardTitle className="mt-2 text-lg">{course.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Library className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Faculty / Department</dt>
                  <dd>{faculty?.name ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">School</dt>
                  <dd>{school?.name ?? '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <GraduationCap className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Institution</dt>
                  <dd>{h?.institution.name ?? 'Kisii University'}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Units this semester</h2>
      {data.units.length === 0 ? (
        <EmptyState icon={BookOpen} title="No units yet" description="Your units will show here once you're enrolled for the semester." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.units.map((u) => (
            <li key={u.id}>
              <Card className="h-full p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-primary-soft px-2 py-1 font-mono text-xs font-semibold text-primary">{u.code}</span>
                  {u.demo && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">demo unit</span>}
                </div>
                <p className="mt-2 font-medium">{u.name}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <UserRound className="size-4" /> {u.lecturers.length ? u.lecturers.join(', ') : 'Lecturer to be assigned'}
                </p>
                {noticeCount(u.id) > 0 && (
                  <Link to="/inbox" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                    {noticeCount(u.id)} notice{noticeCount(u.id) === 1 ? '' : 's'} for this unit
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
