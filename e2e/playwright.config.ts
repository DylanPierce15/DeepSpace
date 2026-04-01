import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'https://deepspace-sdk-test.app.space'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Deploy test app before tests, tear down after
  globalSetup: './setup/global-setup.ts',
  globalTeardown: './setup/global-teardown.ts',
})
