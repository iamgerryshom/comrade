import { Suspense, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Sun,
  User as UserIcon,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { canSendAtAll } from '@/core/permissions'
import { useInbox } from '@/hooks/data'
import { useIsOnline, useSimulatedOffline } from '@/hooks/useOnline'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { env } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays'
import { Separator, Switch, Tooltip } from '@/components/ui/primitives'
import { ErrorBoundary, PageSkeleton, RoleBadge, UserAvatar, UserTypeBadge } from '@/components/common'
import { DeliveryAgent } from '@/features/delivery/DeliveryAgent'
import { NotificationPermissionPrompt } from '@/features/delivery/NotificationPermissionPrompt'
import { DemoPanel } from '@/features/demo/DemoPanel'
import { GROUP_LABEL, NAV, type NavItem } from './nav'
import { CommandPalette } from './CommandPalette'
import { Logo } from './Logo'

function useNavItems() {
  const { can, claims } = useAuth()
  return useMemo(() => {
    const ctx = { can, isStudent: claims?.userType === 'STUDENT', canSend: !!claims && canSendAtAll(claims) }
    return NAV.filter((n) => n.show(ctx))
  }, [can, claims])
}

function useUnread() {
  const { profile } = useAuth()
  const { data } = useInbox(profile?.uid)
  return data?.filter((d) => !d.readAt && !d.archivedAt).length ?? 0
}

function NavList({ items, collapsed, onNavigate }: { items: NavItem[]; collapsed?: boolean; onNavigate?: () => void }) {
  const unread = useUnread()
  const groups = (['main', 'manage', 'admin', 'demo'] as const).map((g) => ({ g, items: items.filter((i) => i.group === g) })).filter((x) => x.items.length)
  return (
    <nav aria-label="Main" className="flex flex-col gap-4">
      {groups.map(({ g, items: its }) => (
        <div key={g} className="flex flex-col gap-0.5">
          {GROUP_LABEL[g] && !collapsed && <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{GROUP_LABEL[g]}</p>}
          {its.map((item) => {
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    isActive && 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {item.to === '/inbox' && unread > 0 && (
                  <span className={cn('ml-auto rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums', collapsed && 'absolute right-1 top-1 ml-0 px-1 text-[10px] leading-4')}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </NavLink>
            )
            return collapsed ? (
              <Tooltip key={item.to} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Sidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const items = useNavItems()
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className={cn('flex h-16 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <Link to="/home" aria-label="Comrade home">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 pb-4', collapsed && 'px-2')}>
        <NavList items={items} collapsed={collapsed} />
      </div>
      <div className="border-t p-3">
        <Button variant="ghost" size="sm" className={cn('w-full justify-start text-muted-foreground', collapsed && 'justify-center')} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          {!collapsed && 'Collapse'}
        </Button>
      </div>
    </aside>
  )
}

function BottomNav() {
  const { claims, can } = useAuth()
  const unread = useUnread()
  const sender = !!claims && canSendAtAll(claims)
  const isStudent = claims?.userType === 'STUDENT'
  const items = NAV.filter((n) =>
    ['/home', '/inbox', '/profile'].includes(n.to) ||
    (n.to === '/compose' && sender) ||
    (n.to === '/units' && isStudent && !sender) ||
    (n.to === '/explorer' && !sender && !isStudent && can('directory.view')),
  )
  const order = ['/home', '/inbox', '/units', '/compose', '/explorer', '/profile']
  items.sort((a, b) => order.indexOf(a.to) - order.indexOf(b.to))
  return (
    <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur safe-bottom sm:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => cn('relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground', isActive && 'text-primary')}
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="bottom-active" className="absolute top-0 h-0.5 w-10 rounded-full bg-primary" />}
                  <span className="relative">
                    <item.icon className="size-[22px]" aria-hidden />
                    {item.to === '/inbox' && unread > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? '99+' : unread}</span>
                    )}
                  </span>
                  {item.label === 'My units' ? 'Units' : item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ThemeMenuItems() {
  const { theme, setTheme } = useTheme()
  const opts = [
    { v: 'light' as const, label: 'Light', icon: Sun },
    { v: 'dark' as const, label: 'Dark', icon: Moon },
    { v: 'system' as const, label: 'System', icon: Monitor },
  ]
  return (
    <>
      {opts.map((o) => (
        <DropdownMenuItem key={o.v} onSelect={() => setTheme(o.v)} className={cn(theme === o.v && 'font-semibold text-primary')}>
          <o.icon /> {o.label} {theme === o.v && <span className="sr-only">(current)</span>}
        </DropdownMenuItem>
      ))}
    </>
  )
}

function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { profile, claims, signOut } = useAuth()
  const { online, simulated } = useIsOnline()
  const [sim, setSim] = useSimulatedOffline()
  const { resolved, setTheme } = useTheme()
  const unread = useUnread()
  const navigate = useNavigate()
  const isStudent = claims?.userType === 'STUDENT'
  if (!profile || !claims) return null
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur safe-top sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <Link to="/home" className="lg:hidden" aria-label="Comrade home">
        <Logo compact className="sm:hidden" />
        <Logo className="hidden sm:flex" />
      </Link>

      <button
        type="button"
        onClick={onSearch}
        className="ml-2 hidden h-10 w-full max-w-sm items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs hover:bg-accent md:flex"
      >
        <Search className="size-4" aria-hidden />
        <span>Search notices, pages…</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onSearch} aria-label="Search">
          <Search className="size-5" />
        </Button>

        {env.demoMode && isStudent && (
          <label className="hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium sm:flex" title="Demo: this device stops confirming receipt, so the SMS fallback kicks in">
            <WifiOff className="size-3.5 text-muted-foreground" aria-hidden />
            Simulate offline
            <Switch checked={sim} onCheckedChange={setSim} aria-label="Simulate offline" className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-4" />
          </label>
        )}

        <Tooltip content={online ? 'Online' : simulated ? 'Offline (simulated)' : 'Offline'}>
          <span className={cn('inline-flex size-9 items-center justify-center rounded-lg', online ? 'text-green-600 dark:text-green-400' : 'text-amber-600')} role="status" aria-label={online ? 'Online' : 'Offline'}>
            {online ? <Wifi className="size-[18px]" /> : <WifiOff className="size-[18px]" />}
          </span>
        </Tooltip>

        <Button variant="ghost" size="icon" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode" className="hidden sm:inline-flex">
          {resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/inbox')} aria-label={`Inbox, ${unread} unread`}>
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? '99+' : unread}</span>}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full" aria-label="Account menu">
              <UserAvatar name={profile.name} userType={profile.userType} leader={claims.positions.length > 0} className="size-8" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <p className="truncate font-semibold">{profile.name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <UserTypeBadge userType={profile.userType} />
                <RoleBadge role={profile.role} userType={profile.userType} positions={claims.positions} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <UserIcon /> Profile & preferences
            </DropdownMenuItem>
            {env.demoMode && isStudent && (
              <DropdownMenuItem className="sm:hidden" onSelect={(e) => { e.preventDefault(); setSim(!sim) }}>
                <WifiOff /> Simulate offline: {sim ? 'on' : 'off'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <ThemeMenuItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut().then(() => navigate('/login'))}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function OfflineBanner() {
  const { online, simulated } = useIsOnline()
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          role="status"
          className="overflow-hidden border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        >
          <div className="flex items-start gap-2 px-4 py-2 text-sm sm:items-center lg:px-6">
            <WifiOff className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
            <p>
              <span className="font-medium">{simulated ? 'Simulating offline. ' : "You're offline. "}</span>
              {simulated ? "This device won't confirm new notices, so they'll reach you by SMS." : 'Showing saved notices. Urgent notices still reach you by SMS.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('comrade.sidebar') === 'collapsed')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const items = useNavItems()
  const location = useLocation()
  const setCol = (v: boolean) => {
    setCollapsed(v)
    localStorage.setItem('comrade.sidebar', v ? 'collapsed' : 'open')
  }
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} setCollapsed={setCol} />
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <TopBar onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} />
        <OfflineBanner />
        <NotificationPermissionPrompt />
        <main id="main" className="pb-bottom-nav mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <Outlet />
              </motion.div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav />

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent title="Menu" side="left" className="bg-sidebar">
          <NavList items={items} onNavigate={() => setMenuOpen(false)} />
          <Separator className="my-4" />
          <p className="px-3 text-xs text-muted-foreground">Comrade · Kisii University</p>
        </DialogContent>
      </Dialog>
      <CommandPalette open={searchOpen} setOpen={setSearchOpen} items={items} />
      <DeliveryAgent />
      {env.demoMode && <DemoPanel />}
    </div>
  )
}
