import { env } from '@/lib/env'
import type { Services } from '../types'
import { mockAuth } from './auth'
import { mockFunctions } from './functions'
import { startWorker } from './server'
import { mockAudit, mockDeliveries, mockDemo, mockDevices, mockDirectory, mockNotifications, mockSettings, mockSms } from './services'
import { startMockBackend } from './sync'

export async function createMockServices(): Promise<Services> {
  await startMockBackend()
  startWorker()
  return {
    auth: mockAuth,
    directory: mockDirectory,
    notifications: mockNotifications,
    deliveries: mockDeliveries,
    sms: mockSms,
    audit: mockAudit,
    settings: mockSettings,
    devices: mockDevices,
    functions: mockFunctions,
    demo: env.demoMode ? mockDemo : null,
  }
}
