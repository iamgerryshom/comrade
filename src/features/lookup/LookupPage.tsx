import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, GraduationCap, Library, Mail, PenSquare, Phone, ScrollText, Search, ShieldAlert, UserSearch } from 'lucide-react'
import { motion } from 'framer-motion'
import { lookupStudentInput } from '@/core/schemas'
import { useLookupStudent } from '@/hooks/data'
import { useAuth } from '@/features/auth/AuthProvider'
import { EmptyState, PageHeader, RoleBadge, UserAvatar } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent, FieldError, Input, Label } from '@/components/ui/primitives'
import type { LookupResult } from '@/services'

export function LookupPage() {
  const { isLeader } = useAuth()
  const lookup = useLookupStudent()
  const [recent, setRecent] = useState<LookupResult[]>([])
  const { register, handleSubmit, formState } = useForm<{ admissionNumber: string }>({ resolver: zodResolver(lookupStudentInput) })
  const r = lookup.data

  const submit = async ({ admissionNumber }: { admissionNumber: string }) => {
    try {
      const res = await lookup.mutateAsync(admissionNumber)
      setRecent((x) => [res, ...x.filter((y) => y.uid !== res.uid)].slice(0, 5))
    } catch {
      /* shown below */
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Student lookup" icon={UserSearch} description="Find a student in your scope by admission number." />
      <Card className="p-4 sm:p-5">
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1 space-y-2">
            <Label htmlFor="adm">Admission number</Label>
            <Input id="adm" placeholder="e.g. BSCS/0123/2025" autoComplete="off" className="font-mono uppercase" aria-invalid={!!formState.errors.admissionNumber} {...register('admissionNumber')} />
            <FieldError>{formState.errors.admissionNumber?.message}</FieldError>
          </div>
          <Button type="submit" loading={lookup.isPending}>
            <Search /> Search
          </Button>
        </form>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScrollText className="size-3.5" /> Every search is recorded in the audit log.{isLeader ? ' Student leaders see masked phone numbers.' : ''}
        </p>
      </Card>

      <div className="mt-6">
        {lookup.error ? (
          <EmptyState icon={ShieldAlert} title="No result" description={(lookup.error as Error).message} />
        ) : r ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center">
                <UserAvatar name={r.name} userType={r.userType} leader={r.positions.length > 0} className="size-14 text-base" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold">{r.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm">{r.admissionNumber}</span>
                    <RoleBadge role={r.role} userType={r.userType} positions={r.positions} />
                    {!r.isActive && <Badge className="border-red-500/30 text-red-600">Inactive</Badge>}
                  </div>
                </div>
                <Button asChild variant="outline">
                  <Link to="/compose">
                    <PenSquare /> Message
                  </Link>
                </Button>
              </div>
              <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                <Info icon={GraduationCap} label="Course" value={`${r.courseName ?? '—'}${r.yearOfStudy ? ` · Year ${r.yearOfStudy}` : ''}`} />
                <Info icon={Library} label="Faculty / Department" value={r.facultyName ?? '—'} />
                <Info icon={Building2} label="School" value={r.schoolName ?? '—'} />
                <Info
                  icon={Phone}
                  label={`Phone${r.phoneVisibility === 'MASKED' ? ' (masked)' : ''}`}
                  value={r.phone ? <span className="font-mono">{r.phone}</span> : r.phoneVisibility === 'HIDDEN' ? 'Hidden' : 'Not on file'}
                />
                {r.email && <Info icon={Mail} label="Email" value={r.email} />}
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs text-muted-foreground">Units this semester</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.units.map((u) => (
                      <span key={u.code} className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
                        <span className="font-mono font-semibold">{u.code}</span> {u.name}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <EmptyState icon={UserSearch} title="Search for a student" description="Results only include students inside your scope." />
        )}
      </div>

      {recent.length > 1 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Recent searches</h3>
          <ul className="flex flex-wrap gap-2">
            {recent.map((x) => (
              <li key={x.uid} className="rounded-full border px-3 py-1 text-sm">
                {x.name} <span className="font-mono text-xs text-muted-foreground">{x.admissionNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm">{value}</p>
      </div>
    </div>
  )
}
