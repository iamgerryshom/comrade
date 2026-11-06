import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, m, useMotionValue, useTransform } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, ArchiveRestore, CheckCheck, ExternalLink, Inbox, MailOpen, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useArchive, useHierarchyIndex, useInbox, useMarkRead } from '@/hooks/data'
import { useLongPress } from '@/hooks/useLongPress'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { haptic } from '@/lib/push'
import { Dialog, DialogContent, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { PullToRefresh } from '@/components/layout/PullToRefresh'
import { useIsTabletUp } from '@/hooks/useMediaQuery'
import { CategoryIcon, EmptyState, ListSkeleton, PageHeader, PriorityBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input, Label, NativeSelect, Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { CATEGORIES, type Category, type Delivery } from '@/types'
import { CATEGORY_LABEL } from '@/core/labels'
import { cn, shortDate } from '@/lib/utils'
import { NoticeDetail } from './NoticeDetail'

const PAGE = 20

interface RowProps {
  d: Delivery
  active: boolean
  swipeable: boolean
  onOpen: () => void
  onRead: () => void
  onArchive: () => void
  onMenu: () => void
}

/** Inbox row: tap to open; on touch screens swipe right = mark read, swipe left = archive, long-press = actions. */
function InboxRow({ d, active, swipeable, onOpen, onRead, onArchive, onMenu }: RowProps) {
  const unread = !d.readAt
  const x = useMotionValue(0)
  const readOpacity = useTransform(x, [0, 40, 90], [0, 0.6, 1])
  const archiveOpacity = useTransform(x, [-90, -40, 0], [1, 0.6, 0])
  const dragged = useRef(false)
  const lp = useLongPress(onMenu)
  return (
    <m.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="relative overflow-hidden bg-muted">
      {swipeable && (
        <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-medium" aria-hidden>
          <m.span style={{ opacity: readOpacity }} className="flex items-center gap-2 text-primary">
            <MailOpen className="size-5" /> {unread ? 'Read' : 'Already read'}
          </m.span>
          <m.span style={{ opacity: archiveOpacity }} className="flex items-center gap-2 text-amber-600">
            {d.archivedAt ? 'Unarchive' : 'Archive'} <Archive className="size-5" />
          </m.span>
        </div>
      )}
      <m.div
        drag={swipeable ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 50)
          if (info.offset.x > 90 && unread) {
            haptic('success')
            onRead()
          } else if (info.offset.x < -90) {
            haptic('success')
            onArchive()
          }
        }}
        className="relative"
      >
        <button
          type="button"
          onClick={() => {
            if (dragged.current || lp.consumed()) return
            onOpen()
          }}
          {...lp.handlers}
          className={cn(
            'relative flex w-full select-none items-start gap-3 bg-card px-4 py-3.5 text-left transition-colors [-webkit-touch-callout:none] sm:hover:bg-accent/60',
            active && 'bg-primary-soft/60 sm:hover:bg-primary-soft/60',
            d.priority === 'URGENT' && unread && 'before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-full before:bg-red-500',
          )}
          aria-current={active ? 'true' : undefined}
        >
          <CategoryIcon category={d.category} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p className={cn('line-clamp-2 flex-1 text-sm', unread ? 'font-semibold' : 'text-foreground/80')}>{d.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{shortDate(d.createdAt)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="truncate text-xs text-muted-foreground">{d.senderName}</p>
              <PriorityBadge priority={d.priority} />
              {unread && <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            </div>
          </div>
        </button>
      </m.div>
    </m.li>
  )
}

export function InboxPage() {
  const { profile } = useAuth()
  const { data, isPending: isLoading } = useInbox(profile?.uid)
  const h = useHierarchyIndex()
  const markRead = useMarkRead(profile?.uid)
  const tabletUp = useIsTabletUp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selected = params.get('n')
  const [view, setView] = useState<'all' | 'unread' | 'archived'>('all')
  const [category, setCategory] = useState<Category | ''>('')
  const [unit, setUnit] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  const units = useMemo(() => {
    const ids = new Set((data ?? []).map((d) => d.unitId).filter((x): x is string => !!x))
    return [...ids].map((id) => h?.unitById.get(id)).filter((u) => !!u)
  }, [data, h])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter((d) => {
      if (view === 'archived' ? !d.archivedAt : d.archivedAt) return false
      if (view === 'unread' && d.readAt) return false
      if (category && d.category !== category) return false
      if (unit && d.unitId !== unit) return false
      if (term && !`${d.title} ${d.senderName}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [data, view, category, unit, q])

  const unreadCount = (data ?? []).filter((d) => !d.readAt && !d.archivedAt).length
  const activeFilters = (category ? 1 : 0) + (unit ? 1 : 0)

  // Infinite scroll
  useEffect(() => setLimit(PAGE), [view, category, unit, q])
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered.length])

  const open = (d: Delivery) => {
    if (tabletUp) setParams((p) => { p.set('n', d.notificationId); return p }, { replace: true })
    else navigate(`/notice/${d.notificationId}`)
  }

  const archive = useArchive(profile?.uid)
  const qc = useQueryClient()
  const touch = useMediaQuery('(pointer: coarse)')
  const [menuFor, setMenuFor] = useState<Delivery | null>(null)
  const doArchive = (d: Delivery) => {
    archive.mutate({ id: d.id, archived: !d.archivedAt })
    toast(d.archivedAt ? 'Moved back to inbox' : 'Archived', {
      action: { label: 'Undo', onClick: () => archive.mutate({ id: d.id, archived: !!d.archivedAt }) },
    })
  }
  const markAll = () => (data ?? []).filter((d) => !d.readAt && !d.archivedAt).forEach((d) => markRead.mutate(d.id))

  const list = (
    <div className="min-w-0">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notices" className="rounded-xl bg-muted/50 pl-9" aria-label="Search notices" />
            {q && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground" onClick={() => setQ('')} aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative shrink-0 rounded-xl" aria-label="Filters">
                <SlidersHorizontal />
                {activeFilters > 0 && <span className="absolute -right-1 -top-1 size-4 rounded-full bg-primary text-[10px] font-semibold leading-4 text-primary-foreground">{activeFilters}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-cat">Category</Label>
                <NativeSelect id="f-cat" value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
                  <option value="">All categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-unit">Unit</Label>
                <NativeSelect id="f-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="">All units</option>
                  {units.map((u) => (
                    <option key={u!.id} value={u!.id}>
                      {u!.code} – {u!.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList className="grid w-full grid-cols-3 rounded-xl sm:inline-grid sm:w-auto">
            <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
            <TabsTrigger value="unread" className="rounded-lg">
              Unread{unreadCount ? ` · ${unreadCount}` : ''}
            </TabsTrigger>
            <TabsTrigger value="archived" className="rounded-lg">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
        {activeFilters > 0 && (
          <div className="flex flex-wrap gap-2">
            {category && (
              <button type="button" onClick={() => setCategory('')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-xs font-medium text-primary">
                {CATEGORY_LABEL[category]} <X className="size-3.5" aria-label="Remove filter" />
              </button>
            )}
            {unit && (
              <button type="button" onClick={() => setUnit('')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-xs font-medium text-primary">
                {h?.unitById.get(unit)?.code} <X className="size-3.5" aria-label="Remove filter" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={view === 'archived' ? Archive : Inbox}
            title={data?.length ? 'No notices match' : 'No notices yet'}
            description={data?.length ? 'Try a different filter or search.' : 'Notices from your lecturers, department and student leaders will appear here.'}
          />
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft" aria-label="Notices">
              <AnimatePresence initial={false}>
                {filtered.slice(0, limit).map((d) => (
                  <InboxRow
                    key={d.id}
                    d={d}
                    active={selected === d.notificationId}
                    swipeable={touch}
                    onOpen={() => open(d)}
                    onRead={() => markRead.mutate(d.id)}
                    onArchive={() => doArchive(d)}
                    onMenu={() => setMenuFor(d)}
                  />
                ))}
              </AnimatePresence>
            </ul>
            {limit < filtered.length && <div ref={sentinel} className="h-10" aria-hidden />}
            <p className="py-4 text-center text-xs text-muted-foreground">
              Showing {Math.min(limit, filtered.length)} of {filtered.length}
            </p>
          </>
        )}
      </div>
    </div>
  )

  return (
    <PullToRefresh onRefresh={() => qc.refetchQueries({ type: 'active' })}>
      <PageHeader
        title="Inbox"
        icon={Inbox}
        description={unreadCount ? `${unreadCount} unread notice${unreadCount === 1 ? '' : 's'}` : "You're all caught up"}
        actions={
          unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} aria-label="Mark all as read">
              <CheckCheck /> <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )
        }
      />
      {tabletUp ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,26rem)_1fr]">
          {list}
          <div className="min-w-0">
            <div className="sticky top-20 rounded-xl border bg-card p-5 shadow-soft">
              {selected ? <NoticeDetail key={selected} notificationId={selected} compact /> : <EmptyState icon={MailOpen} title="Select a notice" description="Choose a notice on the left to read it here." />}
            </div>
          </div>
        </div>
      ) : (
        list
      )}
      <Dialog open={!!menuFor} onOpenChange={(o) => !o && setMenuFor(null)}>
        <DialogContent title={menuFor?.title ?? 'Notice'} description={menuFor ? `From ${menuFor.senderName}` : undefined}>
          {menuFor && (
            <div className="grid gap-2">
              <Button variant="outline" className="h-12 justify-start" onClick={() => { setMenuFor(null); open(menuFor) }}>
                <ExternalLink /> Open
              </Button>
              {!menuFor.readAt && (
                <Button variant="outline" className="h-12 justify-start" onClick={() => { markRead.mutate(menuFor.id); haptic('success'); setMenuFor(null) }}>
                  <MailOpen /> Mark as read
                </Button>
              )}
              <Button variant="outline" className="h-12 justify-start" onClick={() => { doArchive(menuFor); setMenuFor(null) }}>
                {menuFor.archivedAt ? <ArchiveRestore /> : <Archive />} {menuFor.archivedAt ? 'Move back to inbox' : 'Archive'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PullToRefresh>
  )
}
