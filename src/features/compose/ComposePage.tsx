import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, FileText, Loader2, MessageSquareText, Paperclip, PenSquare, Save, Send, Smartphone, Trash2, X } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDeleteDraft, useDrafts, useHierarchyIndex, useMyPositions, useSaveDraft, useSendNotification, useSendQuota } from '@/hooks/data'
import { getServices } from '@/services'
import { buildSmsText, SMS_MAX } from '@/core/delivery/sms'
import { computeSenderLabel } from '@/core/senderLabel'
import { isPositionActive } from '@/core/permissions'
import { ruleToScopes } from '@/core/audience'
import { CATEGORY_LABEL, PRIORITY_LABEL } from '@/core/labels'
import { CATEGORIES, PRIORITIES, type AudienceRule, type Attachment, type Notification } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, FieldError, Input, Label, NativeSelect, Progress, Switch, Textarea } from '@/components/ui/primitives'
import { Dialog, DialogContent } from '@/components/ui/overlays'
import { EmptyState, PageHeader } from '@/components/common'
import { cn, errorMessage, timeAgo } from '@/lib/utils'
import { AudienceBuilder } from './AudienceBuilder'

const formSchema = z.object({
  title: z.string().trim().min(3, 'Title is too short').max(120, 'Keep the title under 120 characters'),
  body: z.string().trim().min(1, 'Write a message').max(4000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  allowSmsFallback: z.boolean(),
  scheduleEnabled: z.boolean(),
  scheduledFor: z.string(),
})
type FormValues = z.infer<typeof formSchema>

const EMPTY: FormValues = { title: '', body: '', category: 'ACADEMIC', priority: 'NORMAL', allowSmsFallback: true, scheduleEnabled: false, scheduledFor: '' }

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ComposePage() {
  const { profile, can, claims } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const h = useHierarchyIndex()
  const { data: positions } = useMyPositions(profile?.uid)
  const { data: quota } = useSendQuota(profile?.uid)
  const { data: drafts } = useDrafts(profile?.uid)
  const send = useSendNotification()
  const saveDraft = useSaveDraft()
  const deleteDraft = useDeleteDraft()
  const [audience, setAudienceState] = useState<AudienceRule>({ targetType: 'INSTITUTION', targetId: '' })
  const setAudience = useCallback((r: AudienceRule) => setAudienceState(r), [])
  const [audienceError, setAudienceError] = useState<string>()
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [draftId, setDraftId] = useState<string | undefined>()
  const [draftsOpen, setDraftsOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, control, reset, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY })
  const v = useWatch({ control })

  // Load a draft from ?draft=id
  const loadDraft = useCallback(
    (d: Notification) => {
      reset({ title: d.title, body: d.body, category: d.category, priority: d.priority, allowSmsFallback: d.allowSmsFallback, scheduleEnabled: !!d.scheduledFor, scheduledFor: d.scheduledFor ? toLocalInput(d.scheduledFor) : '' })
      if (d.audience.targetId) setAudienceState(d.audience)
      setAttachment(d.attachment)
      setDraftId(d.id)
      setDraftsOpen(false)
    },
    [reset],
  )
  useEffect(() => {
    const id = params.get('draft')
    const d = id ? drafts?.find((x) => x.id === id) : undefined
    if (d) loadDraft(d)
  }, [params, drafts, loadDraft])

  const urgentAllowed = useMemo(() => {
    if (!audience.targetId) return claims?.userType === 'STAFF' || !!claims?.positions.includes('STUDENT_PRESIDENT')
    return ruleToScopes(audience, { users: [] }).every((s) => can('notification.send_urgent', s))
  }, [audience, can, claims])

  useEffect(() => {
    if (v.priority === 'URGENT') setValue('allowSmsFallback', true)
    if (v.priority === 'URGENT' && !urgentAllowed) setValue('priority', 'HIGH')
  }, [v.priority, urgentAllowed, setValue])

  const senderLabel = useMemo(() => {
    if (!profile || !h) return ''
    const active = (positions ?? []).filter((p) => isPositionActive(p, new Date()))
    return computeSenderLabel(profile, active, audience, {
      unitCode: (id) => h.unitById.get(id)?.code,
      facultyName: (id) => h.facultyById.get(id)?.name,
      schoolCode: (id) => h.schoolById.get(id)?.code,
      courseCode: (id) => h.courseById.get(id)?.code,
    })
  }, [profile, h, positions, audience])

  const sms = buildSmsText({ category: v.category ?? 'GENERAL', title: v.title || 'Your title', body: v.body ?? '', senderLabel, shortCode: 'K7Q2' })
  const quotaLeft = quota?.limit != null ? Math.max(0, quota.limit - quota.used) : null

  const upload = async (file: File) => {
    setUploading(true)
    try {
      setAttachment(await getServices().notifications.uploadAttachment(file))
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (f: FormValues) => {
    if (!audience.targetId || (audience.targetType === 'COURSE_YEAR' && !audience.yearOfStudy)) {
      setAudienceError('Choose who should receive this notice')
      return
    }
    const scheduledFor = f.scheduleEnabled && f.scheduledFor ? new Date(f.scheduledFor) : null
    if (scheduledFor && scheduledFor.getTime() < Date.now()) {
      toast.error('Pick a time in the future for scheduled notices')
      return
    }
    try {
      const res = await send.mutateAsync({ title: f.title, body: f.body, category: f.category, priority: f.priority, allowSmsFallback: f.allowSmsFallback, audience, attachment, scheduledFor, draftId })
      toast.success(res.scheduled ? 'Notice scheduled' : `Sent to ${res.recipientCount.toLocaleString()} ${res.recipientCount === 1 ? 'person' : 'people'}`, {
        description: res.scheduled ? undefined : 'Watch delivery confirmations arrive live.',
      })
      reset(EMPTY)
      setAttachment(null)
      setDraftId(undefined)
      navigate(`/sent/${res.notificationId}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const onSaveDraft = async () => {
    const f = v as FormValues
    try {
      const id = await saveDraft.mutateAsync({
        id: draftId,
        title: f.title,
        body: f.body,
        category: f.category,
        priority: f.priority,
        allowSmsFallback: f.allowSmsFallback,
        audience: audience.targetId ? audience : undefined,
        attachment,
        scheduledFor: f.scheduleEnabled && f.scheduledFor ? new Date(f.scheduledFor) : null,
      })
      setDraftId(id)
      toast.success('Draft saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Compose notice"
        icon={PenSquare}
        description={quotaLeft !== null ? `${quotaLeft} of ${quota!.limit} sends left today` : 'Send an official notice to students in your scope.'}
        actions={
          <Button variant="outline" size="sm" onClick={() => setDraftsOpen(true)}>
            <FileText /> Drafts{drafts?.length ? ` (${drafts.length})` : ''}
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Audience</CardTitle>
              <CardDescription>Only groups inside your scope are shown.</CardDescription>
            </CardHeader>
            <CardContent>
              <AudienceBuilder value={audience} onChange={(r) => { setAudience(r); setAudienceError(undefined) }} error={audienceError} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="e.g. COMP 210 CAT moved to Fri 14 Nov, 10am, LH3" aria-invalid={!!formState.errors.title} {...register('title')} />
                <FieldError>{formState.errors.title?.message}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea id="body" rows={6} placeholder="Write the full notice. The SMS fallback uses a shortened version." aria-invalid={!!formState.errors.body} {...register('body')} />
                <FieldError>{formState.errors.body?.message}</FieldError>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <NativeSelect id="category" {...register('category')}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <NativeSelect id="priority" {...register('priority')}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} disabled={p === 'URGENT' && !urgentAllowed}>
                        {PRIORITY_LABEL[p]}
                        {p === 'URGENT' && !urgentAllowed ? ' (staff & President only)' : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              {v.priority === 'URGENT' && (
                <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Urgent notices always fall back to SMS, even for students who opted out.
                </p>
              )}

              <div className="space-y-2">
                <Label>Attachment (optional)</Label>
                <input ref={fileRef} type="file" className="sr-only" aria-label="Attachment file" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
                {attachment ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground">{Math.ceil(attachment.size / 1024)} KB</span>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAttachment(null)} aria-label="Remove attachment">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} loading={uploading}>
                    <Paperclip /> Attach a file
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                control={control}
                name="allowSmsFallback"
                render={({ field }) => (
                  <label className="flex items-start justify-between gap-4">
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <MessageSquareText className="size-4 text-muted-foreground" /> Allow SMS fallback
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">If a student's device doesn't confirm within the timeout, send the SMS preview.</span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={v.priority === 'URGENT'} aria-label="Allow SMS fallback" />
                  </label>
                )}
              />
              <Controller
                control={control}
                name="scheduleEnabled"
                render={({ field }) => (
                  <label className="flex items-start justify-between gap-4">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="size-4 text-muted-foreground" /> Schedule for later
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Schedule for later" />
                  </label>
                )}
              />
              {v.scheduleEnabled && <Input type="datetime-local" aria-label="Send at" min={toLocalInput(new Date())} {...register('scheduledFor')} />}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-4" /> SMS preview
              </CardTitle>
              <CardDescription>Exactly what students get if their device is offline.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl bg-muted p-3">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">COMRADE-KSU · now</p>
                <p className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 font-mono text-[13px] leading-relaxed shadow-xs" data-testid="sms-preview">
                  {sms}
                </p>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{sms.length} / {SMS_MAX} characters · 1 SMS</span>
                  <span>Ref code assigned on send</span>
                </div>
                <Progress value={(sms.length / SMS_MAX) * 100} indicatorClassName={cn(sms.length > 150 && 'bg-amber-500')} />
              </div>
              {!v.allowSmsFallback && v.priority !== 'URGENT' && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">SMS fallback is off: offline students will only see this when they reconnect.</p>}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" loading={formState.isSubmitting} disabled={quotaLeft === 0}>
              <Send /> {v.scheduleEnabled ? 'Schedule notice' : 'Send notice'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void onSaveDraft()} loading={saveDraft.isPending}>
              <Save /> Save draft
            </Button>
            {quotaLeft === 0 && <p className="text-center text-sm text-destructive">You've reached today's sending limit.</p>}
          </div>
        </aside>
      </form>

      <Dialog open={draftsOpen} onOpenChange={setDraftsOpen}>
        <DialogContent title="Drafts" description="Pick up where you left off.">
          {!drafts ? (
            <Loader2 className="mx-auto my-6 animate-spin" />
          ) : drafts.length === 0 ? (
            <EmptyState icon={FileText} title="No drafts" description="Save a notice as a draft to finish it later." />
          ) : (
            <ul className="divide-y">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <button type="button" className="min-w-0 flex-1 rounded-md p-2 text-left hover:bg-accent" onClick={() => { setParams({}, { replace: true }); loadDraft(d) }}>
                    <span className="block truncate text-sm font-medium">{d.title || 'Untitled draft'}</span>
                    <span className="block text-xs text-muted-foreground">Edited {timeAgo(d.updatedAt)}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete draft" onClick={() => void deleteDraft.mutateAsync(d.id).then(() => toast.success('Draft deleted'))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
