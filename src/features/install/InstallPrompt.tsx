import { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Download, MonitorDown, PlusSquare, Share, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/overlays'
import { LogoMark } from '@/components/layout/Logo'
import { promptInstall, useInstall } from '@/lib/install'
import { haptic } from '@/lib/push'

const DISMISS_KEY = 'comrade.installDismissedAt'
const WEEK = 7 * 86_400_000

function recentlyDismissed() {
  const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
  return Date.now() - at < WEEK
}

/** Opens the native install prompt, or the iPhone instructions. Returns a click handler + the sheet. */
export function useInstallAction() {
  const state = useInstall()
  const [iosOpen, setIosOpen] = useState(false)
  const available = !state.standalone && (state.canPrompt || state.needsIosInstructions)
  const install = async () => {
    haptic()
    if (state.needsIosInstructions) return setIosOpen(true)
    const outcome = await promptInstall()
    if (outcome === 'accepted') toast.success('Comrade is installed', { description: 'Open it from your home screen or app list.' })
  }
  const sheet = <IosInstallSheet open={iosOpen} onOpenChange={setIosOpen} />
  return { available, install, sheet, state }
}

export function IosInstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const steps = [
    { icon: Share, text: (<>Tap the <strong>Share</strong> button in Safari's toolbar.</>) },
    { icon: PlusSquare, text: (<>Scroll down and tap <strong>Add to Home Screen</strong>.</>) },
    { icon: Smartphone, text: (<>Tap <strong>Add</strong>. Comrade now opens full-screen like any app.</>) },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Install Comrade on your iPhone" description="Safari installs web apps from the Share menu.">
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <s.icon className="size-4" />
              </span>
              <span>
                <span className="mr-1 font-semibold">{i + 1}.</span>
                {s.text}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">On an iPhone, use Safari: other iOS browsers can't add web apps to the home screen.</p>
      </DialogContent>
    </Dialog>
  )
}

/** Friendly in-app banner shown until the app is installed (dismiss hides it for a week). */
export function InstallBanner() {
  const { available, install, sheet, state } = useInstallAction()
  const [hidden, setHidden] = useState(recentlyDismissed)
  const show = available && !hidden
  const desktop = !state.needsIosInstructions && typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  return (
    <>
      <AnimatePresence>
        {show && (
          <m.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 rounded-xl border border-gold/50 bg-gold-soft/70 p-3 sm:p-4">
              <LogoMark className="size-10 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">Install the Comrade app</p>
                <p className="text-muted-foreground">{desktop ? 'Open it from your desktop or taskbar, in its own window.' : 'Open it from your home screen, full-screen and faster.'}</p>
              </div>
              <Button size="sm" onClick={() => void install()}>
                {desktop ? <MonitorDown /> : <Download />} Install
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Not now"
                onClick={() => {
                  localStorage.setItem(DISMISS_KEY, String(Date.now()))
                  setHidden(true)
                }}
              >
                <X />
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      {sheet}
    </>
  )
}
