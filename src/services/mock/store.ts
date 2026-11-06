import type { CollectionName } from '@/types'
import type { Dataset } from '@/data/generate'
import type { Delivery } from '@/types'
import { mergeDelivery } from '@/core/delivery/state'

/**
 * In-memory "Firestore". Collections of documents keyed by id (users by uid).
 * Every write produces `Change`s that are broadcast to other tabs (see sync.ts),
 * which is how the multi-tab demo behaves like a shared backend.
 */

export type DocOf<K extends CollectionName> = Dataset[K][number]
export interface Change {
  col: CollectionName
  id: string
  /** null = deleted */
  doc: unknown | null
}
export type ChangeListener = (changes: Change[], origin: 'local' | 'remote' | 'reset') => void

const idOf = (col: CollectionName, doc: unknown): string =>
  col === 'users' ? (doc as { uid: string }).uid : (doc as { id: string }).id

export class MockStore {
  private cols = new Map<CollectionName, Map<string, unknown>>()
  private listeners = new Set<ChangeListener>()
  private pending: Change[] | null = null

  load(data: Dataset) {
    this.cols.clear()
    for (const [col, docs] of Object.entries(data) as [CollectionName, unknown[]][]) {
      this.cols.set(col, new Map(docs.map((d) => [idOf(col, d), d])))
    }
    this.emit([], 'reset')
  }

  snapshot(): Dataset {
    const out: Record<string, unknown[]> = {}
    for (const [col, map] of this.cols) out[col] = [...map.values()]
    return out as unknown as Dataset
  }

  private col(col: CollectionName) {
    let m = this.cols.get(col)
    if (!m) this.cols.set(col, (m = new Map()))
    return m
  }

  get<K extends CollectionName>(col: K, id: string): DocOf<K> | undefined {
    return this.col(col).get(id) as DocOf<K> | undefined
  }

  list<K extends CollectionName>(col: K, where?: (d: DocOf<K>) => boolean): DocOf<K>[] {
    const all = [...this.col(col).values()] as DocOf<K>[]
    return where ? all.filter(where) : all
  }

  set<K extends CollectionName>(col: K, doc: DocOf<K>) {
    const id = idOf(col, doc)
    this.col(col).set(id, doc)
    this.record({ col, id, doc })
  }

  update<K extends CollectionName>(col: K, id: string, patch: Partial<DocOf<K>>): DocOf<K> | undefined {
    const cur = this.get(col, id)
    if (!cur) return undefined
    const next = { ...cur, ...patch } as DocOf<K>
    this.col(col).set(id, next)
    this.record({ col, id, doc: next })
    return next
  }

  delete(col: CollectionName, id: string) {
    if (this.col(col).delete(id)) this.record({ col, id, doc: null })
  }

  /**
   * Run several writes atomically (synchronously, so nothing interleaves) and emit one change set.
   * Mirrors Firestore `runTransaction` / `writeBatch`.
   */
  transaction<T>(fn: () => T): T {
    if (this.pending) return fn()
    this.pending = []
    try {
      return fn()
    } finally {
      const changes = this.pending
      this.pending = null
      if (changes.length) this.emit(changes, 'local')
    }
  }

  /** Apply changes that happened in another tab. */
  applyRemote(changes: Change[]) {
    for (const c of changes) {
      if (c.doc === null) {
        this.col(c.col).delete(c.id)
        continue
      }
      const cur = this.col(c.col).get(c.id)
      if (c.col === 'deliveries' && cur) {
        const merged = mergeDelivery(cur as Delivery, c.doc as Delivery)
        this.col(c.col).set(c.id, merged)
        c.doc = merged
      } else this.col(c.col).set(c.id, c.doc)
    }
    this.emit(changes, 'remote')
  }

  subscribe(fn: ChangeListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private record(c: Change) {
    if (this.pending) this.pending.push(c)
    else this.emit([c], 'local')
  }

  private emit(changes: Change[], origin: 'local' | 'remote' | 'reset') {
    for (const l of this.listeners) l(changes, origin)
  }
}

export const store = new MockStore()
