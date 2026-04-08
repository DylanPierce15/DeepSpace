/**
 * Shared test helpers.
 */

import { expect, type Page } from '@playwright/test'

const USER_1 = {
  email: 'local-test@deepspace.test',
  password: 'LocalTestPass123!',
}

const USER_2 = {
  email: 'local-test-2@deepspace.test',
  password: 'LocalTestPass456!',
}

/** Sign in via the nav bar auth overlay. Defaults to user 1. */
export async function signIn(page: Page, user: 1 | 2 = 1) {
  const creds = user === 1 ? USER_1 : USER_2
  await page.locator('[data-testid="nav-sign-in-button"]').click()
  const overlay = page.locator('[data-testid="auth-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  // Expand the email/password form (hidden by default)
  await overlay.locator('[data-testid="auth-email-toggle"]').click()
  await overlay.locator('input[type="email"]').fill(creds.email)
  await overlay.locator('input[type="password"]').fill(creds.password)
  await overlay.locator('button[type="submit"]').click()
  await expect(overlay).not.toBeVisible({ timeout: 15_000 })
}

/** Navigate to /test and wait for the role to appear. */
export async function goToTestPage(page: Page, appUrl: string) {
  await page.goto(`${appUrl}/test`, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 10_000 })
}

/** Navigate to /test, sign in, wait for non-viewer role. */
export async function goToTestPageSignedIn(page: Page, appUrl: string) {
  await goToTestPage(page, appUrl)
  await signIn(page)
  await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('viewer', { timeout: 15_000 })
}
