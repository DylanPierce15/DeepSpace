/**
 * Shared test helpers.
 */

import { expect, type Page } from '@playwright/test'

/** Sign in via the nav bar auth overlay. */
export async function signIn(page: Page) {
  await page.locator('[data-testid="nav-sign-in-button"]').click()
  const overlay = page.locator('[data-testid="auth-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  await overlay.locator('input[type="email"]').fill('local-test@deepspace.test')
  await overlay.locator('input[type="password"]').fill('LocalTestPass123!')
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
