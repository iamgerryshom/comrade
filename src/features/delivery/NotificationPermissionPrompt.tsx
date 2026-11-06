import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getServices } from '@/services'
import { useAuth } from '@/features/auth/AuthProvider'
import { notificationPermission, requestNotificationPermission } from '@/lib/push'

const DISMISS_KEY = 'comrade.notifPromptDismissed'

/** Polite, explained permission request: shown after login, never on first page load. */
export function NotificationPermissionPrompt() {
  const { profile } = useAuth()
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === '1' || notificationPermission() !== 'default')
  if (!profile || hidden) return null

  const enable = async () => {
    const p = await requestNotificationPermission()
    setHidden(true)
    if (p === 'granted') {
      await getServices().devices.registerDevice(profile.uid, { notificationsEnabled: true })
      toast.success('Notifications are on for this browser')
    } else if (p === 'denied') {
      toast('Notifications blocked', { description: "That's okay: important notices will still reach you by SMS." })
    }
  }
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary-soft/60 p-4 sm:flex-row sm:items-center">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden>
            <BellRing className="size-5" />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Get notices the moment they're sent</p>
            <p className="text-muted-foreground">Allow browser notifications so this device can confirm it received each notice. Otherwise Comrade has to send you an SMS.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void enable()}>Turn on</Button>
            <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Not now">
              <X />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
