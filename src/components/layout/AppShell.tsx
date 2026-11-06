import { Suspense, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router'
import { AnimatePresence, m } from 'framer-motion'
import {
  ArrowLeft,
  LayoutGrid,
  Bell,
  Download,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Sun,
  User as UserIcon,
  WifiOff,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { canSendAtAll } from '@/core/permissions'
import { POSITION_LABEL, ROLE_LABEL } from '@/core/labels'
import { useInbox } from '@/hooks/data'
import { useIsOnline, useSimulatedOffline } from '@/hooks/useOnline'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { haptic } from '@/lib/push'
import { useIsTabletUp } from '@/hooks/useMediaQuery'
import { env } from '@/lib/env'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays'
import { Separator, Switch, Tooltip } from '@/components/ui/primitives'
import { ErrorBoundary, PageSkeleton, RoleBadge, UserAvatar, UserTypeBadge } from '@/components/common'
import { DeliveryAgent } from '@/features/delivery/DeliveryAgent'
import { NotificationPermissionPrompt } from '@/features/delivery/NotificationPermissionPrompt'
import { DemoPanel } from '@/features/demo/DemoPanel'
import { InstallBanner, useInstallAction } from '@/features/install/InstallPrompt'
import { ScrollManager } from './ScrollManager'
import { GROUP_LABEL, NAV, type NavItem } from './nav'
import { CommandPalette } from './CommandPalette'
import { Logo } from './Logo'

/** Detail screens get a native back arrow + title in the top bar on phones. */
const DETAIL_ROUTES: Array<[RegExp, string, string]> = [
  [/^\/notice\//, 'Notice', '/inbox'],
  [/^\/n\//, 'Notice', '/inbox'],
  [/^\/sent\/.+/, 'Delivery', '/sent'],
]
function useDetailRoute() {
  const { pathname } = useLocation()
  const hit = DETAIL_ROUTES.find(([re]) => re.test(pathname))
  return hit ? { title: hit[1], parent: hit[2] } : null
}

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
  const { profile, claims } = useAuth()
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className={cn('flex h-16 items-center gap-2 px-4', collapsed && 'justify-center px-0')}>
        <Link to="/home" aria-label="Comrade home">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2', collapsed && 'px-2')}>
        <NavList items={items} collapsed={collapsed} />
      </div>
      <div className={cn('flex items-center gap-2 border-t p-3', collapsed && 'flex-col')}>
        {profile && claims && (
          <Link to="/profile" className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent', collapsed && 'flex-none')} aria-label="Your profile">
            <UserAvatar name={profile.name} userType={profile.userType} leader={claims.positions.length > 0} className="size-8" />
            {!collapsed && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-medium">{profile.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {claims.positions.length ? POSITION_LABEL[claims.positions[0]] : ROLE_LABEL[profile.role]}
                </span>
              </span>
            )}
          </Link>
        )}
        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
        </Button>
      </div>
    </aside>
  )
}

/** The 3 most-used destinations for this user; everything else lives under "More". */
function usePrimaryTabs() {
  const { claims, can } = useAuth()
  const sender = !!claims && canSendAtAll(claims)
  const isStudent = claims?.userType === 'STUDENT'
  const third = sender ? '/compose' : isStudent ? '/units' : can('directory.view') ? '/explorer' : '/profile'
  return ['/home', '/inbox', third]
}

function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const unread = useUnread()
  const tabs = usePrimaryTabs()
  const { pathname } = useLocation()
  const items = tabs.map((to) => NAV.find((n) => n.to === to)!).filter(Boolean)
  const inMore = !tabs.some((t) => pathname === t || pathname.startsWith(t + '/')) && !DETAIL_ROUTES.some(([re]) => re.test(pathname))
  const tabClass = (active: boolean) =>
    cn('relative flex h-16 w-full select-none flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors', active && 'text-primary')
  return (
    <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/90 backdrop-blur-lg safe-bottom sm:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} onClick={() => haptic()} className={({ isActive }) => tabClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span className={cn('relative flex h-8 w-14 items-center justify-center rounded-full transition-colors', isActive && 'bg-primary-soft')}>
                    <item.icon className="size-[21px]" aria-hidden />
                    {item.to === '/inbox' && unread > 0 && (
                      <span className="absolute -top-1 right-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? '99+' : unread}</span>
                    )}
                  </span>
                  {item.label === 'My units' ? 'Units' : item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => { haptic(); onMore() }} className={tabClass(inMore || moreOpen)} aria-haspopup="dialog" aria-expanded={moreOpen}>
            <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition-colors', (inMore || moreOpen) && 'bg-primary-soft')}>
              <LayoutGrid className="size-[21px]" aria-hidden />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Phone "More" sheet: every other destination as a tidy grid, plus account actions. */
function MoreSheet({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const items = useNavItems()
  const tabs = usePrimaryTabs()
  const navigate = useNavigate()
  const { profile, claims, signOut } = useAuth()
  const { resolved, setTheme } = useTheme()
  const rest = items.filter((i) => !tabs.includes(i.to))
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="More" hideClose>
        {profile && claims && (
          <button type="button" onClick={() => go('/profile')} className="mb-4 flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left">
            <UserAvatar name={profile.name} userType={profile.userType} leader={claims.positions.length > 0} className="size-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{profile.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{profile.admissionNumber ?? profile.title ?? profile.email}</span>
            </span>
            <RoleBadge role={profile.role} userType={profile.userType} positions={claims.positions} />
          </button>
        )}
        <div className="grid grid-cols-3 gap-2">
          {rest
            .filter((i) => i.to !== '/profile')
            .map((i) => (
              <button key={i.to} type="button" onClick={() => go(i.to)} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-2 text-center text-xs font-medium hover:bg-accent">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <i.icon className="size-[18px]" aria-hidden />
                </span>
                <span className="leading-tight">{i.label}</span>
              </button>
            ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>
            {resolved === 'dark' ? <Sun /> : <Moon />} {resolved === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => void signOut().then(() => go('/login'))}>
            <LogOut /> Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const detail = useDetailRoute()
  const install = useInstallAction()
  if (!profile || !claims) return null
  const goBack = () => {
    haptic()
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(detail?.parent ?? '/home')
  }
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-lg safe-top">
      <div className="flex h-14 items-center gap-1 px-2 sm:h-16 sm:gap-2 sm:px-4 lg:px-6">
      {/* Phones: back + title on detail screens, else the logo */}
      {detail ? (
        <div className="flex min-w-0 items-center gap-1 sm:hidden">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
            <ArrowLeft className="size-5" />
          </Button>
          <p className="truncate text-base font-semibold">{detail.title}</p>
        </div>
      ) : (
        <Link to="/home" className="pl-2 sm:hidden" aria-label="Comrade home">
          <Logo />
        </Link>
      )}
      {/* Tablets: menu + logo (no sidebar, no bottom nav) */}
      <div className="hidden items-center gap-1 sm:flex lg:hidden">
        <Button variant="ghost" size="icon" onClick={onMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <Link to="/home" aria-label="Comrade home">
          <Logo />
        </Link>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="ml-2 hidden h-10 w-full max-w-sm items-center gap-2 rounded-xl border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-accent md:flex"
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

        {!online && (
          <span role="status" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <WifiOff className="size-3.5" aria-hidden /> {simulated ? 'Offline (demo)' : 'Offline'}
          </span>
        )}

        <Button variant="ghost" size="icon" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode" className="hidden sm:inline-flex">
          {resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex" onClick={() => navigate('/inbox')} aria-label={`Inbox, ${unread} unread`}>
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
                {(profile.userType === 'STAFF' || claims.positions.length > 0) && <UserTypeBadge userType={profile.userType} />}
                <RoleBadge role={profile.role} userType={profile.userType} positions={claims.positions} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/profile')}>
              <UserIcon /> Profile & preferences
            </DropdownMenuItem>
            {install.available && (
              <DropdownMenuItem onSelect={() => void install.install()}>
                <Download /> Install Comrade app
              </DropdownMenuItem>
            )}
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
      </div>
      {install.sheet}
    </header>
  )
}

function OfflineBanner() {
  const { online, simulated } = useIsOnline()
  return (
    <AnimatePresence>
      {!online && (
        <m.div
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
        </m.div>
      )}
    </AnimatePresence>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('comrade.sidebar') === 'collapsed')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const items = useNavItems()
  const location = useLocation()
  const navType = useNavigationType()
  const tabletUp = useIsTabletUp()
  const isDetail = DETAIL_ROUTES.some(([re]) => re.test(location.pathname))
  // Phones: detail screens slide in from the right, going back slides from the left, tabs fade
  const enter = tabletUp ? { opacity: 0, y: 6 } : navType === 'POP' ? { opacity: 0, x: -28 } : isDetail ? { opacity: 0, x: 28 } : { opacity: 0 }
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
        <InstallBanner />
        <main id="main" className="pb-bottom-nav mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <m.div key={location.pathname} initial={enter} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
                <Outlet />
              </m.div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} setOpen={setMoreOpen} />

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent title="Menu" side="left" className="bg-sidebar">
          <NavList items={items} onNavigate={() => setMenuOpen(false)} />
          <Separator className="my-4" />
          <p className="px-3 text-xs text-muted-foreground">Comrade · Kisii University</p>
        </DialogContent>
      </Dialog>
      <CommandPalette open={searchOpen} setOpen={setSearchOpen} items={items} />
      <ScrollManager />
      <DeliveryAgent />
      {env.demoMode && <DemoPanel />}
    </div>
  )
}
