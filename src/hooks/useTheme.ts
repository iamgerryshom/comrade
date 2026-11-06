import { useCallback, useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'comrade.theme'
const listeners = new Set<() => void>()

function pref(): ThemePref {
  return (localStorage.getItem(KEY) as ThemePref) ?? 'system'
}
function resolved(p: ThemePref) {
  return p === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p
}

export function applyTheme() {
  const dark = resolved(pref()) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1a15' : '#116a3f')
}

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme()
    listeners.forEach((l) => l())
  })
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    pref,
    () => 'system' as ThemePref,
  )
  const setTheme = useCallback((t: ThemePref) => {
    localStorage.setItem(KEY, t)
    applyTheme()
    listeners.forEach((l) => l())
  }, [])
  return { theme, resolved: typeof window === 'undefined' ? 'light' : resolved(theme), setTheme }
}
