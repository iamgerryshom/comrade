import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from 'sonner'
import { LazyMotion } from 'framer-motion'
import { canSendAtAll } from '@/core/permissions'
import { idbPersister, PERSISTED_KEYS } from '@/lib/queryPersist'
import { useTheme } from '@/hooks/useTheme'
import { TooltipProvider } from '@/components/ui/primitives'
import { ErrorBoundary } from '@/components/common'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ForbiddenPage, FullPageLoader, NotFoundPage, RequireAuth, RequirePermission } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'
import './App.css'

// Route-level code splitting keeps the first load small on mobile data
const named = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))
const AppShell = named(() => import('@/components/layout/AppShell'), 'AppShell')
const HomePage = named(() => import('@/features/home/HomePage'), 'HomePage')
const InboxPage = named(() => import('@/features/inbox/InboxPage'), 'InboxPage')
const NoticePage = named(() => import('@/features/inbox/NoticePage'), 'NoticePage')
const ShortCodePage = named(() => import('@/features/inbox/NoticePage'), 'ShortCodePage')
const ComposePage = named(() => import('@/features/compose/ComposePage'), 'ComposePage')
const SentPage = named(() => import('@/features/delivery/SentPage'), 'SentPage')
const TimelinePage = named(() => import('@/features/delivery/TimelinePage'), 'TimelinePage')
const MyUnitsPage = named(() => import('@/features/explorer/MyUnitsPage'), 'MyUnitsPage')
const ExplorerPage = named(() => import('@/features/explorer/ExplorerPage'), 'ExplorerPage')
const LookupPage = named(() => import('@/features/lookup/LookupPage'), 'LookupPage')
const AnalyticsPage = named(() => import('@/features/analytics/AnalyticsPage'), 'AnalyticsPage')
const UsersPage = named(() => import('@/features/admin/UsersPage'), 'UsersPage')
const SmsLogsPage = named(() => import('@/features/admin/LogsPages'), 'SmsLogsPage')
const AuditLogPage = named(() => import('@/features/admin/LogsPages'), 'AuditLogPage')
const SettingsPage = named(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const ProfilePage = named(() => import('@/features/settings/ProfilePage'), 'ProfilePage')
const MockSmsInboxPage = named(() => import('@/features/demo/MockSmsInboxPage'), 'MockSmsInboxPage')

// Animation features load after first paint
const loadMotion = () => import('framer-motion').then((m) => m.domMax)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 24 * 60 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

if (import.meta.env.DEV) Object.assign(window, { __qc: queryClient })

const senders = (a) => !!a.claims && canSendAtAll(a.claims)
const students = (a) => a.claims?.userType === 'STUDENT'

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
}

function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: idbPersister,
          maxAge: 24 * 60 * 60_000,
          buster: 'comrade-v1',
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED_KEYS.includes(String(q.queryKey[0])) },
        }}
      >
        <LazyMotion features={loadMotion} strict>
        <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route element={<RequireAuth />}>
                  <Route element={<Suspense fallback={<FullPageLoader />}><AppShell /></Suspense>}>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/inbox" element={<InboxPage />} />
                    <Route path="/notice/:id" element={<NoticePage />} />
                    <Route path="/n/:code" element={<ShortCodePage />} />
                    <Route path="/units" element={<RequirePermission when={students}><MyUnitsPage /></RequirePermission>} />
                    <Route path="/compose" element={<RequirePermission action="notification.send" when={senders}><ComposePage /></RequirePermission>} />
                    <Route path="/sent" element={<RequirePermission when={senders}><SentPage /></RequirePermission>} />
                    <Route path="/sent/:id" element={<RequirePermission when={senders}><TimelinePage /></RequirePermission>} />
                    <Route path="/lookup" element={<RequirePermission action="student.search_by_admission"><LookupPage /></RequirePermission>} />
                    <Route path="/explorer" element={<RequirePermission action="directory.view"><ExplorerPage /></RequirePermission>} />
                    <Route path="/analytics" element={<RequirePermission action="analytics.view"><AnalyticsPage /></RequirePermission>} />
                    <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
                    <Route path="/admin/users" element={<RequirePermission action="user.manage"><UsersPage /></RequirePermission>} />
                    <Route path="/admin/sms" element={<RequirePermission action="sms_logs.view"><SmsLogsPage /></RequirePermission>} />
                    <Route path="/admin/audit" element={<RequirePermission action="audit.view"><AuditLogPage /></RequirePermission>} />
                    <Route path="/admin/settings" element={<RequirePermission action="settings.manage"><SettingsPage /></RequirePermission>} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/demo/sms" element={<MockSmsInboxPage />} />
                    <Route path="/403" element={<ForbiddenPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        </LazyMotion>
        <ThemedToaster />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
