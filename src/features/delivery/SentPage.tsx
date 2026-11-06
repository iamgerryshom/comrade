import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PullToRefresh } from '@/components/layout/PullToRefresh'
import { CalendarClock, ChevronRight, PenSquare, Send, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSent } from '@/hooks/data'
import { CategoryIcon, EmptyState, ListSkeleton, PageHeader, PriorityBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { fullDate, timeAgo } from '@/lib/utils'
import type { DeliveryCounts } from '@/types'

export function DeliveryBar({ counts, className }: { counts: DeliveryCounts; className?: string }) {
  const t = counts.total || 1
  const seg = [
    { n: counts.delivered, c: 'bg-green-500', l: 'Delivered in-app' },
    { n: counts.sms, c: 'bg-purple-500', l: 'Via SMS' },
    { n: counts.failed, c: 'bg-red-500', l: 'Failed' },
    { n: counts.skipped, c: 'bg-slate-400', l: 'Skipped' },
    { n: counts.pending, c: 'bg-amber-400', l: 'Waiting' },
  ]
  return (
    <div className={className}>
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted" role="img" aria-label={seg.map((s) => `${s.l}: ${s.n}`).join(', ')}>
        {seg.map((s) => s.n > 0 && <div key={s.l} className={`${s.c} transition-all duration-500`} style={{ width: `${(s.n / t) * 100}%` }} />)}
      </div>
    </div>
  )
}

export function SentPage() {
  const { profile } = useAuth()
  const { data, isPending: isLoading } = useSent(profile?.uid)
  const qc = useQueryClient()
  return (
    <PullToRefresh onRefresh={() => qc.refetchQueries({ type: 'active' })}>
      <PageHeader
        title="Sent notices"
        icon={Send}
        description="Tap a notice to watch its delivery live."
        actions={
          <Button asChild>
            <Link to="/compose">
              <PenSquare /> New notice
            </Link>
          </Button>
        }
      />
      {isLoading ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={Send} title="Nothing sent yet" description="Notices you send will appear here with live delivery stats." action={<Button asChild><Link to="/compose">Compose a notice</Link></Button>} />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft" aria-label="Sent notices">
          {data.map((n) => (
            <li key={n.id}>
              <Link to={`/sent/${n.id}`} className="group flex items-start gap-3 px-4 py-3.5 hover:bg-accent/60">
                <CategoryIcon category={n.category} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{n.title}</p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {n.status === 'SCHEDULED' ? '' : `${n.counts.delivered + n.counts.sms}/${n.counts.total}`}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Users className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{n.audienceLabel}</span> · {n.status === 'SCHEDULED' ? 'scheduled' : timeAgo(n.sentAt)}
                  </p>
                  {n.status === 'SCHEDULED' ? (
                    <Badge className="mt-2 border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <CalendarClock /> {fullDate(n.scheduledFor)}
                    </Badge>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <DeliveryBar counts={n.counts} className="flex-1" />
                      <PriorityBadge priority={n.priority} />
                    </div>
                  )}
                </div>
                <ChevronRight className="mt-2.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PullToRefresh>
  )
}
