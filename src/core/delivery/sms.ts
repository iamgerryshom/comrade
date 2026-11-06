import type { Category } from '@/types'

export const SMS_MAX = 160
const ELLIPSIS = '…'

const clean = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '')

function truncate(s: string, max: number): string {
  if (max <= 0) return ''
  if (s.length <= max) return s
  if (max === 1) return ELLIPSIS
  // Prefer cutting at a word boundary when it doesn't lose too much
  const cut = s.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  const base = space > max * 0.6 ? cut.slice(0, space) : cut
  return base.replace(/[\s,.;:–-]+$/, '') + ELLIPSIS
}

export interface SmsInput {
  senderId?: string
  category: Category
  title: string
  body: string
  senderLabel: string
  shortCode: string
}

/**
 * `[COMRADE-KSU] {CATEGORY}: {title}. {short body}. From: {sender}. Ref:{code}`, ≤160 chars.
 * The body is shortened first, then the title. The prefix, sender and Ref are always kept.
 */
export function buildSmsText(i: SmsInput): string {
  const prefix = `[${i.senderId ?? 'COMRADE-KSU'}] ${i.category}: `
  const suffix = ` From: ${clean(i.senderLabel).slice(0, 30)}. Ref:${i.shortCode}`
  const title = clean(i.title)
  const body = clean(i.body)
  const budget = SMS_MAX - prefix.length - suffix.length

  const end = (s: string) => (s.endsWith(ELLIPSIS) ? s : `${s}.`)
  const titleOnly = `${title}.`
  if (titleOnly.length >= budget) return prefix + end(truncate(title, budget - 1)) + suffix
  const bodyBudget = budget - titleOnly.length - 2 // leading space + trailing "."
  const bodyPart = body && bodyBudget > 3 ? ` ${end(truncate(body, bodyBudget))}` : ''
  return prefix + titleOnly + bodyPart + suffix
}
