import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/primitives'
import { useIsTabletUp } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { EmptyState, ListSkeleton } from './common'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
  className?: string
}

/** Sortable, searchable, paginated table on tablet/desktop; a card list on phones. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  mobileCard,
  toolbar,
  pageSize = 15,
  loading,
  emptyTitle = 'Nothing here yet',
  initialSort,
  onRowClick,
}: {
  rows: T[] | undefined
  columns: Column<T>[]
  rowKey: (r: T) => string
  searchText?: (r: T) => string
  mobileCard: (r: T) => ReactNode
  toolbar?: ReactNode
  pageSize?: number
  loading?: boolean
  emptyTitle?: string
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  onRowClick?: (r: T) => void
}) {
  const tabletUp = useIsTabletUp()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)

  const data = useMemo(() => {
    let out = rows ?? []
    const term = q.trim().toLowerCase()
    if (term && searchText) out = out.filter((r) => searchText(r).toLowerCase().includes(term))
    const col = sort && columns.find((c) => c.key === sort.key)
    if (col?.sortValue) {
      const sv = col.sortValue
      out = [...out].sort((a, b) => {
        const x = sv(a)
        const y = sv(b)
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
        return sort!.dir === 'asc' ? r : -r
      })
    }
    return out
  }, [rows, q, sort, columns, searchText])

  const pages = Math.max(1, Math.ceil(data.length / pageSize))
  const current = Math.min(page, pages - 1)
  const slice = data.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }))

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchText && (
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
              placeholder="Search…"
              className="pl-9"
              aria-label="Search table"
            />
          </div>
        )}
        {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : tabletUp ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={cn('px-4 py-2.5 text-xs font-medium text-muted-foreground', c.className)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {c.header}
                        {sort?.key === c.key ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('border-b last:border-0', onRowClick && 'cursor-pointer hover:bg-accent/50')}>
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-2.5 align-middle', c.className)}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-2">
          {slice.map((r) => (
            <li key={rowKey(r)}>
              {onRowClick ? (
                <button type="button" className="w-full rounded-xl border bg-card p-3 text-left shadow-soft" onClick={() => onRowClick(r)}>
                  {mobileCard(r)}
                </button>
              ) : (
                <div className="rounded-xl border bg-card p-3 shadow-soft">{mobileCard(r)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      {data.length > pageSize && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {current * pageSize + 1}–{Math.min(data.length, (current + 1) * pageSize)} of {data.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
