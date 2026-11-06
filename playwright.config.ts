import { defineConfig, devices } from '@playwright/test'

const PORT = 5181

/**
 * End-to-end tests at phone, tablet and desktop sizes.
 * The dev server runs with a short ACK timeout so the SMS fallback fires quickly.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, browserName: 'chromium' } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, hasTouch: true, browserName: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { VITE_ACK_TIMEOUT_SECONDS: '8', VITE_DEMO_MODE: 'true', VITE_DATA_SOURCE: 'mock' },
  },
})
