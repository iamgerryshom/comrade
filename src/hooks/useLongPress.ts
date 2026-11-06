import { useRef } from 'react'
import { haptic } from '@/lib/push'

/** Long-press (≈450 ms, cancelled by moving) for touch quick-action menus. Also opens on right-click. */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => {
    clearTimeout(timer.current)
    origin.current = null
  }
  return {
    /** True if the last press became a long-press (use it to skip the click). */
    consumed: () => {
      const f = fired.current
      fired.current = false
      return f
    },
    handlers: {
      onTouchStart: (e: React.TouchEvent) => {
        fired.current = false
        origin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        timer.current = setTimeout(() => {
          fired.current = true
          haptic('success')
          onLongPress()
        }, ms)
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (!origin.current) return
        const dx = Math.abs(e.touches[0].clientX - origin.current.x)
        const dy = Math.abs(e.touches[0].clientY - origin.current.y)
        if (dx > 10 || dy > 10) clear()
      },
      onTouchEnd: clear,
      onTouchCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault()
        // Android fires contextmenu after a long-press too: don't open twice
        if (fired.current) return
        fired.current = true
        onLongPress()
      },
    },
  }
}
