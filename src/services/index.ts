import { env } from '@/lib/env'
import type { Services } from './types'

let services: Services | null = null
let pending: Promise<Services> | null = null
let markReady: (s: Services) => void
const ready = new Promise<Services>((r) => (markReady = r))

/** Resolves once the data source is ready (does not start it). Public pages render before this. */
export function servicesReady(): Promise<Services> {
  return ready
}

export function isServicesReady() {
  return services !== null
}

/** Pick the implementation from VITE_DATA_SOURCE. Called once at startup. */
export function initServices(): Promise<Services> {
  if (services) return Promise.resolve(services)
  if (!pending) pending = load().then((s) => (markReady(s), s))
  return pending
}

async function load(): Promise<Services> {
  if (env.dataSource === 'firebase') {
    const { createFirebaseServices } = await import('./firebase')
    services = await createFirebaseServices()
  } else {
    const { createMockServices } = await import('./mock')
    services = await createMockServices()
  }
  return services
}

export function getServices(): Services {
  if (!services) throw new Error('initServices() has not finished yet')
  return services
}

export * from './types'
