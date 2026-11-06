import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const positions = new Map<string, number>()

/**
 * App-like scrolling: a new screen starts at the top; going back (browser/Android back button)
 * returns to exactly where you were.
 */
export function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()

  useLayoutEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const key = location.key
    const saved = positions.get(key)
    if (navType === 'POP' && saved !== undefined) {
      // Wait a frame for the page (and lazy content) to lay out
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)))
    } else {
      window.scrollTo(0, 0)
    }
    return () => {
      positions.set(key, window.scrollY)
    }
  }, [location.key, navType])

  return null
}
