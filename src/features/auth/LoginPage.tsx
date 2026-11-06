import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { ArrowLeft, Briefcase, Crown, GraduationCap, KeyRound, ShieldCheck, Star, UserRound, WifiOff, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, FieldError, Input, Label } from '@/components/ui/primitives'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/data/demoAccounts'
import { env } from '@/lib/env'
import { errorMessage } from '@/lib/utils'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from './AuthProvider'

const schema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or admission number'),
  password: z.string().min(1, 'Enter your password'),
})
type Form = z.infer<typeof schema>

const DEMO_ICON: Record<string, LucideIcon> = {
  superadmin: ShieldCheck,
  registrar: Briefcase,
  dean: Briefcase,
  hod: Briefcase,
  lecturer: Briefcase,
  president: Crown,
  classrep: Star,
  student: GraduationCap,
  student2: WifiOff,
}

export function LoginPage() {
  const { signIn, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/home'
  const [error, setError] = useState<string | null>(null)
  const [demoBusy, setDemoBusy] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '' } })

  if (status === 'signedIn') return <Navigate to={from} replace />

  const submit = async (f: Form) => {
    setError(null)
    try {
      await signIn(f.identifier, f.password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const demoLogin = async (email: string, key: string) => {
    setDemoBusy(key)
    setError(null)
    try {
      await signIn(email, DEMO_PASSWORD)
      navigate(from, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setDemoBusy(null)
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary-soft/60 to-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" aria-label="Comrade home">
          <Logo />
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft /> Back
          </Link>
        </Button>
      </div>
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-6 px-4 pb-12 pt-2 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:pt-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Sign in to Comrade</CardTitle>
              <CardDescription>Use your university email, admission number or staff number.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or admission number</Label>
                  <Input id="identifier" autoComplete="username" placeholder="e.g. BSCS/0123/2025" aria-invalid={!!formState.errors.identifier} {...register('identifier')} />
                  <FieldError>{formState.errors.identifier?.message}</FieldError>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register('password')} />
                  <FieldError>{formState.errors.password?.message}</FieldError>
                </div>
                {error && (
                  <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
                  <KeyRound /> Sign in
                </Button>
                <p className="text-center text-xs text-muted-foreground">You stay signed in on this tab until you sign out.</p>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {env.demoMode && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-gold/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-4 text-gold-foreground dark:text-gold" /> Demo accounts
                </CardTitle>
                <CardDescription>
                  One tap to sign in. Shared password: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{DEMO_PASSWORD}</code>. Tip: open a second tab and sign in as a student to watch notices arrive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((a) => {
                    const Icon = DEMO_ICON[a.key] ?? UserRound
                    return (
                      <li key={a.key}>
                        <button
                          type="button"
                          onClick={() => void demoLogin(a.email, a.key)}
                          disabled={!!demoBusy}
                          data-testid={`demo-${a.key}`}
                          className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft/50 disabled:opacity-60"
                        >
                          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{demoBusy === a.key ? 'Signing in…' : a.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{a.description}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
