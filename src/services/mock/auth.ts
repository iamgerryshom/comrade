import { DEMO_PASSWORD } from '@/data/demoAccounts'
import type { AuthService, AuthUser } from '../types'
import { delay, getSessionUid, onSessionChange, principalOf, setSessionUid } from './session'
import { mockFunctions } from './functions'
import { store } from './store'

/** Error shaped like Firebase Auth's (`code` = "auth/…"). */
export class AuthError extends Error {
  constructor(
    public code: 'auth/invalid-credential' | 'auth/user-disabled' | 'auth/network-request-failed',
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function current(): AuthUser | null {
  const uid = getSessionUid()
  const u = uid ? store.get('users', uid) : undefined
  return u ? { uid: u.uid, email: u.email, displayName: u.name } : null
}

export const mockAuth: AuthService = {
  get currentUser() {
    return current()
  },

  onAuthStateChanged(cb) {
    let last = JSON.stringify(current())
    queueMicrotask(() => cb(current()))
    const offSession = onSessionChange(() => {
      last = JSON.stringify(current())
      cb(current())
    })
    // A store reset (or profile edit) may change the user record
    const offStore = store.subscribe((changes, origin) => {
      if (origin !== 'reset' && !changes.some((c) => c.col === 'users')) return
      const now = JSON.stringify(current())
      if (now !== last) {
        last = now
        cb(current())
      }
    })
    return () => {
      offSession()
      offStore()
    }
  },

  async signIn(identifier, password) {
    let email: string
    try {
      email = (await mockFunctions.resolveLoginIdentifier({ identifier })).email
    } catch {
      throw new AuthError('auth/invalid-credential', 'Wrong email/admission number or password.')
    }
    await delay()
    const u = store.list('users', (x) => x.email.toLowerCase() === email)[0]
    if (!u || password !== DEMO_PASSWORD) throw new AuthError('auth/invalid-credential', 'Wrong email/admission number or password.')
    if (!u.isActive) throw new AuthError('auth/user-disabled', 'This account has been deactivated. Contact the registrar.')
    setSessionUid(u.uid)
    return { uid: u.uid, email: u.email, displayName: u.name }
  },

  async signOut() {
    setSessionUid(null)
  },

  async getIdTokenClaims() {
    const uid = getSessionUid()
    const u = uid ? store.get('users', uid) : undefined
    return u ? principalOf(u).claims : null
  },
}
