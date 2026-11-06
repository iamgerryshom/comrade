import { computeClaims, type Principal } from '@/core/permissions'
import type { HierarchyLookup } from '@/core/hierarchy'
import type { User } from '@/types'
import { FunctionsError } from '../types'
import { store } from './store'

/** Per-tab signed-in user (sessionStorage), like Firebase Auth session persistence. */
const KEY = 'comrade.session.uid'
const hasSession = typeof sessionStorage !== 'undefined'
let currentUid: string | null = hasSession ? sessionStorage.getItem(KEY) : null
const listeners = new Set<(uid: string | null) => void>()

export function getSessionUid() {
  return currentUid
}

export function setSessionUid(uid: string | null) {
  currentUid = uid
  if (hasSession) {
    if (uid) sessionStorage.setItem(KEY, uid)
    else sessionStorage.removeItem(KEY)
  }
  for (const l of listeners) l(uid)
}

export function onSessionChange(cb: (uid: string | null) => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Lookup backed directly by the store (O(1) per call). */
export const lookup: HierarchyLookup = {
  school: (id) => store.get('schools', id),
  faculty: (id) => store.get('faculties', id),
  course: (id) => store.get('courses', id),
  unit: (id) => store.get('units', id),
  user: (id) => store.get('users', id),
}

export function principalOf(user: User, now = new Date()): Principal {
  const positions = store.list('leadershipPositions', (p) => p.userId === user.uid)
  return { uid: user.uid, isActive: user.isActive, claims: computeClaims(user, positions, now) }
}

export interface CallContext {
  user: User
  principal: Principal
  now: Date
}

export function requireAuth(): CallContext {
  const uid = currentUid
  const user = uid ? store.get('users', uid) : undefined
  if (!user) throw new FunctionsError('unauthenticated', 'Please sign in again.')
  if (!user.isActive) throw new FunctionsError('permission-denied', 'This account has been deactivated.')
  const now = new Date()
  return { user, principal: principalOf(user, now), now }
}

// ── Fake network latency (100–300 ms) so loading states are visible ──
let delayRange: [number, number] = [100, 300]
export function setFakeDelay(min: number, max = min) {
  delayRange = [min, max]
}
export function fakeDelayMs() {
  const [a, b] = delayRange
  return a + Math.random() * (b - a)
}
export function delay(ms = fakeDelayMs()) {
  return ms <= 0 ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms))
}

export function newId(prefix = '') {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18)
  return prefix ? `${prefix}_${id}` : id
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function shortCode() {
  for (;;) {
    const c = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')
    if (!store.list('notifications', (n) => n.shortCode === c).length) return c
  }
}
