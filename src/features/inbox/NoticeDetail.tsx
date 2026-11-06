import { useEffect } from 'react'
import { Link } from 'react-router'
import { Archive, ArchiveRestore, CalendarClock, CheckCheck, Download, Hash, MessageSquareText, Paperclip, Send, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { useArchive, useMarkRead, useNotice } from '@/hooks/data'
import { CategoryBadge, EmptyState, PriorityBadge, RoleBadge, StatusChip, UserAvatar, useNow } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Separator, Skeleton } from '@/components/ui/primitives'
import { fullDate, timeAgo } from '@/lib/utils'
import { SMS_PATH } from '@/core/delivery/state'

export function NoticeDetail({ notificationId, compact }: { notificationId: string; compact?: boolean }) {
  const { profile } = useAuth()
  const { data, isPending: isLoading, error } = useNotice(notificationId)
  const markRead = useMarkRead(profile?.uid)
  const archive = useArchive(profile?.uid)
  const now = useNow(1000, !!data?.delivery && data.delivery.status === 'PUSHED')
  const delivery = data?.delivery

  useEffect(() => {
    if (delivery && !delivery.readAt) markRead.mutate(delivery.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.id])

  if (isLoading)
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  if (error || !data) return <EmptyState title="Notice unavailable" description={error instanceof Error ? error.message : 'It may have been removed.'} />

  const n = data.notification
  const viaSms = delivery && (SMS_PATH.includes(delivery.status) || delivery.status === 'DELIVERED_AFTER_SMS')
  const isSender = n.senderId === profile?.uid

  return (
    <article className="min-w-0" aria-labelledby="notice-title">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={n.category} />
        <PriorityBadge priority={n.priority} />
        {delivery && <StatusChip delivery={delivery} now={now} />}
      </div>
      <h1 id="notice-title" className={compact ? 'mt-3 text-xl font-semibold tracking-tight' : 'mt-3 text-2xl font-semibold tracking-tight sm:text-3xl'}>
        {n.title}
      </h1>

      <div className="mt-4 flex items-center gap-3">
        <UserAvatar name={n.senderName} userType={n.senderRole === 'STUDENT' ? 'STUDENT' : 'STAFF'} leader={!!n.senderPosition} />
        <div className="min-w-0">
          <p className="truncate font-medium">{n.senderName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <RoleBadge role={n.senderRole} userType={n.senderRole === 'STUDENT' ? 'STUDENT' : 'STAFF'} positions={n.senderPosition ? [n.senderPosition] : []} />
            <span className="text-xs text-muted-foreground">{timeAgo(n.sentAt ?? n.createdAt)}</span>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-2 rounded-xl bg-muted/60 p-3.5 text-sm text-foreground/85 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Audience</dt>
          <dd className="truncate">{n.audienceLabel}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Send className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Sent</dt>
          <dd>{fullDate(n.sentAt ?? n.createdAt)}</dd>
        </div>
        {delivery?.ackedAt && (
          <div className="flex items-center gap-2">
            <CheckCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Delivered</dt>
            <dd>Delivered {fullDate(delivery.ackedAt)}</dd>
          </div>
        )}
        {delivery?.readAt && (
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Read</dt>
            <dd>Read {fullDate(delivery.readAt)}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Hash className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <dt className="sr-only">SMS reference</dt>
          <dd>
            Ref <span className="font-mono font-medium">{n.shortCode}</span>
          </dd>
        </div>
      </dl>

      {viaSms && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 p-3 text-sm text-purple-900 dark:text-purple-200">
          <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
          Your device didn't confirm this notice in time, so a short version was also sent to you by SMS.
        </p>
      )}

      <Separator className="my-5" />
      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{n.body}</div>

      {n.attachment && (
        <a href={n.attachment.url} download={n.attachment.name} className="mt-5 flex items-center gap-3 rounded-xl border p-3 hover:bg-accent">
          <Paperclip className="size-4 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{n.attachment.name}</span>
          <span className="text-xs text-muted-foreground">{Math.ceil(n.attachment.size / 1024)} KB</span>
          <Download className="size-4" aria-hidden />
        </a>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {delivery && (
          <Button
            variant="outline"
            onClick={() => {
              archive.mutate({ id: delivery.id, archived: !delivery.archivedAt })
              toast.success(delivery.archivedAt ? 'Moved back to inbox' : 'Archived')
            }}
          >
            {delivery.archivedAt ? <ArchiveRestore /> : <Archive />}
            {delivery.archivedAt ? 'Unarchive' : 'Archive'}
          </Button>
        )}
        {isSender && (
          <Button asChild variant="outline">
            <Link to={`/sent/${n.id}`}>
              <Send /> Delivery timeline
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
