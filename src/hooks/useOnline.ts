import { useSyncExternalStore } from 'react'
import { getServices } from '@/services'

/** Browser connectivity (navigator.onLine). */
export function useBrowserOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** Demo "Simulate offline" toggle for this tab/device. */
export function useSimulatedOffline(): [boolean, (on: boolean) => void] {
  const demo = getServices().demo
  const value = useSyncExternalStore(
    (cb) => demo?.onSimulateOfflineChange(cb) ?? (() => {}),
    () => demo?.isSimulatingOffline() ?? false,
    () => false,
  )
  return [value, (on) => demo?.setSimulateOffline(on)]
}

export function useIsOnline() {
  const browser = useBrowserOnline()
  const [simulated] = useSimulatedOffline()
  return { online: browser && !simulated, browser, simulated }
}
