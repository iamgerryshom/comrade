import {
  BarChart3,
  Bell,
  BookOpen,
  Home,
  Layers,
  MessageSquareText,
  PenSquare,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  User,
  UserSearch,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Action } from '@/core/permissions'
import { env } from '@/lib/env'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Who sees it. */
  show: (ctx: NavCtx) => boolean
  group: 'main' | 'manage' | 'admin' | 'demo'
}

export interface NavCtx {
  can: (a: Action) => boolean
  isStudent: boolean
  canSend: boolean
}

export const NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home, show: () => true, group: 'main' },
  { to: '/inbox', label: 'Inbox', icon: Bell, show: () => true, group: 'main' },
  { to: '/units', label: 'My units', icon: BookOpen, show: (c) => c.isStudent, group: 'main' },
  { to: '/compose', label: 'Compose', icon: PenSquare, show: (c) => c.canSend, group: 'manage' },
  { to: '/sent', label: 'Sent notices', icon: Send, show: (c) => c.canSend, group: 'manage' },
  { to: '/lookup', label: 'Student lookup', icon: UserSearch, show: (c) => c.can('student.search_by_admission'), group: 'manage' },
  { to: '/explorer', label: 'Explorer', icon: Layers, show: (c) => c.can('directory.view'), group: 'manage' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, show: (c) => c.can('analytics.view'), group: 'manage' },
  { to: '/admin/users', label: 'Users & roles', icon: Users, show: (c) => c.can('user.manage'), group: 'admin' },
  { to: '/admin/sms', label: 'SMS logs', icon: MessageSquareText, show: (c) => c.can('sms_logs.view'), group: 'admin' },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, show: (c) => c.can('audit.view'), group: 'admin' },
  { to: '/admin/settings', label: 'Settings', icon: Settings, show: (c) => c.can('settings.manage'), group: 'admin' },
  { to: '/demo/sms', label: 'Mock SMS inbox', icon: Smartphone, show: () => env.demoMode, group: 'demo' },
  { to: '/profile', label: 'Profile', icon: User, show: () => true, group: 'main' },
]

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  main: '',
  manage: 'Notices & people',
  admin: 'Administration',
  demo: 'Demo tools',
}

export { ShieldCheck }
