import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getServices, type AuthUser } from '@/services'
import { can as canCore, isStudentLeader, type Action, type Principal } from '@/core/permissions'
import type { HierarchyLookup } from '@/core/hierarchy'
import type { Claims, Scope, User } from '@/types'
import { useHierarchyIndex } from '@/hooks/data'

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn'
  user: AuthUser | null
  profile: User | null
  claims: Claims | null
}

interface AuthContextValue extends AuthState {
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  principal: Principal | null
  /** UI-only check (hide what the user can't use). The service layer enforces the real rules. */
  can: (action: Action, target?: Scope) => boolean
  isLeader: boolean
  isStaff: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, profile: null, claims: null })

  // Auth state (Firebase-style listener)
  useEffect(() => {
    const auth = getServices().auth
    return auth.onAuthStateChanged((user) => {
      if (!user) {
        setState({ status: 'signedOut', user: null, profile: null, claims: null })
        return
      }
      setState((s) => ({ ...s, user, status: s.profile?.uid === user.uid ? 'signedIn' : s.status }))
    })
  }, [])

  // Own profile document + custom claims (refreshed when the profile changes, like a token refresh)
  const uid = state.user?.uid
  useEffect(() => {
    if (!uid) return
    const { directory, auth } = getServices()
    let alive = true
    const refreshClaims = async (profile: User | null) => {
      const claims = await auth.getIdTokenClaims()
      if (alive) setState((s) => (s.user?.uid === uid ? { ...s, profile, claims, status: profile ? 'signedIn' : 'loading' } : s))
    }
    const off = directory.subscribeToProfile(uid, (p) => void refreshClaims(p))
    const timer = setInterval(() => void auth.getIdTokenClaims().then((claims) => alive && setState((s) => ({ ...s, claims }))), 30_000)
    return () => {
      alive = false
      off()
      clearInterval(timer)
    }
  }, [uid])

  const signIn = useCallback(async (identifier: string, password: string) => {
    await getServices().auth.signIn(identifier, password)
  }, [])

  const signOut = useCallback(async () => {
    await getServices().auth.signOut()
    qc.clear()
  }, [qc])

  const hierarchy = useHierarchyIndex()
  const lookup = useMemo<HierarchyLookup | undefined>(() => {
    if (!hierarchy) return undefined
    const self = state.profile
    return {
      school: (id) => hierarchy.schoolById.get(id),
      faculty: (id) => hierarchy.facultyById.get(id),
      course: (id) => hierarchy.courseById.get(id),
      unit: (id) => hierarchy.unitById.get(id),
      user: (id) => (self && self.uid === id ? self : undefined),
    }
  }, [hierarchy, state.profile])

  const principal = useMemo<Principal | null>(
    () => (state.profile && state.claims ? { uid: state.profile.uid, isActive: state.profile.isActive, claims: state.claims } : null),
    [state.profile, state.claims],
  )

  const can = useCallback((action: Action, target?: Scope) => (principal ? canCore(principal, action, target, lookup) : false), [principal, lookup])

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    principal,
    can,
    isLeader: !!state.claims && isStudentLeader(state.claims),
    isStaff: state.claims?.userType === 'STAFF',
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
