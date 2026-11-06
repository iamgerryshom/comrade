import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { getServices, type Unsubscribe } from '@/services'
import type { AppSettings, AudienceRule, AuditLog, Delivery, Device, Notification, SmsMessage } from '@/types'
import type { DraftInput, ProfileInput, SendNotificationInput, SettingsInput, UserInput, PositionInput } from '@/core/schemas'

/**
 * Data hooks. UI components use these; they never touch the store or Firebase directly.
 * Live data (onSnapshot-style subscriptions) is written into the TanStack Query cache so it is
 * shared between components and persisted for offline use.
 */

const svc = () => getServices()

/** Bridge a subscription into the query cache. */
export function useLive<T>(key: QueryKey, subscribe: ((cb: (v: T) => void) => Unsubscribe) | null) {
  const qc = useQueryClient()
  const hash = JSON.stringify(key)
  useEffect(() => {
    if (!subscribe) return
    return subscribe((v) => qc.setQueryData(key, v))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, !!subscribe])
  return useQuery<T>({
    queryKey: key,
    enabled: !!subscribe,
    staleTime: Infinity,
    queryFn: () =>
      new Promise<T>((resolve) => {
        const off = subscribe!((v) => {
          resolve(v)
          queueMicrotask(() => off())
        })
      }),
  })
}

// ───────── Directory ─────────
export const useHierarchy = () => useQuery({ queryKey: ['hierarchy'], queryFn: () => svc().directory.getHierarchy(), staleTime: Infinity })

export function useHierarchyIndex() {
  const { data } = useHierarchy()
  return useMemo(() => {
    if (!data) return null
    const map = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]))
    return { ...data, schoolById: map(data.schools), facultyById: map(data.faculties), courseById: map(data.courses), unitById: map(data.units) }
  }, [data])
}

export const useMyUnits = (uid?: string) => useQuery({ queryKey: ['myUnits', uid], queryFn: () => svc().directory.getMyUnits(), enabled: !!uid })
export const useMyPositions = (uid?: string) => useQuery({ queryKey: ['myPositions', uid], queryFn: () => svc().directory.listMyPositions(), enabled: !!uid })

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (i: ProfileInput) => svc().directory.updateProfile(i), onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }) })
}

// ───────── Inbox / notices ─────────
export const useInbox = (uid?: string) => useLive<Delivery[]>(['inbox', uid], uid ? (cb) => svc().notifications.subscribeToInbox(uid, cb) : null)
export const useSent = (uid?: string) => useLive<Notification[]>(['sent', uid], uid ? (cb) => svc().notifications.subscribeToSent(uid, cb) : null)
export const useNotice = (id?: string) => useQuery({ queryKey: ['notice', id], queryFn: () => svc().notifications.getNotice(id!), enabled: !!id })
export const useNotificationLive = (id?: string) => useLive<Notification | null>(['notification', id], id ? (cb) => svc().notifications.subscribeToNotification(id, cb) : null)
export const useNotificationDeliveries = (id?: string) =>
  useLive<Delivery[]>(['deliveries', id], id ? (cb) => svc().deliveries.subscribeToNotificationDeliveries(id, cb) : null)

export function useMarkRead(uid?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deliveryId: string) => svc().deliveries.markRead(deliveryId),
    // Optimistic: flip it in the cached inbox immediately
    onMutate: (deliveryId) => {
      qc.setQueryData<Delivery[]>(['inbox', uid], (old) =>
        old?.map((d) => (d.id === deliveryId && !d.readAt ? { ...d, readAt: new Date(), status: d.status === 'DELIVERED' || d.status === 'PUSHED' || d.status === 'PENDING' ? 'READ' : d.status } : d)),
      )
    },
  })
}

export function useArchive(uid?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => svc().deliveries.archive(id, archived),
    onMutate: ({ id, archived }) => {
      qc.setQueryData<Delivery[]>(['inbox', uid], (old) => old?.map((d) => (d.id === id ? { ...d, archivedAt: archived ? new Date() : null } : d)))
    },
  })
}

