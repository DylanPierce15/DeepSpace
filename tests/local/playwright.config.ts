/**
 * Local integration tests — runs against local workers via wrangler dev.
 *
 * Prerequisites (start these before running tests):
 *   cd platform/auth-worker     && pnpm dev   # port 8794
 *   cd platform/platform-worker && pnpm dev   # port 8792
 *   cd templates/starter        && pnpm dev   # port 5173
 *
 * Or use: scripts/test-local.sh
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
