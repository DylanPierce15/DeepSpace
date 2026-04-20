import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // 1 retry everywhere (2 in CI). Not to mask app bugs — a real app bug
  // fails deterministically on both attempts. This is specifically to
  // paper over a Playwright/Chromium subprocess flake: when tests run
  // back-to-back, `BrowserContext.newPage()` occasionally hangs for the
  // full 30s test timeout before the navigation even starts (confirmed
  // via trace.zip: Create page fixture took 30s, goto aborted). The
  // request never hit the wire, so this is not an app issue.
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [['html', { open: 'never', outputFolder: './report' }], ['list']],
  timeout: 30_000,

  use: {
    // `retain-on-failure` keeps a trace zip + screenshots for any test
    // that ends up failing all retries — that's the real bug signal.
    // Individual retry attempts don't generate traces, so flaky passes
    // stay quiet.
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './setup/global-setup.ts',
})
