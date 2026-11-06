import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCheck,
  ChevronRight,
  Clock,
  Coins,
  Inbox,
  MessageSquareText,
  PenSquare,
  ScrollText,
  Send,
  Settings,
  Timer,
  Users,
  UserSearch,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAnalytics, useHierarchyIndex, useInbox, useMyUnits, useNodeDetails, useSendQuota, useSent } from '@/hooks/data'
import { canSendAtAll } from '@/core/permissions'
import { CategoryIcon, EmptyState, ListCard, ListSkeleton, Section, StatCard } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/primitives'
import { PullToRefresh } from '@/components/layout/PullToRefresh'
import { DeliveryBar } from '@/features/delivery/SentPage'
import { cn, formatKes, pct, shortDate, timeAgo } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const seeAll = (to: string, label = 'See all') => (
  <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
    {label} <ChevronRight className="size-4" />
  </Link>
)

// ───────── Students ─────────

function CatchUpCard() {
  const { profile } = useAuth()
  const { data, isPending } = useInbox(profile?.uid)
  if (isPending) return <Skeleton className="h-32 rounded-2xl" />
  const unread = (data ?? []).filter((d) => !d.readAt && !d.archivedAt)
  const next = unread[0]
  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-soft">
      <div aria-hidden className="absolute -right-12 -top-12 size-44 rounded-full bg-white/[0.06]" />
      <div aria-hidden className="absolute -bottom-20 right-10 size-36 rounded-full bg-gold/15" />
      <div className="relative">
        {unread.length ? (
          <>
            <p className="text-sm/5 opacity-85">You have</p>
            <p className="text-3xl font-semibold tracking-tight">
              {unread.length} unread {unread.length === 1 ? 'notice' : 'notices'}
            </p>
            {next && <p className="mt-1 line-clamp-1 text-sm opacity-85">Latest: {next.title}</p>}
            <Button asChild variant="gold" className="mt-4">
              <Link to="/inbox">
                <Inbox /> Open inbox
              </Link>
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-full bg-white/15" aria-hidden>
              <CheckCheck className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold">You're all caught up</p>
              <p className="text-sm opacity-85">New notices will appear here the moment they're sent.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NoticeList({ limit = 5 }: { limit?: number }) {
  const { profile } = useAuth()
  const { data, isPending } = useInbox(profile?.uid)
  const latest = (data ?? []).filter((d) => !d.archivedAt).slice(0, limit)
  if (isPending) return <ListSkeleton rows={3} />
  if (!latest.length) return <EmptyState icon={Inbox} title="No notices yet" description="Notices from your lecturers, department and student leaders appear here." />
  return (
    <ListCard label="Latest notices">
      {latest.map((d) => (
        <li key={d.id}>
          <Link to={`/notice/${d.notificationId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60">
            <CategoryIcon category={d.category} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm', d.readAt ? 'text-foreground/80' : 'font-semibold')}>{d.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {d.senderName} · {shortDate(d.createdAt)}
              </p>
            </div>
            {!d.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </Link>
        </li>
      ))}
    </ListCard>
  )
}

function UnitList() {
  const { profile } = useAuth()
  const { data, isPending } = useMyUnits(profile?.uid)
  if (isPending) return <Skeleton className="h-20 rounded-2xl" />
  if (!data?.units.length) return <p className="px-1 text-sm text-muted-foreground">No units this semester.</p>
  return (
    <ListCard label="Units">
      {data.units.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-4 py-3">
          <span className="w-20 shrink-0 font-mono text-xs font-semibold text-primary">{u.code}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
          {u.lecturers[0] && profile?.userType === 'STUDENT' && <span className="hidden truncate text-xs text-muted-foreground sm:block">{u.lecturers[0]}</span>}
        </li>
      ))}
    </ListCard>
  )
}

function LeaderCard() {
  const { claims, profile } = useAuth()
  const scope = claims?.scopes[0] ?? null
  const { data, isPending } = useNodeDetails(scope)
  const { data: quota } = useSendQuota(profile?.uid)
  const left = quota?.limit != null ? Math.max(0, quota.limit - quota.used) : null
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold-soft/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gold-foreground/80 dark:text-gold">Your group</p>
      {isPending ? <Skeleton className="mt-1 h-6 w-2/3" /> : <p className="mt-0.5 font-semibold leading-snug">{data?.title}</p>}
      <p className="mt-1 text-sm text-muted-foreground">
        {data ? `${data.stats.students.toLocaleString()} students` : '…'}
        {left !== null && ` · ${left} sends left today`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to="/compose">
            <PenSquare /> Compose
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/lookup">
            <UserSearch /> Look up a student
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ───────── Staff ─────────

const StatsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-[92px] rounded-2xl" />
    ))}
  </div>
)

function AnalyticsStats() {
  const { data } = useAnalytics(true)
  const t = data?.totals
  if (!t) return <StatsSkeleton />
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Delivered in-app" value={`${pct(t.inApp, t.deliveries)}%`} icon={CheckCheck} tone="green" hint={`${t.inApp.toLocaleString()} of ${t.deliveries.toLocaleString()}`} />
      <StatCard label="Reached by SMS" value={`${pct(t.sms, t.deliveries)}%`} icon={MessageSquareText} tone="purple" hint={`${t.sms.toLocaleString()} messages`} />
      <StatCard label="Avg. confirm time" value={t.avgAckSeconds !== null ? `${t.avgAckSeconds}s` : '—'} icon={Timer} hint="Device ACK" />
      <StatCard label="SMS cost" value={formatKes(t.smsCostKes)} icon={Coins} tone="gold" hint={`${t.notifications} notices`} />
    </div>
  )
}

/** Senders without analytics access (lecturers) see stats for their own notices. */
function MySendStats() {
  const { profile } = useAuth()
  const { data } = useSent(profile?.uid)
  const totals = useMemo(() => {
    const c = { n: 0, total: 0, inApp: 0, sms: 0, pending: 0 }
    for (const n of data ?? []) {
      if (n.status !== 'SENT') continue
      c.n++
      c.total += n.counts.total
      c.inApp += n.counts.delivered
      c.sms += n.counts.sms
      c.pending += n.counts.pending
    }
    return c
  }, [data])
  if (!data) return <StatsSkeleton />
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Notices sent" value={totals.n} icon={Send} hint={`${totals.total.toLocaleString()} recipients`} />
      <StatCard label="Delivered in-app" value={`${pct(totals.inApp, totals.total)}%`} icon={CheckCheck} tone="green" hint="Device confirmed" />
      <StatCard label="Reached by SMS" value={`${pct(totals.sms, totals.total)}%`} icon={MessageSquareText} tone="purple" hint="Fallback" />
      <StatCard label="Waiting now" value={totals.pending} icon={Clock} tone="amber" hint={totals.pending ? 'Counting down' : 'All settled'} />
    </div>
  )
}

function RecentSends() {
  const { profile } = useAuth()
  const { data, isPending } = useSent(profile?.uid)
  const recent = (data ?? []).slice(0, 5)
  if (isPending) return <ListSkeleton rows={3} />
  if (!recent.length)
    return (
      <EmptyState
        icon={Send}
        title="Nothing sent yet"
        action={
          <Button asChild size="sm">
            <Link to="/compose">Compose a notice</Link>
          </Button>
        }
      />
    )
  return (
    <ListCard label="Recent sends">
      {recent.map((n) => (
        <li key={n.id}>
          <Link to={`/sent/${n.id}`} className="block px-4 py-3 hover:bg-accent/60">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{n.title}</p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {n.counts.delivered + n.counts.sms}/{n.counts.total}
              </span>
            </div>
            <p className="mb-2 truncate text-xs text-muted-foreground">
              {n.audienceLabel} · {timeAgo(n.sentAt ?? n.createdAt)}
            </p>
            <DeliveryBar counts={n.counts} />
          </Link>
        </li>
      ))}
    </ListCard>
  )
}

function Shortcuts() {
  const { can } = useAuth()
  const links = [
    can('user.manage') && { to: '/admin/users', label: 'Users & roles', icon: Users },
    can('analytics.view') && { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    can('directory.view') && { to: '/explorer', label: 'Explorer', icon: BookOpen },
    can('sms_logs.view') && { to: '/admin/sms', label: 'SMS logs', icon: MessageSquareText },
    can('audit.view') && { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
    can('settings.manage') && { to: '/admin/settings', label: 'Settings', icon: Settings },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Users }[]
  if (!links.length) return null
  return (
    <ListCard label="Shortcuts">
      {links.map((l) => (
        <li key={l.to}>
          <Link to={l.to} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent/60">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <l.icon className="size-4" aria-hidden />
            </span>
            <span className="flex-1 font-medium">{l.label}</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ListCard>
  )
}

// ───────── Page ─────────

export function HomePage() {
  const { profile, claims, can, isLeader } = useAuth()
  const { data: inbox } = useInbox(profile?.uid)
  const h = useHierarchyIndex()
  const qc = useQueryClient()
  if (!profile || !claims) return null

  const sender = canSendAtAll(claims)
  const isStudent = profile.userType === 'STUDENT'
  const analytics = can('analytics.view')
  const isAdmin = can('user.manage')
  const firstName = profile.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/, '').split(' ')[0]
  const course = profile.courseId ? h?.courseById.get(profile.courseId) : undefined
  const subtitle = isStudent ? (course ? `${course.name} · Year ${profile.yearOfStudy}` : 'Student') : (profile.title ?? '')
  const hasInbox = (inbox ?? []).some((d) => !d.archivedAt)
  const showShortcuts = isAdmin || analytics || (!sender && can('directory.view'))

  return (
    <PullToRefresh onRefresh={() => qc.refetchQueries({ type: 'active' })}>
      <div className="space-y-6">
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {greeting()}, {firstName}
            </h1>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {sender && (
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/compose">
                <PenSquare /> Compose
              </Link>
            </Button>
          )}
        </header>

        {isStudent && !profile.phone && (
          <Link to="/profile" className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span className="flex-1">
              <span className="font-medium">Add your phone number</span> so urgent notices reach you by SMS when you're offline.
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}

        {isStudent ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
            <div className="min-w-0 space-y-6">
              <CatchUpCard />
              <Section title="Latest notices" action={seeAll('/inbox')}>
                <NoticeList />
              </Section>
            </div>
            <div className="min-w-0 space-y-6">
              {isLeader && <LeaderCard />}
              <Section title="This semester" action={seeAll('/units', 'Details')}>
                <UnitList />
              </Section>
            </div>
          </div>
        ) : (
          <>
            {analytics || isAdmin ? <AnalyticsStats /> : sender && <MySendStats />}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
              <div className="min-w-0 space-y-6">
                {sender && (
                  <Section title="Recent sends" action={seeAll('/sent')}>
                    <RecentSends />
                  </Section>
                )}
                {(!sender || hasInbox) && (
                  <Section title="Latest notices" action={seeAll('/inbox')}>
                    <NoticeList limit={4} />
                  </Section>
                )}
              </div>
              <div className="min-w-0 space-y-6">
                {profile.role === 'LECTURER' && (
                  <Section title="Units you teach">
                    <UnitList />
                  </Section>
                )}
                {showShortcuts && (
                  <Section title="Shortcuts">
                    <Shortcuts />
                  </Section>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
