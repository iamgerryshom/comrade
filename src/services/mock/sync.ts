import { del, get, set } from 'idb-keyval'
import structure from '@/data/kisii-structure.json'
import { generateDataset, type Dataset, type KisiiStructure } from '@/data/generate'
import { env } from '@/lib/env'
import { store, type Change } from './store'

/**
 * Cross-tab sync for the mock backend.
 *  - Every local write is broadcast on a BroadcastChannel; other tabs apply it.
 *  - A new tab asks for the current state ("hello") and loads the first snapshot it gets,
 *    so data created before it opened (sent notices, SMS…) is there.
 *  - Optionally persists a snapshot in IndexedDB ("Keep demo data after refresh").
 */

type Msg =
  | { type: 'changes'; from: string; changes: Change[] }
  | { type: 'hello'; from: string }
  | { type: 'snapshot'; from: string; to: string; data: Dataset }

export const TAB_ID = Math.random().toString(36).slice(2, 10)
const CHANNEL = 'comrade-mock-store'
const KEEP_KEY = 'comrade.keepDemoData'
const SNAPSHOT_KEY = 'comrade.snapshot'

let channel: BroadcastChannel | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

export function freshDataset(): Dataset {
  return generateDataset(structure as KisiiStructure, { ackTimeoutSeconds: env.ackTimeoutSeconds })
}

/** Generate in a Web Worker (keeps the main thread free); falls back to the main thread. */
function freshDatasetAsync(): Promise<Dataset> {
  if (typeof Worker === 'undefined') return Promise.resolve(freshDataset())
  return new Promise((resolve) => {
    try {
      const w = new Worker(new URL('./generate.worker.ts', import.meta.url), { type: 'module' })
      w.onmessage = (e: MessageEvent<Dataset>) => {
        resolve(e.data)
        w.terminate()
      }
      w.onerror = () => {
        w.terminate()
        resolve(freshDataset())
      }
      w.postMessage({ ackTimeoutSeconds: env.ackTimeoutSeconds })
    } catch {
      resolve(freshDataset())
    }
  })
}

export function isKeepDataEnabled() {
  return localStorage.getItem(KEEP_KEY) === '1'
}

export async function setKeepData(on: boolean) {
  localStorage.setItem(KEEP_KEY, on ? '1' : '0')
  if (on) await set(SNAPSHOT_KEY, store.snapshot())
  else await del(SNAPSHOT_KEY)
}

function schedulePersist() {
  if (!isKeepDataEnabled()) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void set(SNAPSHOT_KEY, store.snapshot()), 800)
}

/** Is another Comrade tab open? (It holds the worker lock.) Unknown → assume maybe. */
async function otherTabsOpen(): Promise<boolean | null> {
  try {
    if (!navigator.locks?.query) return null
    const state = await navigator.locks.query()
    return [...(state.held ?? []), ...(state.pending ?? [])].some((l) => l.name === 'comrade-worker')
  } catch {
    return null
  }
}

/** Load data (snapshot from another tab > IndexedDB snapshot > generated) and start syncing. */
export async function startMockBackend(): Promise<void> {
  let loaded = false
  // Start generating right away, in parallel with asking other tabs for their state
  const generated = freshDatasetAsync()
  if (isKeepDataEnabled()) {
    const snap = await get<Dataset>(SNAPSHOT_KEY).catch(() => undefined)
    if (snap?.users?.length) {
      store.load(snap)
      loaded = true
    }
  }

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL)
    const others = await otherTabsOpen()
    // Other tabs exist → wait for their state (they may be busy). None → don't wait at all.
    const waitMs = others === false ? 0 : others ? 3000 : 300
    const gotSnapshot = new Promise<Dataset | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), waitMs)
      channel!.addEventListener('message', function onMsg(e: MessageEvent<Msg>) {
        if (e.data.type === 'snapshot' && e.data.to === TAB_ID) {
          clearTimeout(timer)
          channel!.removeEventListener('message', onMsg)
          resolve(e.data.data)
        }
      })
    })
    channel.postMessage({ type: 'hello', from: TAB_ID } satisfies Msg)
    const snap = await gotSnapshot
    if (snap) {
      store.load(snap)
      loaded = true
    }

    channel.addEventListener('message', (e: MessageEvent<Msg>) => {
      const m = e.data
      if (m.from === TAB_ID) return
      if (m.type === 'changes') store.applyRemote(m.changes)
      else if (m.type === 'hello') channel!.postMessage({ type: 'snapshot', from: TAB_ID, to: m.from, data: store.snapshot() } satisfies Msg)
      else if (m.type === 'snapshot' && m.to === '*') store.load(m.data)
    })
  }

  if (!loaded) store.load(await generated)

  store.subscribe((changes, origin) => {
    if (origin === 'local' && changes.length) channel?.postMessage({ type: 'changes', from: TAB_ID, changes } satisfies Msg)
    schedulePersist()
  })
}

/** Regenerate the demo data in every open tab. */
export async function resetDemoData() {
  const data = freshDataset()
  store.load(data)
  channel?.postMessage({ type: 'snapshot', from: TAB_ID, to: '*', data } satisfies Msg)
  if (isKeepDataEnabled()) await set(SNAPSHOT_KEY, data)
}
