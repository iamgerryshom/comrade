import { useSyncExternalStore } from 'react'

/**
 * "Install Comrade" support:
 *  - Chrome / Edge / Samsung Internet (Android + desktop): capture `beforeinstallprompt` and show our own button.
 *  - iPhone / iPad Safari: no prompt API, so we show "Share → Add to Home Screen" instructions.
 *  - Already installed (standalone): hide everything.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Call as early as possible (main.jsx): the event fires once, soon after load. */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', notify)
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  const e = deferred
  deferred = null
  notify()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome
}

export interface InstallState {
  /** The browser offers a native install prompt right now. */
  canPrompt: boolean
  /** Running as an installed app. */
  standalone: boolean
  /** iOS: must use Share → Add to Home Screen. */
  needsIosInstructions: boolean
  installed: boolean
}

let snapshot: InstallState | null = null
function getState(): InstallState {
  const next: InstallState = {
    canPrompt: !!deferred,
    standalone: isStandalone(),
    needsIosInstructions: isIOS() && !isStandalone(),
    installed: installed || isStandalone(),
  }
  if (!snapshot || JSON.stringify(snapshot) !== JSON.stringify(next)) snapshot = next
  return snapshot
}

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getState,
    getState,
  )
}
