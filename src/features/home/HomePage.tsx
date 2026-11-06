import { Link } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  Clock,
  Coins,
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
import { useAnalytics, useInbox, useMyUnits, useNodeDetails, useSendQuota, useSent, useSettings } from '@/hooks/data'
import { canSendAtAll } from '@/core/permissions'
import { CategoryIcon, EmptyState, ListSkeleton, RoleBadge, StatCard } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives'
import { formatKes, pct, shortDate, timeAgo } from '@/lib/utils'
import { DeliveryBar } from '@/features/delivery/SentPage'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function LatestNotices() {
  const { profile } = useAuth()
  const { data, isLoading } = useInbox(profile?.uid)
  const latest = (data ?? []).filter((d) => !d.archivedAt).slice(0, 5)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Latest notices</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/inbox">
            View all <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : latest.length === 0 ? (
          <EmptyState icon={Bell} title="No notices yet" />
        ) : (
          <ul className="divide-y">
            {latest.map((d) => (
              <li key={d.id}>
                <Link to={`/notice/${d.notificationId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent">
                  <CategoryIcon category={d.category} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${d.readAt ? '' : 'font-semibold'}`}>{d.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.senderName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{shortDate(d.createdAt)}</span>
                  {!d.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MyUnitsCard() {
  const { profile } = useAuth()
  const { data, isLoading } = useMyUnits(profile?.uid)
  const isLecturer = profile?.role === 'LECTURER'
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{isLecturer ? 'Units you teach' : 'My units this semester'}</CardTitle>
        {!isLecturer && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/units">
              Details <ArrowRight />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : !data?.units.length ? (
          <p className="text-sm text-muted-foreground">No units this semester.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.units.map((u) => (
              <li key={u.id} className="rounded-lg border bg-muted/40 px-2.5 py-1.5 text-sm">
                <span className="font-mono text-xs font-semibold text-primary">{u.code}</span> <span className="text-muted-foreground">{u.name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RecentSends() {
  const { profile } = useAuth()
  const { data, isLoading } = useSent(profile?.uid)
  const recent = (data ?? []).slice(0, 4)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Recent sends</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sent">
            All sent <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : recent.length === 0 ? (
          <EmptyState icon={Send} title="You haven't sent anything yet" action={<Button asChild size="sm"><Link to="/compose">Compose</Link></Button>} />
        ) : (
          <ul className="space-y-3">
            {recent.map((n) => (
              <li key={n.id}>
                <Link to={`/sent/${n.id}`} className="-mx-2 block rounded-lg px-2 py-1.5 hover:bg-accent">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.sentAt ?? n.createdAt)}</span>
                  </div>
                  <p className="mb-1.5 truncate text-xs text-muted-foreground">{n.audienceLabel}</p>
                  <DeliveryBar counts={n.counts} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function AnalyticsSummary() {
  const { data } = useAnalytics(true)
  const t = data?.totals
  if (!t)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Delivered in-app" value={`${pct(t.inApp, t.deliveries)}%`} icon={CheckCheck} tone="green" hint={`${t.inApp.toLocaleString()} of ${t.deliveries.toLocaleString()}`} />
      <StatCard label="Reached by SMS" value={`${pct(t.sms, t.deliveries)}%`} icon={MessageSquareText} tone="purple" hint={`${t.sms.toLocaleString()} messages`} />
      <StatCard label="Avg. device ACK" value={t.avgAckSeconds !== null ? `${t.avgAckSeconds}s` : '—'} icon={Timer} hint="Time to confirm receipt" />
      <StatCard label="SMS cost" value={formatKes(t.smsCostKes)} icon={Coins} tone="gold" hint={`${t.notifications} notices`} />
    </div>
  )
}

function LeaderGroupCard() {
  const { claims } = useAuth()
  const scope = claims?.scopes[0] ?? null
  const { data, isLoading } = useNodeDetails(scope)
  const { data: quota } = useSendQuota(claims ? 'me' : undefined)
  return (
    <Card className="border-gold/40 bg-gradient-to-br from-gold-soft/60 to-card">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Your group</CardTitle>
        {isLoading ? <Skeleton className="h-6 w-2/3" /> : <p className="text-lg font-semibold leading-snug">{data?.title}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{data?.stats.students.toLocaleString() ?? '…'}</p>
            <p className="text-xs text-muted-foreground">students</p>
          </div>
          {quota?.limit != null && (
            <div>
              <p className="text-2xl font-semibold tabular-nums">{Math.max(0, quota.limit - quota.used)}</p>
              <p className="text-xs text-muted-foreground">sends left today</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/compose">
              <PenSquare /> Quick compose
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/lookup">
              <UserSearch /> Look up a student
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminLinks() {
  const { can } = useAuth()
  const { data: settings } = useSettings()
  const links = [
    can('user.manage') && { to: '/admin/users', label: 'Users & roles', icon: Users },
    can('sms_logs.view') && { to: '/admin/sms', label: 'SMS logs', icon: MessageSquareText },
    can('audit.view') && { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
    can('settings.manage') && { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Users }[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>System</CardTitle>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" /> SMS fallback after <strong className="text-foreground">{settings?.ackTimeoutSeconds ?? '…'}s</strong> · sender ID {settings?.smsSenderId}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {links.map((l) => (
          <Button key={l.to} asChild variant="outline" className="h-auto justify-start py-3">
            <Link to={l.to}>
              <l.icon /> {l.label}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

export function HomePage() {
  const { profile, claims, can, isLeader } = useAuth()
  const { data: inbox } = useInbox(profile?.uid)
  if (!profile || !claims) return null
  const sender = canSendAtAll(claims)
  const isAdmin = can('user.manage')
  const unread = (inbox ?? []).filter((d) => !d.readAt && !d.archivedAt).length
  const firstName = profile.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/, '').split(' ')[0]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{firstName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleBadge role={profile.role} userType={profile.userType} positions={claims.positions} />
            {profile.admissionNumber && <span className="font-mono text-xs text-muted-foreground">{profile.admissionNumber}</span>}
            {profile.title && profile.userType === 'STAFF' && <span className="text-xs text-muted-foreground">{profile.title}</span>}
          </div>
        </div>
        {sender && (
          <Button asChild size="lg" className="sm:self-auto">
            <Link to="/compose">
              <PenSquare /> Compose notice
            </Link>
          </Button>
        )}
      </motion.div>

      {profile.userType === 'STUDENT' && !profile.phone && (
        <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="flex-1">
            <span className="font-medium">Add your phone number</span> so urgent notices can reach you by SMS when you're offline.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/profile">Add</Link>
          </Button>
        </Card>
      )}

      {(can('analytics.view') || isAdmin) && <AnalyticsSummary />}

      {profile.userType === 'STUDENT' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Unread" value={unread} icon={Bell} />
          <StatCard label="This month" value={(inbox ?? []).filter((d) => Date.now() - d.createdAt.getTime() < 30 * 86_400_000).length} icon={CheckCheck} tone="green" hint="notices received" />
          <StatCard label="Year of study" value={profile.yearOfStudy ?? '—'} icon={BookOpen} tone="gold" hint={`Semester ${profile.semester ?? '—'}`} />
          <StatCard label="SMS fallback" value={profile.phone ? (profile.smsOptOut ? 'Urgent only' : 'On') : 'No phone'} icon={MessageSquareText} tone="purple" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isLeader && <LeaderGroupCard />}
        {isAdmin && <AdminLinks />}
        {sender && <RecentSends />}
        <LatestNotices />
        {(profile.userType === 'STUDENT' || profile.role === 'LECTURER') && <MyUnitsCard />}
      </div>
    </div>
  )
}
