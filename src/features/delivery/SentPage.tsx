import { Link } from 'react-router'
import { motion } from 'framer-motion'
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
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={seg.map((s) => `${s.l}: ${s.n}`).join(', ')}>
        {seg.map((s) => s.n > 0 && <div key={s.l} className={`${s.c} transition-all duration-500`} style={{ width: `${(s.n / t) * 100}%` }} />)}
      </div>
    </div>
  )
}

export function SentPage() {
  const { profile } = useAuth()
  const { data, isLoading } = useSent(profile?.uid)
  return (
    <div>
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
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.map((n, i) => (
            <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}>
              <Link to={`/sent/${n.id}`} className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40">
                <div className="flex items-start gap-3">
                  <CategoryIcon category={n.category} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium">{n.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Users className="size-3.5 shrink-0" /> {n.audienceLabel}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <PriorityBadge priority={n.priority} />
                  {n.status === 'SCHEDULED' ? (
                    <Badge className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <CalendarClock /> Scheduled {fullDate(n.scheduledFor)}
                    </Badge>
                  ) : (
                    <span>{timeAgo(n.sentAt)}</span>
                  )}
                  <span className="ml-auto tabular-nums">
                    {n.counts.delivered + n.counts.sms}/{n.counts.total} reached
                  </span>
                </div>
                {n.status !== 'SCHEDULED' && <DeliveryBar counts={n.counts} className="mt-2" />}
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}
