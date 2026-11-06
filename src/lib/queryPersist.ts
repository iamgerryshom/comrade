import { del, get, set } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Persist the TanStack Query cache in IndexedDB (structured clone keeps Dates), so the inbox,
 * units and profile show instantly, and still show without a connection.
 */
const KEY = 'comrade.queryCache'

export const idbPersister: Persister = {
  persistClient: (client: PersistedClient) => set(KEY, client),
  restoreClient: () => get<PersistedClient>(KEY),
  removeClient: () => del(KEY),
}

/** Only cache what's useful offline and safe to keep on the device. */
// (Not the hierarchy: it's large and rebuilt instantly from the data source / Firestore cache.)
export const PERSISTED_KEYS = ['inbox', 'notice', 'myUnits', 'settings', 'sent']
