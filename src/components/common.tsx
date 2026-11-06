import { Component, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  Clock,
  GraduationCap,
  Megaphone,
  MessageSquareText,
  NotebookPen,
  Send,
  ShieldCheck,
  Siren,
  Star,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { m } from 'framer-motion'
import type { Category, Delivery, DeliveryStatus, PositionType, Priority, Role, UserType } from '@/types'
import { CATEGORY_LABEL, POSITION_LABEL, PRIORITY_LABEL, ROLE_LABEL } from '@/core/labels'
import { cn, initials } from '@/lib/utils'
import { Avatar, AvatarFallback, Badge, Skeleton } from './ui/primitives'
import { Button } from './ui/button'

// ───────── Clock ─────────
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, enabled])
  return now
}
export const mmss = (secs: number) => `${Math.floor(Math.max(0, secs) / 60)}:${String(Math.max(0, Math.ceil(secs)) % 60).padStart(2, '0')}`

// ───────── Roles & people ─────────
const LEADER_ICON: Record<PositionType, LucideIcon> = {
  STUDENT_PRESIDENT: ShieldCheck,
  STUDENT_OFFICIAL: ShieldCheck,
  SCHOOL_REP: Star,
  FACULTY_REP: Star,
  CLASS_REP: Star,
}

export function RoleBadge({ role, userType, positions = [], className }: { role: Role; userType: UserType; positions?: PositionType[]; className?: string }) {
  if (userType === 'STUDENT' && positions.length) {
    const p = positions[0]
    const Icon = LEADER_ICON[p]
    return (
      <Badge className={cn('border-gold/50 bg-gold-soft text-gold-foreground dark:text-gold', className)}>
        <Icon aria-hidden />
        {POSITION_LABEL[p]}
      </Badge>
    )
  }
  if (userType === 'STUDENT')
    return (
      <Badge className={cn('border-primary/25 bg-primary-soft text-primary', className)}>
        <GraduationCap aria-hidden />
        Student
      </Badge>
    )
  return (
    <Badge className={cn('border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300', className)}>
      <Briefcase aria-hidden />
      {ROLE_LABEL[role]}
    </Badge>
  )
}

export function UserTypeBadge({ userType }: { userType: UserType }) {
  return userType === 'STAFF' ? (
    <Badge className="border-sky-500/30 text-sky-700 dark:text-sky-300">Staff</Badge>
  ) : (
    <Badge className="border-primary/30 text-primary">Student</Badge>
  )
}

