import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { BellRing, Laptop, MessageSquareText, Moon, Monitor, Sun, Trash2, User, WifiOff } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDevices, useHierarchyIndex, useMyPositions, useUpdateProfile } from '@/hooks/data'
import { useSimulatedOffline } from '@/hooks/useOnline'
import { useTheme, type ThemePref } from '@/hooks/useTheme'
import { getServices } from '@/services'
import { normalizeKenyanPhone } from '@/core/phone'
import { isPositionActive } from '@/core/permissions'
import { notificationPermission, requestNotificationPermission } from '@/lib/push'
import { env } from '@/lib/env'
import { PageHeader, RoleBadge, UserAvatar, UserTypeBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, FieldError, Input, Label, Switch } from '@/components/ui/primitives'
import { cn, errorMessage, shortDate, timeAgo } from '@/lib/utils'

const form = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().refine((p) => !p.trim() || normalizeKenyanPhone(p) !== null, 'Use a Kenyan mobile number, e.g. 0712 345 678 or +254712345678'),
  smsOptOut: z.boolean(),
})
type Form = z.infer<typeof form>

export function ProfilePage() {
  const { profile, claims } = useAuth()
  const h = useHierarchyIndex()
  const update = useUpdateProfile()
  const { data: devices } = useDevices(profile?.uid)
  const { data: positions } = useMyPositions(profile?.uid)
  const { theme, setTheme } = useTheme()
  const [sim, setSim] = useSimulatedOffline()
  const [perm, setPerm] = useState(notificationPermission())
  const deviceId = getServices().devices.getDeviceId()
  const { register, handleSubmit, reset, control, formState } = useForm<Form>({ resolver: zodResolver(form) })

  useEffect(() => {
    if (profile && !formState.isDirty) reset({ name: profile.name, phone: profile.phone ?? '', smsOptOut: profile.smsOptOut })
  }, [profile, reset, formState.isDirty])

  if (!profile || !claims) return null
  const isStudent = profile.userType === 'STUDENT'
  const course = profile.courseId ? h?.courseById.get(profile.courseId) : undefined

  const submit = async (f: Form) => {
    try {
      await update.mutateAsync({ name: f.name, phone: f.phone.trim() ? normalizeKenyanPhone(f.phone) : null, smsOptOut: f.smsOptOut })
      reset(f)
      toast.success('Profile saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Profile & preferences" icon={User} />

      <Card className={cn('overflow-hidden', isStudent ? 'border-primary/30' : 'border-sky-500/30')}>
        <div className={cn('h-16', isStudent ? 'bg-gradient-to-r from-primary/80 to-primary/40' : 'bg-gradient-to-r from-sky-600/70 to-sky-400/40')} aria-hidden />
        <div className="-mt-8 flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end">
          <UserAvatar name={profile.name} userType={profile.userType} leader={claims.positions.length > 0} className="size-16 text-lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{profile.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {(profile.userType === 'STAFF' || claims.positions.length > 0) && <UserTypeBadge userType={profile.userType} />}
              <RoleBadge role={profile.role} userType={profile.userType} positions={claims.positions} />
              <span className="font-mono text-xs text-muted-foreground">{profile.admissionNumber ?? profile.staffNumber}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{course ? `${course.name} · Year ${profile.yearOfStudy}` : profile.title}</p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit(submit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Contact & SMS fallback</CardTitle>
            <CardDescription>If your device doesn't confirm a notice in time, Comrade sends a short SMS to this number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-name">Display name</Label>
                <Input id="p-name" {...register('name')} />
                <FieldError>{formState.errors.name?.message}</FieldError>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Mobile number</Label>
                <Input id="p-phone" type="tel" inputMode="tel" placeholder="+2547XXXXXXXX" {...register('phone')} aria-invalid={!!formState.errors.phone} />
                <FieldError>{formState.errors.phone?.message}</FieldError>
              </div>
            </div>
            <Controller
              control={control}
              name="smsOptOut"
              render={({ field }) => (
                <label className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <span className="text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <MessageSquareText className="size-4 text-muted-foreground" /> Only send me URGENT notices by SMS
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">Saves SMS for emergencies. Urgent notices are always sent by SMS when you're offline.</span>
                  </span>
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Opt out of non-urgent SMS" />
                </label>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Browser notifications & devices</CardTitle>
          <CardDescription>Each browser you use confirms notices on your behalf.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
            <BellRing className="size-5 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Notifications in this browser</p>
              <p className="text-muted-foreground">
                {perm === 'granted' ? 'On' : perm === 'denied' ? 'Blocked: enable them in your browser site settings.' : perm === 'unsupported' ? 'Not supported by this browser.' : 'Not enabled yet.'}
              </p>
            </div>
            {perm === 'default' && (
              <Button
                variant="outline"
                onClick={() =>
                  void requestNotificationPermission().then((p) => {
                    setPerm(p)
                    if (p === 'granted') void getServices().devices.registerDevice(profile.uid, { notificationsEnabled: true })
                  })
                }
              >
                Turn on
              </Button>
            )}
          </div>
          {env.demoMode && isStudent && (
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2">
                <WifiOff className="size-4 text-muted-foreground" />
                <span>
                  <span className="font-medium">Simulate offline (demo)</span>
                  <span className="block text-muted-foreground">This device stops confirming notices, so the SMS fallback fires.</span>
                </span>
              </span>
              <Switch checked={sim} onCheckedChange={setSim} />
            </label>
          )}
          <ul className="divide-y rounded-lg border">
            {(devices ?? []).map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-3 text-sm">
                <Laptop className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {d.label} {d.id.endsWith(deviceId) && <Badge className="ml-1 border-primary/30 text-primary">This device</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last seen {timeAgo(d.lastSeenAt)} · notifications {d.notificationsEnabled ? 'on' : 'off'}
                  </p>
                </div>
                {!d.id.endsWith(deviceId) && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.label}`} onClick={() => void getServices().devices.removeDevice(d.id)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {(
              [
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
                ['system', 'System', Monitor],
              ] as [ThemePref, string, typeof Sun][]
            ).map(([v, label, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={theme === v} onClick={() => setTheme(v)} className={cn('flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-sm', theme === v && 'border-primary bg-primary-soft text-primary')}>
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!!positions?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Leadership history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {positions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span>{p.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {shortDate(p.startDate)} – {shortDate(p.endDate)}
                    {isPositionActive(p, new Date()) ? <Badge className="border-green-500/30 text-green-700 dark:text-green-300">Active</Badge> : <Badge>Ended</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
