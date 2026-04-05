/**
 * TestPage feature tests.
 * Exercises RBAC roles and CRUD operations against the RecordRoom.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Test Page', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
  })

  test('anonymous user has viewer role', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 10_000 })
  })

  test('anonymous user cannot create draft item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 10_000 })

    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-error"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="test-last-error"]')).toContainText('DENIED')
  })

  test('signed-in user gets member role', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="test-user-role"]')).not.toHaveText('viewer', { timeout: 10_000 })
  })

  test('signed-in user can create draft item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:')
  })

  test('signed-in user can create published item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:')
  })

  test('signed-in user can update own item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })

    // Create an item first
    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toBeVisible({ timeout: 10_000 })
    const resultText = await page.locator('[data-testid="test-last-result"]').textContent()
    const itemId = resultText!.replace('created:', '')

    // Update the item
    await page.locator(`[data-testid="test-update-${itemId}"]`).click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText(`updated:${itemId}`, { timeout: 10_000 })
  })

  test('signed-in user can delete own item', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 15_000 })

    // Create an item first
    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toBeVisible({ timeout: 10_000 })
    const resultText = await page.locator('[data-testid="test-last-result"]').textContent()
    const itemId = resultText!.replace('created:', '')

    // Delete the item
    await page.locator(`[data-testid="test-delete-${itemId}"]`).click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText(`deleted:${itemId}`, { timeout: 10_000 })
  })
})
