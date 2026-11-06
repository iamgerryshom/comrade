import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Command } from 'cmdk'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { FileText, Moon, Search, Sun } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useInbox } from '@/hooks/data'
import { useTheme } from '@/hooks/useTheme'
import type { NavItem } from './nav'

/** ⌘K / Ctrl+K command palette: jump to pages and search your notices. */
export function CommandPalette({ open, setOpen, items }: { open: boolean; setOpen: (v: boolean) => void; items: NavItem[] }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: inbox } = useInbox(profile?.uid)
  const { resolved, setTheme } = useTheme()
  const [q, setQ] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const go = (to: string) => {
    setOpen(false)
    setQ('')
    navigate(to)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl">
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages and notices</DialogPrimitive.Description>
          <Command label="Command palette" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search notices or jump to…" className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1">
              <Command.Empty className="p-6 text-center text-sm text-muted-foreground">No results.</Command.Empty>
              <Command.Group heading="Pages">
                {items.map((i) => (
                  <Command.Item key={i.to} value={`page ${i.label}`} onSelect={() => go(i.to)} className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm aria-selected:bg-accent">
                    <i.icon className="size-4 text-muted-foreground" aria-hidden />
                    {i.label}
                  </Command.Item>
                ))}
              </Command.Group>
              {q.length > 1 && !!inbox?.length && (
                <Command.Group heading="Notices">
                  {inbox.slice(0, 200).map((d) => (
                    <Command.Item key={d.id} value={`notice ${d.title} ${d.senderName}`} onSelect={() => go(`/notice/${d.notificationId}`)} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-accent">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{d.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{d.senderName}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Preferences">
                <Command.Item value="toggle theme dark light" onSelect={() => { setTheme(resolved === 'dark' ? 'light' : 'dark'); setOpen(false) }} className="flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm aria-selected:bg-accent">
                  {resolved === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />} Switch to {resolved === 'dark' ? 'light' : 'dark'} mode
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
