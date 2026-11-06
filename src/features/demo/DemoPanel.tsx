import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Cpu, FlaskConical, RotateCcw, Smartphone, Timer, UserRound, WifiOff, ExternalLink } from 'lucide-react'
import { getServices } from '@/services'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/data/demoAccounts'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSettings } from '@/hooks/data'
import { useSimulatedOffline } from '@/hooks/useOnline'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays'
import { Separator, Switch } from '@/components/ui/primitives'
import { cn, errorMessage } from '@/lib/utils'

function useIsWorker() {
  const demo = getServices().demo
  return useSyncExternalStore(
    (cb) => demo?.onWorkerChange(cb) ?? (() => {}),
    () => demo?.isWorkerTab() ?? false,
  )
}

/** Floating demo tools (VITE_DEMO_MODE=true only). */
export function DemoPanel() {
  const demo = getServices().demo
  const { profile, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const [sim, setSim] = useSimulatedOffline()
  const [keep, setKeep] = useState(() => demo?.isKeepData() ?? false)
  const [busy, setBusy] = useState<string | null>(null)
  const isWorker = useIsWorker()
  if (!demo) return null

  const switchTo = async (email: string, key: string) => {
    setBusy(key)
    try {
      await signOut()
      await signIn(email, DEMO_PASSWORD)
      navigate('/home')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-40 inline-flex size-11 items-center justify-center gap-2 rounded-full border border-gold/60 bg-gold text-sm font-semibold text-gold-foreground shadow-lg hover:brightness-105 sm:bottom-5 sm:right-4 sm:w-auto sm:px-4"
          aria-label="Open demo panel"
        >
          <FlaskConical className="size-4" aria-hidden />
          <span className="hidden sm:inline">Demo</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="max-h-[75dvh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-0">
        <div className="border-b p-4">
          <p className="font-semibold">Demo panel</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cpu className="size-3.5" aria-hidden />
            {isWorker ? 'This tab runs the delivery worker (mock server).' : 'Another tab runs the delivery worker.'}
          </p>
        </div>

        <div className="space-y-4 p-4">
          <section aria-labelledby="demo-switch">
            <h3 id="demo-switch" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <UserRound className="size-3.5" /> Switch user
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <Button
                  key={a.key}
                  size="sm"
                  variant={profile?.uid === a.uid ? 'default' : 'outline'}
                  className="h-auto justify-start whitespace-normal py-1.5 text-left text-xs"
                  loading={busy === a.key}
                  onClick={() => void switchTo(a.email, a.key)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </section>

          {profile?.userType === 'STUDENT' && (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2">
                <WifiOff className="size-4 text-muted-foreground" /> Simulate offline (this tab)
              </span>
              <Switch checked={sim} onCheckedChange={setSim} />
            </label>
          )}

          <section aria-labelledby="demo-timeout">
            <h3 id="demo-timeout" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Timer className="size-3.5" /> ACK timeout: {settings?.ackTimeoutSeconds ?? '…'}s
            </h3>
            <div className="flex gap-1.5">
              {[10, 15, 30, 60].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={settings?.ackTimeoutSeconds === s ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => void demo.setAckTimeout(s).then(() => toast.success(`Timeout set to ${s}s for new notices`))}
                >
                  {s}s
                </Button>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-1.5">
            <Button variant="outline" size="sm" asChild className="justify-start">
              <Link to="/demo/sms">
                <Smartphone /> Open Mock SMS inbox
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="justify-start">
              <a href={`${import.meta.env.BASE_URL}login`} target="_blank" rel="noreferrer">
                <ExternalLink /> Open another tab (log in as someone else)
              </a>
            </Button>
          </div>

          <Separator />

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Keep demo data after refresh</span>
            <Switch
              checked={keep}
              onCheckedChange={(v) => {
                setKeep(v)
                void demo.setKeepData(v)
              }}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            className={cn('w-full text-destructive hover:text-destructive')}
            loading={busy === 'reset'}
            onClick={() => {
              if (!confirm('Reset all demo data in every open tab?')) return
              setBusy('reset')
              void demo.resetData().then(() => {
                setBusy(null)
                toast.success('Demo data reset')
              })
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
