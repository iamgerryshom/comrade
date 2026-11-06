import * as React from 'react'
import { Dialog as DialogPrimitive, DropdownMenu as DM, Popover as PopoverPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// ───────── Dialog / Sheet ─────────
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

function Overlay() {
  return <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
}

/**
 * Responsive modal: a centred dialog on tablet/desktop, a full-width bottom sheet on phones.
 * `side` forces a side sheet (e.g. the mobile nav drawer).
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  side,
  hideClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string; side?: 'left' | 'right'; hideClose?: boolean }) {
  const isPhone = !useMediaQuery('(min-width: 640px)')
  const layout = side
    ? cn('inset-y-0 h-full w-[85vw] max-w-sm border-r', side === 'left' ? 'left-0' : 'right-0 border-l border-r-0')
    : isPhone
      ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t safe-bottom'
      : 'left-1/2 top-1/2 max-h-[88dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border'
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        className={cn('fixed z-50 flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl focus:outline-none', layout, className)}
        {...props}
      >
        {isPhone && !side && <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted" />}
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close className="-mr-2 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// ───────── Dropdown ─────────
export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group
export function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        className={cn('z-50 min-w-48 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg', className)}
        {...props}
      />
    </DM.Portal>
  )
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        'relative flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('px-2 py-1.5 text-sm', className)} {...props} />
}
export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
}

// ───────── Popover ─────────
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export function PopoverContent({ className, sideOffset = 6, align = 'start', ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('z-50 w-72 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