// ───────── Compose ─────────
export function useAudiencePreview(rule: AudienceRule | null) {
  return useQuery({
    queryKey: ['audiencePreview', rule],
    queryFn: () => svc().functions.previewAudience(rule!),
    enabled: !!rule && !!rule.targetId && (rule.targetType !== 'COURSE_YEAR' || !!rule.yearOfStudy),
    retry: false,
    staleTime: 10_000,
  })
}
export const useSendQuota = (uid?: string) => useQuery({ queryKey: ['quota', uid], queryFn: () => svc().functions.getSendQuota(), enabled: !!uid })
export const useDrafts = (uid?: string) => useQuery({ queryKey: ['drafts', uid], queryFn: () => svc().notifications.listDrafts(), enabled: !!uid })
export const useSavedGroups = (uid?: string) => useQuery({ queryKey: ['groups', uid], queryFn: () => svc().notifications.listSavedGroups(), enabled: !!uid })

export function useSendNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: SendNotificationInput) => svc().functions.sendNotification(i),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['drafts'] })
      void qc.invalidateQueries({ queryKey: ['quota'] })
    },
  })
}
export function useSaveDraft() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (i: DraftInput) => svc().notifications.saveDraft(i), onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }) })
}
export function useDeleteDraft() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => svc().notifications.deleteDraft(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts'] }) })
}

// ───────── Lookup / explorer / analytics ─────────
export const useLookupStudent = () => useMutation({ mutationFn: (admissionNumber: string) => svc().functions.lookupStudent({ admissionNumber }) })
export const useNodeDetails = (scope: import('@/types').Scope | null) =>
  useQuery({ queryKey: ['node', scope], queryFn: () => svc().functions.getNodeDetails({ scope: scope! }), enabled: !!scope, retry: false })
export const useAnalytics = (enabled: boolean) =>
  useQuery({ queryKey: ['analytics'], queryFn: () => svc().functions.getAnalytics(), enabled, refetchInterval: 15_000 })

// ───────── SMS / audit / settings / devices ─────────
export const useSmsInbox = (enabled = true) => useLive<SmsMessage[]>(['smsInbox'], enabled ? (cb) => svc().sms.subscribeToSmsInbox(cb) : null)
export const useSmsLogs = (enabled = true) => useLive<SmsMessage[]>(['smsLogs'], enabled ? (cb) => svc().sms.subscribeToSmsLogs(cb) : null)
export const useAuditLogs = (enabled = true) => useLive<AuditLog[]>(['auditLogs'], enabled ? (cb) => svc().audit.subscribeToAuditLogs(cb) : null)
export const useSettings = () => useLive<AppSettings>(['settings'], (cb) => svc().settings.subscribeToSettings(cb))
export const useDevices = (uid?: string) => useLive<Device[]>(['devices', uid], uid ? (cb) => svc().devices.subscribeToDevices(uid, cb) : null)

export function useUpdateSettings() {
  return useMutation({ mutationFn: (i: SettingsInput) => svc().functions.updateSettings(i) })
}

// ───────── Admin ─────────
export const useAdminUsers = (enabled: boolean) => useQuery({ queryKey: ['admin', 'users'], queryFn: () => svc().functions.adminListUsers(), enabled })
export const useAdminPositions = (enabled: boolean) => useQuery({ queryKey: ['admin', 'positions'], queryFn: () => svc().functions.adminListPositions(), enabled })
export function useAdminMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] })
  return {
    saveUser: useMutation({ mutationFn: (i: UserInput) => svc().functions.adminSaveUser(i), onSuccess: refresh }),
    setActive: useMutation({ mutationFn: (i: { uid: string; isActive: boolean }) => svc().functions.adminSetUserActive(i), onSuccess: refresh }),
    assignPosition: useMutation({ mutationFn: (i: PositionInput) => svc().functions.adminAssignPosition(i), onSuccess: refresh }),
    endPosition: useMutation({ mutationFn: (positionId: string) => svc().functions.adminEndPosition({ positionId }), onSuccess: refresh }),
  }
}
