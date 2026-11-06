import { useMemo, useState } from 'react'
import { BookOpen, Building2, ChevronRight, GraduationCap, Layers, Library, Lock, School as SchoolIcon, Users, UserRound, Phone } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/features/auth/AuthProvider'
import { useHierarchyIndex, useNodeDetails } from '@/hooks/data'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { EmptyState, ListSkeleton, PageHeader, PageSkeleton, RoleBadge, StatCard, UserAvatar } from '@/components/common'
import { Dialog, DialogContent } from '@/components/ui/overlays'
import { Card, Input } from '@/components/ui/primitives'
import { INSTITUTION_SCOPE } from '@/core/permissions'
import { scopeKey } from '@/core/hierarchy'
import { cn } from '@/lib/utils'
import type { Scope } from '@/types'

interface TreeNode {
  scope: Scope
  label: string
  sub?: string
  icon: typeof Users
  children?: () => TreeNode[]
}

function NodeDetailsPanel({ scope }: { scope: Scope }) {
  const { data, isLoading, error } = useNodeDetails(scope)
  const [q, setQ] = useState('')
  if (isLoading) return <PageSkeleton />
  if (error || !data) return <EmptyState icon={Lock} title="Outside your scope" description={(error as Error)?.message} />
  const members = data.members.filter((m) => !q || `${m.name} ${m.admissionNumber ?? ''} ${m.staffNumber ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{data.subtitle}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{data.title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Students" value={data.stats.students.toLocaleString()} icon={GraduationCap} />
        <StatCard label="Staff" value={data.stats.staff} icon={UserRound} tone="gold" />
        <StatCard label="Courses" value={data.stats.courses} icon={Layers} tone="purple" />
        <StatCard label="Units" value={data.stats.units.toLocaleString()} icon={BookOpen} tone="green" />
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Members</h3>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter members" className="h-9 max-w-48" aria-label="Filter members" />
      </div>
      <ul className="mt-3 divide-y rounded-xl border">
        {members.length === 0 && <li className="p-4 text-sm text-muted-foreground">No members.</li>}
        {members.map((m) => (
          <li key={m.uid} className="flex items-center gap-3 p-3">
            <UserAvatar name={m.name} userType={m.userType} leader={m.positions.length > 0} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {m.admissionNumber ?? m.staffNumber}
                {m.yearOfStudy ? ` · Year ${m.yearOfStudy}` : ''}
                {m.phone && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Phone className="size-3" /> {m.phone}
                  </span>
                )}
              </p>
            </div>
            <RoleBadge role={m.role} userType={m.userType} positions={m.positions} className="hidden sm:inline-flex" />
          </li>
        ))}
      </ul>
      {data.membersTruncated && <p className="mt-2 text-xs text-muted-foreground">Showing the first {data.members.length} members.</p>}
    </div>
  )
}

export function ExplorerPage() {
  const h = useHierarchyIndex()
  const { can } = useAuth()
  const isDesktop = useIsDesktop()
  const [selected, setSelected] = useState<Scope | null>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set(['INSTITUTION:ksu']))
  const [filter, setFilter] = useState('')

  const tree = useMemo<TreeNode | null>(() => {
    if (!h) return null
    const unitsOf = (courseId: string, year: number) =>
      [...new Set(h.courseUnits.filter((cu) => cu.courseId === courseId && cu.yearOfStudy === year).map((cu) => cu.unitId))]
        .map((id) => h.unitById.get(id)!)
        .map((u): TreeNode => ({ scope: { type: 'UNIT', id: u.id }, label: `${u.code} – ${u.name}`, icon: BookOpen }))
    return {
      scope: INSTITUTION_SCOPE,
      label: h.institution.name,
      icon: Building2,
      children: () =>
        h.schools.map((s) => ({
          scope: { type: 'SCHOOL', id: s.id },
          label: s.name,
          sub: s.code,
          icon: SchoolIcon,
          children: () =>
            h.faculties
              .filter((f) => f.schoolId === s.id)
              .map((f) => ({
                scope: { type: 'FACULTY', id: f.id },
                label: f.name,
                icon: Library,
                children: () =>
                  h.courses
                    .filter((c) => c.facultyId === f.id)
                    .map((c) => ({
                      scope: { type: 'COURSE', id: c.id },
                      label: c.name,
                      sub: c.code,
                      icon: GraduationCap,
                      children: () =>
                        Array.from({ length: Math.min(c.durationYears, 6) }, (_, i) => i + 1).map((y) => ({
                          scope: { type: 'COURSE_YEAR', id: c.id, yearOfStudy: y },
                          label: `Year ${y}`,
                          icon: Layers,
                          children: () => unitsOf(c.id, y),
                        })),
                    })),
              })),
        })),
    }
  }, [h])

  // A node is shown if the user may view it or anything beneath it
  const visibility = useMemo(() => {
    const memo = new Map<string, { self: boolean; any: boolean }>()
    const visit = (n: TreeNode): boolean => {
      const self = can('directory.view', n.scope)
      // Below a viewable node everything is viewable: no need to walk it
      const any = self || (n.children?.().some(visit) ?? false)
      memo.set(scopeKey(n.scope), { self, any })
      return any
    }
    if (tree) visit(tree)
    return memo
  }, [tree, can])

  if (!tree) return <PageSkeleton />
  const term = filter.trim().toLowerCase()

  const toggle = (k: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const renderNode = (n: TreeNode, depth: number, parentViewable: boolean): React.ReactNode => {
    const k = scopeKey(n.scope)
    const v = visibility.get(k)
    const viewable = parentViewable || !!v?.self
    if (!parentViewable && !v?.any) return null
    const kids = n.children?.()
    const isOpen = open.has(k) || (!!term && depth < 3)
    if (term && depth >= 2 && !n.label.toLowerCase().includes(term) && !(n.sub ?? '').toLowerCase().includes(term) && n.scope.type !== 'COURSE_YEAR' && n.scope.type !== 'UNIT') {
      // When filtering, hide courses/faculties that don't match (schools stay as context)
      if (n.scope.type === 'COURSE') return null
    }
    const active = selected && scopeKey(selected) === k
    return (
      <li key={k} role="treeitem" aria-expanded={kids?.length ? isOpen : undefined} aria-selected={!!active}>
        <div className={cn('flex items-center rounded-lg', active && 'bg-primary-soft')} style={{ paddingLeft: depth * 14 }}>
          {kids?.length ? (
            <button type="button" onClick={() => toggle(k)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={isOpen ? `Collapse ${n.label}` : `Expand ${n.label}`}>
              <ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} />
            </button>
          ) : (
            <span className="inline-block size-8 shrink-0" />
          )}
          <button
            type="button"
            disabled={!viewable}
            onClick={() => setSelected(n.scope)}
            className={cn('flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent', active && 'font-medium text-primary')}
          >
            <n.icon className="size-4 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{n.label}</span>
            {n.sub && <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{n.sub}</span>}
            {!viewable && <Lock className="ml-auto size-3 shrink-0" aria-label="Outside your scope" />}
          </button>
        </div>
        {kids?.length && isOpen ? (
          <ul role="group">{kids.map((c) => renderNode(c, depth + 1, viewable))}</ul>
        ) : null}
      </li>
    )
  }

  return (
    <div>
      <PageHeader title="Explorer" icon={Layers} description="Institution → School → Faculty / Department → Course → Unit. You see what's inside your scope." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <Card className="p-2 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <div className="p-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter courses…" aria-label="Filter the tree" />
          </div>
          <ul role="tree" aria-label="University structure" className="pb-2">
            {renderNode(tree, 0, false)}
          </ul>
        </Card>
        {isDesktop ? (
          <Card className="min-w-0 p-5">
            <AnimatePresence mode="wait">
              <motion.div key={selected ? scopeKey(selected) : 'none'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {selected ? <NodeDetailsPanel scope={selected} /> : <EmptyState icon={Layers} title="Select a node" description="Pick a school, department, course or unit to see its numbers and members." />}
              </motion.div>
            </AnimatePresence>
          </Card>
        ) : (
          <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
            <DialogContent title="Details">{selected ? <NodeDetailsPanel scope={selected} /> : <ListSkeleton />}</DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
