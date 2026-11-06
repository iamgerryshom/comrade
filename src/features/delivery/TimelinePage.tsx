import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, CheckCheck, CircleSlash, Clock, Eye, MessageSquareText, Search, Users, XCircle } from 'lucide-react'
import { useNotificationDeliveries, useNotificationLive } from '@/hooks/data'
import { countDeliveries } from '@/core/delivery/state'
import { CategoryBadge, CountdownRing, EmptyState, ListSkeleton, PageSkeleton, PriorityBadge, StatCard, StatusChip, useNow } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, Input, Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives'
import { fullDate, pct } from '@/lib/utils'
import type { Delivery } from '@/types'
import { DeliveryBar } from './SentPage'

type Filter = 'all' | 'waiting' | 'inapp' | 'sms' | 'problem'
const match: Record<Filter, (d: Delivery) => boolean> = {
  all: () => true,
  waiting: (d) => ['PENDING', 'PUSHED', 'SMS_QUEUED'].includes(d.status),
  inapp: (d) => ['DELIVERED', 'READ'].includes(d.status),
  sms: (d) => ['SMS_SENT', 'SMS_DELIVERED', 'DELIVERED_AFTER_SMS'].includes(d.status),
  problem: (d) => ['SMS_FAILED', 'SMS_SKIPPED'].includes(d.status),
}

function RecipientRow({ d, now, timeout }: { d: Delivery; now: number; timeout: number }) {
  const remaining = (d.ackDeadline.getTime() - now) / 1000
  const waiting = (d.status === 'PUSHED' || d.status === 'PENDING') && remaining > 0
  const ackSecs = d.ackedAt ? (d.ackedAt.getTime() - d.createdAt.getTime()) / 1000 : null
  return (
    <motion.li layout="position" className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0 sm:px-4" data-testid={`recipient-${d.userId}`} data-status={d.status}>
      <span className="flex size-9 shrink-0 items-center justify-center">
        {waiting ? (
          <CountdownRing remaining={remaining} total={timeout} />
        ) : ['DELIVERED', 'READ', 'DELIVERED_AFTER_SMS'].includes(d.status) ? (
          <CheckCheck className="size-5 text-green-600" aria-hidden />
        ) : d.status.startsWith('SMS_') && d.status !== 'SMS_FAILED' && d.status !== 'SMS_SKIPPED' ? (
          <MessageSquareText className="size-5 text-purple-600" aria-hidden />
        ) : d.status === 'SMS_FAILED' ? (
          <XCircle className="size-5 text-red-600" aria-hidden />
        ) : d.status === 'SMS_SKIPPED' ? (
          <CircleSlash className="size-5 text-slate-500" aria-hidden />
        ) : (
          <Clock className="size-5 text-amber-500" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{d.recipientName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ackSecs !== null && d.status !== 'DELIVERED_AFTER_SMS'
            ? `Confirmed by device in ${ackSecs < 10 ? ackSecs.toFixed(1) : Math.round(ackSecs)}s${d.ackChannel === 'SERVICE_WORKER' ? ' (background)' : ''}`
            : d.status === 'DELIVERED_AFTER_SMS'
              ? 'SMS sent, then the device confirmed late'
              : d.skipReason ?? (d.smsAttempts > 1 ? `SMS attempt ${d.smsAttempts} of 3` : waiting ? 'Waiting for the device to confirm' : '')}
          {d.readAt && ' · read'}
        </p>
      </div>
      <StatusChip delivery={d} now={now} />
    </motion.li>
  )
}

export function TimelinePage() {
  const { id } = useParams()
  const { data: n, isLoading } = useNotificationLive(id)
  const { data: deliveries, isLoading: loadingD } = useNotificationDeliveries(id)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(100)
  const counts = useMemo(() => countDeliveries(deliveries ?? []), [deliveries])
  const anyWaiting = counts.pending > 0
  const now = useNow(1000, anyWaiting)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    // Waiting first, then problems, then the rest
    const rank = (d: Delivery) => (match.waiting(d) ? 0 : match.problem(d) ? 1 : 2)
    return (deliveries ?? []).filter((d) => match[filter](d) && (!term || d.recipientName.toLowerCase().includes(term))).sort((a, b) => rank(a) - rank(b))
  }, [deliveries, filter, q])

  if (isLoading) return <PageSkeleton />
  if (!n) return <EmptyState title="Notice not found" description="It may have been deleted, or it wasn't sent by you." />

  const total = counts.total
  return (
    <div>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3" asChild>
        <Link to="/sent">
          <ArrowLeft /> Sent notices
        </Link>
      </Button>

      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={n.category} />
          <PriorityBadge priority={n.priority} />
          <span className="text-xs text-muted-foreground">Ref {n.shortCode}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{n.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> {n.audienceLabel}
          </span>
          <span>{n.status === 'SCHEDULED' ? `Scheduled for ${fullDate(n.scheduledFor)}` : `Sent ${fullDate(n.sentAt)}`}</span>
          <span>SMS fallback after {n.ackTimeoutSeconds}s {n.allowSmsFallback || n.priority === 'URGENT' ? '' : '(off)'}</span>
        </p>
      </div>

      {n.status === 'SCHEDULED' ? (
        <EmptyState icon={CalendarClock} title="Scheduled" description={`This notice will be sent automatically on ${fullDate(n.scheduledFor)}.`} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Delivered in-app" value={counts.delivered} icon={CheckCheck} tone="green" hint={`${pct(counts.delivered, total)}% · ${counts.read} read`} />
            <StatCard label="Via SMS" value={counts.sms} icon={MessageSquareText} tone="purple" hint={`${pct(counts.sms, total)}%`} />
            <StatCard label="Failed / skipped" value={counts.failed + counts.skipped} icon={XCircle} tone="red" hint={`${counts.failed} failed · ${counts.skipped} skipped`} />
            <StatCard label="Waiting" value={counts.pending} icon={Clock} tone="amber" hint={anyWaiting ? 'Counting down…' : 'All settled'} />
          </div>
          <DeliveryBar counts={counts} className="mt-4" />
          <p className="mt-2 text-xs text-muted-foreground">
            <Eye className="mr-1 inline size-3.5" />
            Delivered means the student's device confirmed it received the notice, not just that it was sent.
          </p>

          <Card className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:p-4">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="min-w-0 overflow-x-auto scrollbar-none">
                <TabsList>
                  <TabsTrigger value="all">All {total}</TabsTrigger>
                  <TabsTrigger value="waiting">Waiting {counts.pending}</TabsTrigger>
                  <TabsTrigger value="inapp">In-app {counts.delivered}</TabsTrigger>
                  <TabsTrigger value="sms">SMS {counts.sms}</TabsTrigger>
                  <TabsTrigger value="problem">Issues {counts.failed + counts.skipped}</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative sm:ml-auto sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find recipient" className="h-9 pl-9" aria-label="Find recipient" />
              </div>
            </div>
            {loadingD ? (
              <div className="p-4">
                <ListSkeleton rows={4} />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No recipients in this view.</p>
            ) : (
              <ul aria-label="Recipients" aria-live="polite">
                <AnimatePresence initial={false}>
                  {rows.slice(0, limit).map((d) => (
                    <RecipientRow key={d.id} d={d} now={now} timeout={n.ackTimeoutSeconds} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {rows.length > limit && (
              <div className="border-t p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 200)}>
                  Show more ({rows.length - limit} left)
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
