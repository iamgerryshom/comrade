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
      <Badge className={cn('border-transparent bg-gold-soft text-gold-foreground dark:text-gold', className)}>
        <Icon aria-hidden />
        {POSITION_LABEL[p]}
      </Badge>
    )
  }
  if (userType === 'STUDENT')
    return (
      <Badge className={cn('border-transparent bg-primary-soft text-primary', className)}>
        <GraduationCap aria-hidden />
        Student
      </Badge>
    )
  return (
    <Badge className={cn('border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-300', className)}>
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
/** Category colour lives in the icon only, on a neutral tile: calm lists, still scannable. */
export const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; text: string; dot: string }> = {
  ACADEMIC: { icon: BookOpen, text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  EXAM: { icon: NotebookPen, text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  FINANCE: { icon: Wallet, text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  EVENT: { icon: CalendarDays, text: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
  EMERGENCY: { icon: Siren, text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  GENERAL: { icon: Megaphone, text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-500' },
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const s = CATEGORY_STYLE[category]
  const Icon = s.icon
  return (
    <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted', s.text, className)} aria-hidden>
      <Icon className="size-[18px]" />
    </span>
  )
}

export function CategoryBadge({ category }: { category: Category }) {
  const s = CATEGORY_STYLE[category]
  const Icon = s.icon
  return (
    <Badge className="border-transparent bg-muted text-foreground">
      <Icon aria-hidden className={s.text} />
      {CATEGORY_LABEL[category]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === 'NORMAL' || priority === 'LOW') return null
  return (
    <Badge
      className={
        priority === 'URGENT'
          ? 'border-red-600 bg-red-600 text-white'
          : 'border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300'
      }
    >
      {priority === 'URGENT' && <AlertTriangle aria-hidden />}
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}

// ───────── Delivery status ─────────
const STATUS_STYLE: Record<DeliveryStatus, { label: string; icon: LucideIcon; className: string }> = {
  PENDING: { label: 'Pushing', icon: Send, className: 'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  PUSHED: { label: 'Pushed', icon: Send, className: 'border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  DELIVERED: { label: 'Delivered', icon: CircleCheck, className: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-300' },
  READ: { label: 'Read', icon: CheckCheck, className: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-300' },
  SMS_QUEUED: { label: 'Sending SMS…', icon: MessageSquareText, className: 'border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  SMS_SENT: { label: 'Sent via SMS', icon: MessageSquareText, className: 'border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  SMS_DELIVERED: { label: 'SMS delivered', icon: MessageSquareText, className: 'border-transparent bg-purple-500/10 text-purple-700 dark:text-purple-300' },
  DELIVERED_AFTER_SMS: { label: 'Delivered after SMS', icon: CheckCheck, className: 'border-transparent bg-green-500/10 text-green-700 dark:text-green-300' },
  SMS_FAILED: { label: 'Failed', icon: XCircle, className: 'border-transparent bg-red-500/10 text-red-700 dark:text-red-300' },
  SMS_SKIPPED: { label: 'SMS skipped', icon: CircleSlash, className: 'border-transparent bg-slate-500/10 text-slate-600 dark:text-slate-300' },
}

/** Status chip. Awaiting ACK shows an amber countdown ("Waiting for device 0:42"). */
export function StatusChip({ delivery, now }: { delivery: Pick<Delivery, 'status' | 'ackDeadline' | 'skipReason'>; now?: number }) {
  const waiting = delivery.status === 'PUSHED' && now !== undefined && delivery.ackDeadline.getTime() > now
  if (waiting) {
    const secs = (delivery.ackDeadline.getTime() - now!) / 1000
    return (
      <Badge className="border-transparent bg-amber-500/10 tabular-nums text-amber-800 dark:text-amber-300" aria-live="off">
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
/** Page title block. Lean on phones: smaller title, actions inline. (`icon` kept for API compatibility.) */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  )
}

/** A titled block of content: the building unit of every screen (title, optional action, body). */
export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0', className)}>
      {(title || action) && (
        <div className="mb-2 flex min-h-8 items-center justify-between gap-2 px-1">
          {title && <h2 className="text-sm font-semibold text-foreground/80">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Grouped list (iOS / Material style): one card, rows separated by hairlines. */
export function ListCard({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <ul aria-label={label} className={cn('divide-y overflow-hidden rounded-2xl border bg-card shadow-soft', className)}>
      {children}
    </ul>
  )
}

export function EmptyState({ icon: Icon = CircleDashed, title, description, action, bare }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; bare?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', !bare && 'rounded-2xl border border-dashed')}>
      <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        <Icon className="size-5" />
      </span>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y overflow-hidden rounded-2xl border bg-card" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
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
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}

const TONE_TEXT = {
  default: 'text-primary',
  green: 'text-green-600 dark:text-green-400',
  purple: 'text-purple-600 dark:text-purple-400',
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  gold: 'text-gold-foreground dark:text-gold',
}

/** Metric tile: label, big number, one line of context. Colour only on the small icon. */
export function StatCard({ label, value, icon: Icon, hint, tone = 'default' }: { label: string; value: ReactNode; icon: LucideIcon; hint?: ReactNode; tone?: keyof typeof TONE_TEXT }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-soft">
      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon className={cn('size-3.5 shrink-0', TONE_TEXT[tone])} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
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
