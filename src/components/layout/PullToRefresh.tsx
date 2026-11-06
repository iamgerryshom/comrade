import { useRef, useState, type ReactNode } from 'react'
import { m, useMotionValue, useTransform, animate } from 'framer-motion'
import { ArrowDown, Loader2 } from 'lucide-react'
import { haptic } from '@/lib/push'

const THRESHOLD = 72
const MAX = 110

/**
 * Native-style pull-to-refresh for touch screens. Only engages when the page is scrolled to the
 * very top and the gesture is mostly vertical; mouse/trackpad users are unaffected.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const y = useMotionValue(0)
  const rotate = useTransform(y, [0, THRESHOLD], [0, 180])
  const opacity = useTransform(y, [0, 24, THRESHOLD], [0, 0.6, 1])
  const start = useRef<{ x: number; y: number } | null>(null)
  const armed = useRef(false)
  const [refreshing, setRefreshing] = useState(false)
  const [ready, setReady] = useState(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing || window.scrollY > 0) return
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    armed.current = false
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || refreshing) return
    const dy = e.touches[0].clientY - start.current.y
    const dx = Math.abs(e.touches[0].clientX - start.current.x)
    if (!armed.current && (dy < 8 || dx > dy)) return
    armed.current = true
    const pulled = Math.min(MAX, Math.max(0, dy * 0.5))
    y.set(pulled)
    const isReady = pulled >= THRESHOLD
    if (isReady !== ready) {
      setReady(isReady)
      if (isReady) haptic()
    }
  }
  const onTouchEnd = async () => {
    if (!start.current) return
    start.current = null
    if (y.get() >= THRESHOLD) {
      setRefreshing(true)
      void animate(y, 56, { duration: 0.15 })
      try {
        await Promise.all([onRefresh(), new Promise((r) => setTimeout(r, 500))])
        haptic('success')
      } finally {
        setRefreshing(false)
        setReady(false)
        void animate(y, 0, { duration: 0.25 })
      }
    } else {
      setReady(false)
      void animate(y, 0, { duration: 0.2 })
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => void onTouchEnd()} onTouchCancel={() => void onTouchEnd()} className="relative">
      <m.div style={{ height: y, opacity }} className="flex items-end justify-center overflow-hidden" aria-hidden={!refreshing}>
        <span className="mb-2 inline-flex size-9 items-center justify-center rounded-full border bg-card shadow-soft">
          {refreshing ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <m.span style={{ rotate }}>
              <ArrowDown className="size-4 text-primary" />
            </m.span>
          )}
        </span>
      </m.div>
      {refreshing && <span className="sr-only" role="status">Refreshing</span>}
      {children}
    </div>
  )
}
