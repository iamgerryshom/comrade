import { useState } from 'react'
import { MessageSquareText, ScrollText } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAuditLogs, useSmsLogs } from '@/hooks/data'
import { DataTable } from '@/components/DataTable'
import { PageHeader, StatCard } from '@/components/common'
import { Badge, NativeSelect } from '@/components/ui/primitives'
import { formatKes, fullDate } from '@/lib/utils'
import { ROLE_LABEL } from '@/core/labels'
import type { SmsStatus } from '@/types'

const SMS_BADGE: Record<SmsStatus, string> = {
  QUEUED: 'border-amber-500/30 text-amber-700 dark:text-amber-300',
  SENT: 'border-purple-500/30 text-purple-700 dark:text-purple-300',
  DELIVERED: 'border-green-500/30 text-green-700 dark:text-green-300',
  FAILED: 'border-red-500/30 text-red-600',
}

export function SmsLogsPage() {
  const { can } = useAuth()
  const { data, isPending: isLoading } = useSmsLogs(can('sms_logs.view'))
  const [status, setStatus] = useState<SmsStatus | ''>('')
  const rows = (data ?? []).filter((s) => !status || s.status === status)
  const cost = (data ?? []).reduce((a, s) => a + s.costKes, 0)
  return (
    <div>
      <PageHeader title="SMS logs" icon={MessageSquareText} description="Every SMS sent by the fallback engine. Africa's Talking in production; mock provider now." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Messages" value={(data ?? []).length.toLocaleString()} icon={MessageSquareText} tone="purple" />
        <StatCard label="Delivered" value={(data ?? []).filter((s) => s.status === 'DELIVERED').length.toLocaleString()} icon={MessageSquareText} tone="green" />
        <StatCard label="Failed" value={(data ?? []).filter((s) => s.status === 'FAILED').length} icon={MessageSquareText} tone="red" />
        <StatCard label="Total cost" value={formatKes(cost)} icon={MessageSquareText} tone="gold" />
      </div>
      <DataTable
        rows={rows}
        loading={isLoading}
        rowKey={(s) => s.id}
        searchText={(s) => `${s.to} ${s.text} ${s.providerMessageId ?? ''}`}
        initialSort={{ key: 'time', dir: 'desc' }}
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as SmsStatus | '')} className="w-36" aria-label="Filter by status">
            <option value="">All statuses</option>
            {(['QUEUED', 'SENT', 'DELIVERED', 'FAILED'] as const).map((s) => (
              <option key={s} value={s}>
                {s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        }
        columns={[
          { key: 'time', header: 'Time', sortValue: (s) => s.createdAt.getTime(), cell: (s) => <span className="whitespace-nowrap text-xs">{fullDate(s.createdAt)}</span> },
          { key: 'to', header: 'To', sortValue: (s) => s.to, cell: (s) => <span className="font-mono text-xs">{s.to}</span> },
          { key: 'text', header: 'Message', cell: (s) => <span className="line-clamp-2 max-w-md font-mono text-xs">{s.text}</span> },
          { key: 'status', header: 'Status', sortValue: (s) => s.status, cell: (s) => <Badge className={SMS_BADGE[s.status]} title={s.error ?? undefined}>{s.status.toLowerCase()}{s.attempt > 1 ? ` · try ${s.attempt}` : ''}</Badge> },
          { key: 'cost', header: 'Cost', className: 'text-right', sortValue: (s) => s.costKes, cell: (s) => <span className="tabular-nums">{s.costKes.toFixed(2)}</span> },
        ]}
        mobileCard={(s) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{s.to}</span>
              <Badge className={SMS_BADGE[s.status]}>{s.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-1.5 font-mono text-xs leading-relaxed">{s.text}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {fullDate(s.createdAt)} · KES {s.costKes.toFixed(2)}
              {s.error ? ` · ${s.error}` : ''}
            </p>
          </div>
        )}
      />
    </div>
  )
}

export function AuditLogPage() {
  const { can } = useAuth()
  const { data, isPending: isLoading } = useAuditLogs(can('audit.view'))
  const [action, setAction] = useState('')
  const actions = [...new Set((data ?? []).map((a) => a.action))].sort()
  const rows = (data ?? []).filter((a) => !action || a.action === action)
  return (
    <div>
      <PageHeader title="Audit log" icon={ScrollText} description="Who did what, to whom, and when. Every privileged action and every student lookup." />
      <DataTable
        rows={rows}
        loading={isLoading}
        rowKey={(a) => a.id}
        searchText={(a) => `${a.actorName} ${a.action} ${a.targetLabel}`}
        initialSort={{ key: 'time', dir: 'desc' }}
        pageSize={20}
        toolbar={
          <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} className="w-56" aria-label="Filter by action">
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        }
        columns={[
          { key: 'time', header: 'Time', sortValue: (a) => a.createdAt.getTime(), cell: (a) => <span className="whitespace-nowrap text-xs">{fullDate(a.createdAt)}</span> },
          {
            key: 'actor',
            header: 'Who',
            sortValue: (a) => a.actorName,
            cell: (a) => (
              <span>
                <span className="block font-medium">{a.actorName}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABEL[a.actorRole]}</span>
              </span>
            ),
          },
          { key: 'action', header: 'Action', sortValue: (a) => a.action, cell: (a) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.action}</code> },
          { key: 'target', header: 'Target', cell: (a) => <span className="line-clamp-1 max-w-64 text-sm">{a.targetLabel || '—'}</span> },
          {
            key: 'meta',
            header: 'Details',
            cell: (a) => (
              <span className="line-clamp-2 max-w-72 font-mono text-[11px] text-muted-foreground">
                {Object.entries(a.metadata)
                  .filter(([k]) => k !== 'rateLimits')
                  .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                  .join(' · ')}
              </span>
            ),
          },
        ]}
        mobileCard={(a) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.action}</code>
              <span className="text-xs text-muted-foreground">{fullDate(a.createdAt)}</span>
            </div>
            <p className="mt-1.5 text-sm">
              <span className="font-medium">{a.actorName}</span> → {a.targetLabel || '—'}
            </p>
          </div>
        )}
      />
    </div>
  )
}
