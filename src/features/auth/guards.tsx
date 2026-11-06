import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { Compass, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/common'
import type { Action } from '@/core/permissions'
import { useAuth } from './AuthProvider'

export function FullPageLoader() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageSkeleton />
    </div>
  )
}

/** Signed-in users only. Remembers where they were going. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Route-level permission guard (UI only; the service layer enforces the same rule). */
export function RequirePermission({ action, when, children }: { action?: Action; when?: (ctx: ReturnType<typeof useAuth>) => boolean; children: ReactNode }) {
  const auth = useAuth()
  const allowed = (action ? auth.can(action) : true) && (when ? when(auth) : true)
  if (!auth.claims) return <PageSkeleton />
  return allowed ? <>{children}</> : <ForbiddenPage />
}

export function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-600" aria-hidden>
        <ShieldAlert className="size-7" />
      </span>
      <p className="text-sm font-semibold text-red-600">403</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">You don't have permission for this</h1>
      <p className="mt-2 text-sm text-muted-foreground">This page is limited to certain roles or scopes. If you think you should have access, contact the registrar's office.</p>
      <Button asChild className="mt-6">
        <Link to="/home">Back to home</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
        <Compass className="size-7" />
      </span>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
      <Button asChild className="mt-6">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  )
}
