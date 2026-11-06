import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(d: Date | null | undefined) {
  if (!d) return '—'
  const secs = (Date.now() - d.getTime()) / 1000
  if (secs < 45) return 'just now'
  return `${formatDistanceToNowStrict(d)} ago`
}

export function shortDate(d: Date | null | undefined) {
  if (!d) return '—'
  if (isToday(d)) return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'd MMM')
}

export function fullDate(d: Date | null | undefined) {
  return d ? format(d, "EEE d MMM yyyy, HH:mm") : '—'
}

export function initials(name: string) {
  return name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatKes(n: number) {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0
}

export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message
  return 'Something went wrong. Please try again.'
}
