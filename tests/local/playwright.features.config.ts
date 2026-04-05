/**
 * Feature tests — runs feature-specific Playwright specs.
 *
 * Uses the same globalSetup (auth) as the main config,
 * but testDir points to the features directory so Playwright
 * can discover spec files under each feature's tests/ folder.
 *
 * Usage (from test-feature.sh):
 *   npx playwright test --config playwright.features.config.ts <path-to-feature-tests>
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '../../packages/create-deepspace/features',
  testMatch: '**/tests/*.spec.ts',
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
