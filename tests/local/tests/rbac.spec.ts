/**
 * Local: RBAC and data operations against real RecordRoom DOs.
 * Tests anonymous access, role assignment, CRUD, and permission enforcement.
 */

import { test, expect, APP_URL } from './fixtures'

async function signIn(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="nav-sign-in-button"]').click()
  const overlay = page.locator('[data-testid="auth-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  await overlay.locator('input[type="email"]').fill('local-test@deepspace.test')
  await overlay.locator('input[type="password"]').fill('LocalTestPass123!')
  await overlay.locator('button[type="submit"]').click()
  await expect(overlay).not.toBeVisible({ timeout: 15_000 })
}

test.describe('RBAC — anonymous user', () => {
  test('test page is fully visible without signing in', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 10_000 })
  })

  test('shows anonymous role', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('anonymous', { timeout: 15_000 })
  })

  test('shows not signed in', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-signed-in"]')).toHaveText('false', { timeout: 10_000 })
  })
})

test.describe('RBAC — signed-in member', () => {
  test('shows member role after sign-in', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('member', { timeout: 15_000 })
    await expect(page.locator('[data-testid="test-signed-in"]')).toHaveText('true')
  })

  test('can create a draft item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('anonymous', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Test Item')).toBeVisible({ timeout: 10_000 })
  })

  test('can create a published item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('anonymous', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Public Item')).toBeVisible({ timeout: 10_000 })
  })
})
