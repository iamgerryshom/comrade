import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, m } from 'framer-motion'
import { BatteryFull, ChevronLeft, MessageSquareText, Signal, Smartphone, Wifi } from 'lucide-react'
import { format } from 'date-fns'
import { useSmsInbox } from '@/hooks/data'
import { DEMO_ACCOUNTS } from '@/data/demoAccounts'
import { EmptyState, PageHeader } from '@/components/common'
import { NativeSelect } from '@/components/ui/primitives'
import { cn, timeAgo } from '@/lib/utils'
import type { SmsMessage } from '@/types'

/** Demo only: a fake phone showing the SMS each demo number "received", live. */
export function MockSmsInboxPage() {
  const { data, isPending: isLoading } = useSmsInbox(true)
  const phones = useMemo(() => {
    const m = new Map<string, SmsMessage[]>()
    for (const s of data ?? []) m.set(s.to, [...(m.get(s.to) ?? []), s])
    return [...m.entries()].sort((a, b) => b[1][0].createdAt.getTime() - a[1][0].createdAt.getTime())
  }, [data])
  const [params] = useSearchParams()
  const forUid = params.get('uid')
  const uidPhone = forUid ? (data ?? []).find((s) => s.userId === forUid)?.to : undefined
  const [phone, setPhone] = useState('')
  const selected = phone || uidPhone || phones[0]?.[0] || ''
  const messages = (phones.find(([p]) => p === selected)?.[1] ?? []).slice().reverse()
  const demoNames = new Set(DEMO_ACCOUNTS.map((a) => a.uid))

  return (
    <div>
      <PageHeader title="Mock SMS inbox" icon={Smartphone} description="What each phone number received from the SMS fallback. Updates live." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr]">
        <div>
          <label htmlFor="sms-phone" className="mb-2 block text-sm font-medium">
            Phone number
          </label>
          <NativeSelect id="sms-phone" value={selected} onChange={(e) => setPhone(e.target.value)} className="lg:hidden">
            {phones.map(([p, ms]) => (
              <option key={p} value={p}>
                {p} ({ms.length})
              </option>
            ))}
          </NativeSelect>
          <ul className="hidden max-h-[70dvh] space-y-1 overflow-y-auto lg:block" aria-label="Phone numbers">
            {phones.map(([p, ms]) => (
              <li key={p}>
                <button type="button" onClick={() => setPhone(p)} className={cn('flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-sm hover:bg-accent', selected === p && 'bg-primary-soft text-primary')}>
                  <MessageSquareText className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs">{p}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ms.some((x) => x.userId && demoNames.has(x.userId)) ? '★ demo account · ' : ''}
                      {timeAgo(ms[0].createdAt)}
                    </span>
                  </span>
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{ms.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-[340px] py-3">
          <div className="phone-frame overflow-hidden bg-background" data-testid="mock-phone">
            <div className="flex items-center justify-between bg-muted/60 px-5 pb-1 pt-3 text-[11px] font-medium">
              <span>{format(new Date(), 'HH:mm')}</span>
              <span className="flex items-center gap-1">
                <Signal className="size-3" /> <Wifi className="size-3" /> <BatteryFull className="size-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2 border-b bg-muted/60 px-3 pb-2.5">
              <ChevronLeft className="size-5 text-primary" aria-hidden />
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">KSU</span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">COMRADE-KSU</p>
                <p className="font-mono text-[10px] text-muted-foreground">to {selected || '—'}</p>
              </div>
            </div>
            <div className="h-[460px] space-y-3 overflow-y-auto bg-background px-3 py-4" aria-live="polite" data-testid="sms-thread">
              {isLoading ? (
                <p className="text-center text-xs text-muted-foreground">Loading…</p>
              ) : messages.length === 0 ? (
                <EmptyState icon={MessageSquareText} title="No SMS yet" description="Send a notice to a student who is 'offline' and wait for the timeout." />
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <m.div key={msg.id} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="max-w-[88%]">
                      <p className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-[13px] leading-snug" data-testid="sms-bubble">
                        {msg.text}
                      </p>
                      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">
                        {format(msg.createdAt, 'd MMM HH:mm')} · {msg.status === 'FAILED' ? 'not delivered' : msg.status.toLowerCase()}
                      </p>
                    </m.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            The "Ref" code opens the full notice: <Link className="text-primary underline" to="/inbox">/n/&lt;Ref&gt;</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
