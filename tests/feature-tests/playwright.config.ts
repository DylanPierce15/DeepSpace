/**
 * Playwright config for feature-specific tests against deployed apps.
 *
 * These tests assume the app has already been scaffolded, had features added,
 * and deployed via the e2e steps in tests/e2e/scripts/. They read the deployed
 * URL and auth state from tests/e2e/.app-name and tests/e2e/.auth-state.json.
 *
 * Run a specific feature's tests:
 *   npx playwright test --config tests/feature-tests/playwright.config.ts tests/ai-chat
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: './report' }], ['list']],
  timeout: 60_000,

  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reuse the e2e global setup — signs in and writes tests/e2e/.auth-state.json
  globalSetup: '../e2e/setup/global-setup.ts',
})
