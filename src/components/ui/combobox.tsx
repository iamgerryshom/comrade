import { useState } from 'react'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './overlays'
import { cn } from '@/lib/utils'

export interface ComboOption {
  value: string
  label: string
  hint?: string
}

/** Searchable select for long lists (units, courses…). */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  id,
  invalid,
}: {
  options: ComboOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            'flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-base shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive sm:text-sm',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command>
          <Command.Input placeholder={searchPlaceholder} className="h-11 w-full border-b bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground sm:text-sm" />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="p-4 text-center text-sm text-muted-foreground">Nothing found.</Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={`${o.label} ${o.hint ?? ''} ${o.value}`}
                onSelect={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
              >
                <Check className={cn('size-4 shrink-0', o.value === value ? 'opacity-100 text-primary' : 'opacity-0')} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
