import { useEffect, useMemo, useState } from 'react'
import { Building2, GraduationCap, Layers, Library, Loader2, School, Search, UserRound, Users, BookOpen, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAudiencePreview, useHierarchyIndex, useSavedGroups } from '@/hooks/data'
import { getServices } from '@/services'
import { INSTITUTION_SCOPE } from '@/core/permissions'
import { TARGET_LABEL } from '@/core/labels'
import { Combobox } from '@/components/ui/combobox'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/primitives'
import { RoleBadge } from '@/components/common'
import { cn } from '@/lib/utils'
import type { AudienceRule, PersonSummary, TargetType } from '@/types'

const TARGET_ICON: Record<TargetType, typeof Users> = {
  INSTITUTION: Building2,
  SCHOOL: School,
  FACULTY: Library,
  COURSE: GraduationCap,
  COURSE_YEAR: Layers,
  UNIT: BookOpen,
  USER: UserRound,
  GROUP: Users,
}

/** Builds an AudienceRule, offering only targets inside the sender's scope. */
export function AudienceBuilder({ value, onChange, error }: { value: AudienceRule; onChange: (r: AudienceRule) => void; error?: string }) {
  const { can, claims, profile } = useAuth()
  const h = useHierarchyIndex()
  const { data: groups } = useSavedGroups(profile?.uid)

  const options = useMemo(() => {
    if (!h) return null
    const send = (type: TargetType, id: string, yearOfStudy?: number) =>
      can('notification.send', type === 'COURSE_YEAR' ? { type, id, yearOfStudy } : { type: type as Exclude<TargetType, 'GROUP'>, id })
    const years = (courseId: string) => {
      const c = h.courseById.get(courseId)
      return c ? Array.from({ length: Math.min(c.durationYears, 6) }, (_, i) => i + 1).filter((y) => send('COURSE_YEAR', courseId, y)) : []
    }
    return {
      institution: can('notification.send', INSTITUTION_SCOPE),
      schools: h.schools.filter((s) => send('SCHOOL', s.id)),
      faculties: h.faculties.filter((f) => send('FACULTY', f.id)),
      courses: h.courses.filter((c) => send('COURSE', c.id)),
      courseYears: h.courses.filter((c) => years(c.id).length > 0),
      years,
      units: h.units.filter((u) => send('UNIT', u.id)),
    }
  }, [h, can])

  const available: TargetType[] = useMemo(() => {
    if (!options) return []
    const t: TargetType[] = []
    if (options.institution) t.push('INSTITUTION')
    if (options.schools.length) t.push('SCHOOL')
    if (options.faculties.length) t.push('FACULTY')
    if (options.courses.length) t.push('COURSE')
    if (options.courseYears.length) t.push('COURSE_YEAR')
    if (options.units.length) t.push('UNIT')
    t.push('USER')
    if (groups?.length) t.push('GROUP')
    return t
  }, [options, groups])

  // Default to the narrowest sensible target
  useEffect(() => {
    if (!available.length || available.includes(value.targetType) && value.targetId) return
    if (available.includes(value.targetType)) return
    const first = available.find((t) => t !== 'USER') ?? 'USER'
    onChange({ targetType: first, targetId: '' })
  }, [available, value, onChange])

  // Auto-pick the only option (e.g. a class rep's one course+year, a lecturer's single unit)
  useEffect(() => {
    if (!options || value.targetId) return
    const only = <T extends { id: string }>(xs: T[]) => (xs.length === 1 ? xs[0].id : '')
    let id = ''
    if (value.targetType === 'INSTITUTION') id = INSTITUTION_SCOPE.id
    if (value.targetType === 'SCHOOL') id = only(options.schools)
    if (value.targetType === 'FACULTY') id = only(options.faculties)
    if (value.targetType === 'COURSE') id = only(options.courses)
    if (value.targetType === 'UNIT') id = only(options.units)
    if (value.targetType === 'COURSE_YEAR') {
      id = only(options.courseYears)
      if (id) {
        const ys = options.years(id)
        onChange({ ...value, targetId: id, yearOfStudy: ys.length === 1 ? ys[0] : value.yearOfStudy })
        return
      }
    }
    if (id) onChange({ ...value, targetId: id })
  }, [options, value, onChange])

  const preview = useAudiencePreview(value.targetId ? value : null)
  const isStaffSender = claims?.userType === 'STAFF'

  if (!options) return <div className="h-24 animate-pulse rounded-xl bg-muted" />

  const setType = (t: TargetType) => onChange({ targetType: t, targetId: t === 'INSTITUTION' ? INSTITUTION_SCOPE.id : '' })

  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="sr-only">Audience</legend>
      <div>
        <Label className="mb-2 block">Send to</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Target type">
          {available.map((t) => {
            const Icon = TARGET_ICON[t]
            const active = value.targetType === t
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setType(t)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  active && 'border-primary bg-primary-soft font-medium text-primary hover:bg-primary-soft',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="leading-tight">{TARGET_LABEL[t]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {value.targetType === 'INSTITUTION' && isStaffSender && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!value.includeStaff} onCheckedChange={(c) => onChange({ ...value, includeStaff: c === true })} />
          Also include staff
        </label>
      )}
      {value.targetType === 'SCHOOL' && (
        <div className="space-y-2">
          <Label htmlFor="aud-school">School</Label>
          <NativeSelect id="aud-school" value={value.targetId} onChange={(e) => onChange({ ...value, targetId: e.target.value })}>
            <option value="">Choose a school…</option>
            {options.schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          {isStaffSender && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!value.includeStaff} onCheckedChange={(c) => onChange({ ...value, includeStaff: c === true })} />
              Also include staff
            </label>
          )}
        </div>
      )}
      {value.targetType === 'FACULTY' && (
        <div className="space-y-2">
          <Label htmlFor="aud-fac">Faculty / Department</Label>
          <Combobox
            id="aud-fac"
            value={value.targetId}
            onChange={(id) => onChange({ ...value, targetId: id })}
            placeholder="Choose a department…"
            options={options.faculties.map((f) => ({ value: f.id, label: f.name, hint: h?.schoolById.get(f.schoolId)?.code }))}
          />
        </div>
      )}
      {value.targetType === 'COURSE' && (
        <div className="space-y-2">
          <Label htmlFor="aud-course">Course</Label>
          <Combobox id="aud-course" value={value.targetId} onChange={(id) => onChange({ ...value, targetId: id })} placeholder="Choose a course…" options={options.courses.map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
        </div>
      )}
      {value.targetType === 'COURSE_YEAR' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem]">
          <div className="space-y-2">
            <Label htmlFor="aud-cy">Course</Label>
            <Combobox id="aud-cy" value={value.targetId} onChange={(id) => onChange({ ...value, targetId: id, yearOfStudy: undefined })} placeholder="Choose a course…" options={options.courseYears.map((c) => ({ value: c.id, label: c.name, hint: c.code }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aud-year">Year of study</Label>
            <NativeSelect id="aud-year" value={value.yearOfStudy ?? ''} disabled={!value.targetId} onChange={(e) => onChange({ ...value, yearOfStudy: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Year…</option>
              {(value.targetId ? options.years(value.targetId) : []).map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}
      {value.targetType === 'UNIT' && (
        <div className="space-y-2">
          <Label htmlFor="aud-unit">Unit</Label>
          <Combobox id="aud-unit" value={value.targetId} onChange={(id) => onChange({ ...value, targetId: id })} placeholder="Choose a unit…" searchPlaceholder="Search by code or name" options={options.units.map((u) => ({ value: u.id, label: `${u.code} – ${u.name}` }))} />
        </div>
      )}
      {value.targetType === 'USER' && <PersonPicker value={value.targetId} onChange={(id) => onChange({ ...value, targetId: id })} />}
      {value.targetType === 'GROUP' && (
        <div className="space-y-2">
          <Label htmlFor="aud-group">Saved group</Label>
          <NativeSelect id="aud-group" value={value.targetId} onChange={(e) => onChange({ ...value, targetId: e.target.value })}>
            <option value="">Choose a group…</option>
            {groups?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberIds.length})
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      <div aria-live="polite" className="min-h-11">
        {value.targetId && (value.targetType !== 'COURSE_YEAR' || value.yearOfStudy) ? (
          preview.isFetching && !preview.data ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Counting recipients…
            </p>
          ) : preview.error ? (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {(preview.error as Error).message}
            </p>
          ) : preview.data ? (
            <p className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', preview.data.count ? 'border-primary/25 bg-primary-soft text-primary' : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300')}>
              <Users className="size-4 shrink-0" />
              <span>
                This will reach <strong className="tabular-nums">{preview.data.count.toLocaleString()}</strong> {preview.data.count === 1 ? 'person' : value.includeStaff ? 'people' : 'students'} · {preview.data.label}
              </span>
            </p>
          ) : null
        ) : (
          error && <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    </fieldset>
  )
}

function PersonPicker({ value, onChange }: { value: string; onChange: (uid: string) => void }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<PersonSummary | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])
  const { data, isFetching } = useQuery({
    queryKey: ['recipients', debounced],
    queryFn: () => getServices().functions.searchRecipients({ query: debounced }),
    enabled: debounced.trim().length >= 2,
  })
  return (
    <div className="space-y-2">
      <Label htmlFor="aud-person">Find a person</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="aud-person" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, admission or staff number" className="pl-9" autoComplete="off" />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {picked && value === picked.uid && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm">
          <UserRound className="size-4 text-primary" />
          <span className="font-medium">{picked.name}</span>
          <span className="text-muted-foreground">{picked.admissionNumber ?? picked.staffNumber}</span>
        </div>
      )}
      {debounced.length >= 2 && data && (
        <ul className="max-h-60 divide-y overflow-y-auto rounded-lg border" role="listbox" aria-label="Matching people">
          {data.length === 0 && <li className="p-3 text-sm text-muted-foreground">No one in your scope matches.</li>}
          {data.map((p) => (
            <li key={p.uid}>
              <button
                type="button"
                role="option"
                aria-selected={value === p.uid}
                onClick={() => {
                  setPicked(p)
                  onChange(p.uid)
                  setQ('')
                  setDebounced('')
                }}
                className="flex w-full items-center gap-3 p-2.5 text-left text-sm hover:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.admissionNumber ?? p.staffNumber}</span>
                </span>
                <RoleBadge role={p.role} userType={p.userType} positions={p.positions} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
