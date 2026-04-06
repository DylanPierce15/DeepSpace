/**
 * Dashboard integration tests — runs against local workers + dashboard dev server.
 *
 * Prerequisites (started by scripts/test-dashboard.sh):
 *   auth-worker (8794), api-worker (8795), deploy-worker (8796), dashboard (5174)
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: './report' }], ['list']],
  timeout: 30_000,

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './setup/global-setup.ts',
})
