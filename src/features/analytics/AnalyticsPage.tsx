import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, CheckCheck, Coins, MessageSquareText, Table2, Timer, XCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAnalytics } from '@/hooks/data'
import { useTheme } from '@/hooks/useTheme'
import { PageHeader, PageSkeleton, StatCard } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives'
import { CATEGORY_LABEL } from '@/core/labels'
import { formatKes, pct } from '@/lib/utils'

/** Delivery-outcome palette (validated: light + dark, CVD-safe). Same meaning as the status chips. */
const PALETTE = {
  light: { inApp: '#16a34a', sms: '#9333ea', failed: '#dc2626', single: '#116a3f', grid: 'oklch(0.9 0.01 155)', axis: 'oklch(0.47 0.02 160)', surface: '#ffffff' },
  dark: { inApp: '#16a34a', sms: '#a855f7', failed: '#ef4444', single: '#3fb37a', grid: 'oklch(0.3 0.017 165)', axis: 'oklch(0.72 0.015 160)', surface: '#1a2420' },
}

function ChartTooltip({ active, payload, label, labelFormat }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">
            {p.value.toLocaleString()} {payload.length > 1 && <span className="text-muted-foreground">({pct(p.value, total)}%)</span>}
          </span>
        </p>
      ))}
    </div>
  )
}

export function AnalyticsPage() {
  const { can } = useAuth()
  const { data, isPending: isLoading } = useAnalytics(can('analytics.view'))
  const { resolved } = useTheme()
  const [tableView, setTableView] = useState(false)
  if (isLoading || !data) return <PageSkeleton />
  const c = PALETTE[resolved === 'dark' ? 'dark' : 'light']
  const t = data.totals
  const axis = { stroke: c.axis, fontSize: 12, tickLine: false, axisLine: false }
  const dayLabel = (d: string) => format(parseISO(d), 'd MMM')
  const schoolRows = data.bySchool.map((s) => ({ ...s, label: s.code }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        icon={BarChart3}
        description="Delivery performance for notices in your scope. Updates live."
        actions={
          <Button variant="outline" size="sm" onClick={() => setTableView((v) => !v)} aria-pressed={tableView}>
            <Table2 /> {tableView ? 'Show charts' : 'Show as tables'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="In-app delivery" value={`${pct(t.inApp, t.deliveries)}%`} icon={CheckCheck} tone="green" hint={`${t.inApp.toLocaleString()} of ${t.deliveries.toLocaleString()}`} />
        <StatCard label="SMS fallback" value={`${pct(t.sms, t.deliveries)}%`} icon={MessageSquareText} tone="purple" hint={`${t.sms.toLocaleString()} messages`} />
        <StatCard label="Failed" value={`${pct(t.failed, t.deliveries)}%`} icon={XCircle} tone="red" hint={`${t.failed} failed · ${t.skipped} skipped`} />
        <StatCard label="Avg. ACK time" value={t.avgAckSeconds !== null ? `${t.avgAckSeconds}s` : '—'} icon={Timer} hint="Device confirms receipt" />
        <StatCard label="SMS cost" value={formatKes(t.smsCostKes)} icon={Coins} tone="gold" hint={`${t.notifications} notices`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Delivery over time</CardTitle>
            <CardDescription>Recipients reached per day, by channel</CardDescription>
          </CardHeader>
          <CardContent>
            {tableView ? (
              <DataTable head={['Day', 'In-app', 'SMS', 'Failed']} rows={data.overTime.map((r) => [dayLabel(r.date), r.inApp, r.sms, r.failed])} />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.overTime} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="20%">
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} {...axis} minTickGap={16} />
                    <YAxis {...axis} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip labelFormat={dayLabel} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
                    <Bar dataKey="inApp" name="In-app" stackId="a" fill={c.inApp} stroke={c.surface} strokeWidth={2} maxBarSize={28} />
                    <Bar dataKey="sms" name="SMS" stackId="a" fill={c.sms} stroke={c.surface} strokeWidth={2} maxBarSize={28} />
                    <Bar dataKey="failed" name="Failed" stackId="a" fill={c.failed} stroke={c.surface} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>By school</CardTitle>
            <CardDescription>Where recipients study, by channel reached</CardDescription>
          </CardHeader>
          <CardContent>
            {tableView ? (
              <DataTable head={['School', 'Recipients', 'In-app %', 'SMS %']} rows={data.bySchool.map((s) => [s.name, s.total, `${pct(s.inApp, s.total)}%`, `${pct(s.sms, s.total)}%`])} />
            ) : (
              <div style={{ height: Math.max(180, schoolRows.length * 38 + 50) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schoolRows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid horizontal={false} stroke={c.grid} />
                    <XAxis type="number" {...axis} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={52} {...axis} />
                    <Tooltip content={<ChartTooltip labelFormat={(code) => data.bySchool.find((s) => s.code === code)?.name ?? code} />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-muted-foreground">{v}</span>} />
                    <Bar dataKey="inApp" name="In-app" stackId="a" fill={c.inApp} stroke={c.surface} strokeWidth={2} />
                    <Bar dataKey="sms" name="SMS" stackId="a" fill={c.sms} stroke={c.surface} strokeWidth={2} />
                    <Bar dataKey="failed" name="Failed" stackId="a" fill={c.failed} stroke={c.surface} strokeWidth={2} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Top courses</CardTitle>
            <CardDescription>Most-notified courses and how they were reached</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              head={['Course', 'Recipients', 'In-app', 'SMS']}
              rows={data.byCourse.map((r) => [
                <span key="n" className="flex flex-col">
                  <span className="font-medium">{r.code}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.name}</span>
                </span>,
                r.total,
                `${pct(r.inApp, r.total)}%`,
                `${pct(r.sms, r.total)}%`,
              ])}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Notices by category</CardTitle>
          </CardHeader>
          <CardContent>
            {tableView ? (
              <DataTable head={['Category', 'Notices']} rows={data.byCategory.map((r) => [CATEGORY_LABEL[r.category], r.total])} />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byCategory.map((r) => ({ ...r, label: CATEGORY_LABEL[r.category] }))} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={c.grid} />
                    <XAxis dataKey="label" {...axis} interval={0} />
                    <YAxis {...axis} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.5 }} />
                    <Bar dataKey="total" name="Notices" fill={c.single} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={`py-2 font-medium ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={`max-w-48 py-2 ${j ? 'text-right tabular-nums' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
