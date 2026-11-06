import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { FlaskConical, Gauge, MessageSquareText, RotateCcw, Settings, Timer } from 'lucide-react'
import { settingsInput, type SettingsInput } from '@/core/schemas'
import { useSettings, useUpdateSettings } from '@/hooks/data'
import { getServices } from '@/services'
import { POSITION_LABEL } from '@/core/labels'
import { PageHeader, PageSkeleton } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, FieldError, Input, Label, Switch } from '@/components/ui/primitives'
import { errorMessage } from '@/lib/utils'
import type { PositionType } from '@/types'

export function SettingsPage() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const demo = getServices().demo
  const [keep, setKeep] = useState(() => demo?.isKeepData() ?? false)
  const { register, handleSubmit, reset, formState } = useForm<SettingsInput>({ resolver: zodResolver(settingsInput) })

  useEffect(() => {
    if (settings && !formState.isDirty) reset({ ackTimeoutSeconds: settings.ackTimeoutSeconds, rateLimits: settings.rateLimits, smsSenderId: settings.smsSenderId, smsCostKes: settings.smsCostKes })
  }, [settings, reset, formState.isDirty])

  if (!settings) return <PageSkeleton />

  const submit = async (f: SettingsInput) => {
    try {
      await update.mutateAsync(f)
      reset(f)
      toast.success('Settings saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" icon={Settings} description="System-wide delivery settings. Changes are audited." />
      <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="size-4" /> Delivery
            </CardTitle>
            <CardDescription>How long to wait for a device to confirm before falling back to SMS. Use a short value (e.g. 15s) for demos.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ack">ACK timeout (seconds)</Label>
              <Input id="ack" type="number" min={5} max={3600} {...register('ackTimeoutSeconds', { valueAsNumber: true })} />
              <FieldError>{formState.errors.ackTimeoutSeconds?.message}</FieldError>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="size-4" /> SMS
            </CardTitle>
            <CardDescription>Provider keys are never stored here: they live in Cloud Functions secrets.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sid">Sender ID</Label>
              <Input id="sid" maxLength={11} {...register('smsSenderId')} />
              <FieldError>{formState.errors.smsSenderId?.message}</FieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost per SMS (KES)</Label>
              <Input id="cost" type="number" step="0.01" min={0} {...register('smsCostKes', { valueAsNumber: true })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="size-4" /> Student sender limits
            </CardTitle>
            <CardDescription>Notifications per day for each leadership position.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(POSITION_LABEL) as PositionType[]).map((p) => (
              <div key={p} className="space-y-2">
                <Label htmlFor={`rl-${p}`}>{POSITION_LABEL[p]}</Label>
                <Input id={`rl-${p}`} type="number" min={0} {...register(`rateLimits.${p}`, { valueAsNumber: true })} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
            Save settings
          </Button>
        </div>
      </form>

      {demo && (
        <Card className="mt-6 border-gold/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-4" /> Demo options
            </CardTitle>
            <CardDescription>Only in demo mode (VITE_DEMO_MODE=true).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium">Keep demo data after refresh</span>
                <span className="block text-muted-foreground">Saves a snapshot in this browser (IndexedDB). Off = fresh data on every load.</span>
              </span>
              <Switch
                checked={keep}
                onCheckedChange={(v) => {
                  setKeep(v)
                  void demo.setKeepData(v)
                }}
              />
            </label>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('Reset all demo data in every open tab?')) void demo.resetData().then(() => toast.success('Demo data reset'))
              }}
            >
              <RotateCcw /> Reset demo data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