export function UserAvatar({ name, userType, leader, className }: { name: string; userType: UserType; leader?: boolean; className?: string }) {
  const ring = leader ? 'ring-gold' : userType === 'STAFF' ? 'ring-sky-500' : 'ring-primary'
  const bg = userType === 'STAFF' ? 'bg-sky-500/15 text-sky-800 dark:text-sky-200' : 'bg-primary-soft text-primary'
  return (
    <Avatar className={cn('ring-2 ring-offset-2 ring-offset-background', ring, className)}>
      <AvatarFallback className={bg}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

// ───────── Categories & priority ─────────
export const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; className: string; dot: string }> = {
  ACADEMIC: { icon: BookOpen, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25', dot: 'bg-blue-500' },
  EXAM: { icon: NotebookPen, className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25', dot: 'bg-orange-500' },
  FINANCE: { icon: Wallet, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-500' },
  EVENT: { icon: CalendarDays, className: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/25', dot: 'bg-pink-500' },
  EMERGENCY: { icon: Siren, className: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30', dot: 'bg-red-500' },
  GENERAL: { icon: Megaphone, className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25', dot: 'bg-slate-500' },
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const s = CATEGORY_STYLE[category]
  const Icon = s.icon
  return (
    <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl border', s.className, className)} aria-hidden>
      <Icon className="size-5" />
    </span>
  )
}

export function CategoryBadge({ category }: { category: Category }) {
  const s = CATEGORY_STYLE[category]
  const Icon = s.icon
  return (
    <Badge className={s.className}>
      <Icon aria-hidden />
      {CATEGORY_LABEL[category]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === 'NORMAL' || priority === 'LOW') return priority === 'LOW' ? <Badge className="text-muted-foreground">Low</Badge> : null
  return (
    <Badge
      className={
        priority === 'URGENT'
          ? 'border-red-600 bg-red-600 text-white'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      }
    >
      {priority === 'URGENT' && <AlertTriangle aria-hidden />}
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}

// ───────── Delivery status ─────────
const STATUS_STYLE: Record<DeliveryStatus, { label: string; icon: LucideIcon; className: string }> = {
  PENDING: { label: 'Pushing', icon: Send, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25' },
  PUSHED: { label: 'Pushed', icon: Send, className: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25' },
  DELIVERED: { label: 'Delivered', icon: CircleCheck, className: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30' },
  READ: { label: 'Read', icon: CheckCheck, className: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30' },
  SMS_QUEUED: { label: 'Sending SMS…', icon: MessageSquareText, className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' },
  SMS_SENT: { label: 'Sent via SMS', icon: MessageSquareText, className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' },
  SMS_DELIVERED: { label: 'SMS delivered', icon: MessageSquareText, className: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25' },
  DELIVERED_AFTER_SMS: { label: 'Delivered after SMS', icon: CheckCheck, className: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30' },
  SMS_FAILED: { label: 'Failed', icon: XCircle, className: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30' },
  SMS_SKIPPED: { label: 'SMS skipped', icon: CircleSlash, className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/25' },
}

/** Status chip. Awaiting ACK shows an amber countdown ("Waiting for device 0:42"). */
export function StatusChip({ delivery, now }: { delivery: Pick<Delivery, 'status' | 'ackDeadline' | 'skipReason'>; now?: number }) {
  const waiting = delivery.status === 'PUSHED' && now !== undefined && delivery.ackDeadline.getTime() > now
  if (waiting) {
    const secs = (delivery.ackDeadline.getTime() - now!) / 1000
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 tabular-nums text-amber-800 dark:text-amber-300" aria-live="off">
        <Clock aria-hidden />
        Waiting for device {mmss(secs)}
      </Badge>
    )
  }
  const s = STATUS_STYLE[delivery.status]
  const Icon = s.icon
  return (
    <Badge className={s.className} title={delivery.skipReason ?? undefined}>
      <Icon aria-hidden />
      {s.label}
    </Badge>
  )
}

/** SVG countdown ring for the delivery timeline. */
export function CountdownRing({ remaining, total, size = 36 }: { remaining: number; total: number; size?: number }) {
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, remaining / total))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${Math.ceil(remaining)} seconds left`}>
      <svg width={size} height={size} className="countdown-ring -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-amber-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums">{Math.max(0, Math.ceil(remaining))}</span>
    </span>
  )
}

// ───────── Layout pieces ─────────
export function PageHeader({ title, description, actions, icon: Icon }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:inline-flex" aria-hidden>
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon = CircleDashed, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'default' }: { label: string; value: ReactNode; icon: LucideIcon; hint?: ReactNode; tone?: 'default' | 'green' | 'purple' | 'red' | 'amber' | 'gold' }) {
  const tones = {
    default: 'bg-primary-soft text-primary',
    green: 'bg-green-500/10 text-green-700 dark:text-green-300',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
    red: 'bg-red-500/10 text-red-700 dark:text-red-300',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    gold: 'bg-gold-soft text-gold-foreground dark:text-gold',
  }
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn('inline-flex size-8 items-center justify-center rounded-lg', tones[tone])} aria-hidden>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </m.div>
  )
}

// ───────── Error boundary ─────────
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ComponentType<{ error: Error; reset: () => void }> }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Comrade UI error', error, info.componentStack)
  }
  reset = () => this.setState({ error: null })
  render() {
    if (!this.state.error) return this.props.children
    const F = this.props.fallback
    if (F) return <F error={this.state.error} reset={this.reset} />
    return (
      <div role="alert" className="mx-auto my-12 max-w-md rounded-xl border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600" aria-hidden>
          <AlertTriangle className="size-6" />
        </span>
        <p className="font-semibold">Something went wrong on this screen</p>
        <p className="mt-1 text-sm text-muted-foreground">{this.state.error.message}</p>
        <Button className="mt-4" variant="outline" onClick={this.reset}>
          Try again
        </Button>
      </div>
    )
  }
}
