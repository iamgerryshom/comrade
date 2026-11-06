import { Link, Navigate } from 'react-router'
import { motion } from 'framer-motion'
import { ArrowRight, BellRing, CheckCheck, Layers, MessageSquareText, ShieldCheck, Smartphone, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/layout/Logo'
import { useAuth } from './AuthProvider'

const FEATURES = [
  { icon: BellRing, title: 'Instant notices', body: 'Lecturers, departments and student leaders reach exactly the right students in seconds.' },
  { icon: MessageSquareText, title: 'SMS when you are offline', body: "If your device doesn't confirm a notice within 60 seconds, Comrade sends the key details by SMS." },
  { icon: Layers, title: 'Right people, every time', body: 'Target a school, department, course, year or a single unit, all from the official Kisii University structure.' },
  { icon: ShieldCheck, title: 'Safe by design', body: 'Scoped permissions, masked phone numbers and a full audit log for every privileged action.' },
]

export function WelcomePage() {
  const { status } = useAuth()
  if (status === 'signedIn') return <Navigate to="/home" replace />
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <Button asChild variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2 lg:pt-16">
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-soft px-3 py-1 text-xs font-medium text-gold-foreground dark:text-gold">
              <span className="size-1.5 rounded-full bg-gold" /> For Kisii University students & staff
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Never miss a class update, <span className="text-primary">even offline.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Comrade delivers official notices from your lecturers, department and student leaders. If your phone doesn't confirm a notice in time, it arrives by SMS instead.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/login">
                  Get started <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#how">How it works</a>
              </Button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="mx-auto w-full max-w-sm" aria-hidden>
            <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3 rounded-xl border bg-background p-3">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                  <BellRing className="size-4" />
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">COMP 210 CAT moved to Fri, 10am, LH3</p>
                  <p className="text-muted-foreground">Dr. Daniel Ogeto · Exam</p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-700 dark:text-green-300">
                  <CheckCheck className="size-3" /> Delivered
                </span>
              </div>
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <WifiOff className="size-3.5" /> No confirmation in 60s? Falling back to SMS…
              </div>
              <div className="rounded-xl bg-muted p-3 font-mono text-[12px] leading-relaxed">
                <p className="mb-1 flex items-center gap-1.5 font-sans text-xs font-medium text-muted-foreground">
                  <Smartphone className="size-3.5" /> SMS · COMRADE-KSU
                </p>
                [COMRADE-KSU] EXAM: COMP 210 CAT moved to Fri 14 Nov, 10am, LH3. From: Lecturer COMP210. Ref:K7Q2
              </div>
            </div>
          </motion.div>
        </section>

        <section id="how" className="border-t bg-card/50">
          <div className="mx-auto grid grid-cols-1 max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="rounded-xl border bg-card p-5 shadow-soft">
                <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden>
                  <f.icon className="size-5" />
                </span>
                <h2 className="font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">Comrade · Kisii University notification service (demo build)</footer>
    </div>
  )
}
