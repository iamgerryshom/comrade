import { cn } from '@/lib/utils'

/** Comrade mark: a green rounded square with a gold notification dot. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M21.5 11.2a7 7 0 1 0 0 9.6" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" className="dark:stroke-[oklch(0.17_0.03_160)]" />
      <circle cx="24" cy="8" r="3.6" className="fill-gold stroke-primary" strokeWidth="1.5" />
    </svg>
  )
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-bold tracking-tight">Comrade</span>
          <span className="block text-[11px] font-medium text-muted-foreground">Kisii University</span>
        </span>
      )}
    </span>
  )
}
