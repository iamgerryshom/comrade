import { env } from '@/lib/env'
import type { Services } from './types'

let services: Services | null = null

/** Pick the implementation from VITE_DATA_SOURCE. Called once before the app renders. */
export async function initServices(): Promise<Services> {
  if (services) return services
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
