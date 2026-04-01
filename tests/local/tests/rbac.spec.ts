/**
 * Local: RBAC and data operations against real RecordRoom DOs.
 *
 * Tests anonymous access, signed-in CRUD, role enforcement, and data visibility.
 */

import { test, expect, APP_URL } from './fixtures'

// Helper: sign in through the auth overlay
async function signIn(page: import('@playwright/test').Page) {
  await page.locator('input[type="email"]').fill('local-test@deepspace.test')
  await page.locator('input[type="password"]').fill('LocalTestPass123!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeVisible({ timeout: 15_000 })
}

test.describe('RBAC — anonymous user', () => {
  test('can view test page without signing in', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    // Auth overlay should be visible but test page content should be behind it
    await expect(page.locator('[data-testid="test-page"]')).toBeAttached({ timeout: 10_000 })
  })

  test('shows anonymous role', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    // Wait for the RecordScope to connect (even anonymously)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('anonymous', { timeout: 15_000 })
  })
})

test.describe('RBAC — signed-in member', () => {
  test('shows member role after sign-in', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })
    await signIn(page)

    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('member', { timeout: 15_000 })
    await expect(page.locator('[data-testid="test-signed-in"]')).toHaveText('true')
  })

  test('can create a draft item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })
    await signIn(page)

    // Wait for connection
    await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('anonymous', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-item"]').click()

    // Should show success
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })

    // Item should appear in the list
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Test Item')).toBeVisible({ timeout: 10_000 })
  })

  test('can create a published item visible to all', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })
    await signIn(page)

    await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('anonymous', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Public Item')).toBeVisible({ timeout: 10_000 })
  })
})
