/**
 * RBAC — signed-in member tests.
 * Tests role assignment, full CRUD lifecycle, and ownership enforcement.
 */

import { test, expect, APP_URL } from './fixtures'
import { goToTestPage, goToTestPageSignedIn } from './helpers'

test.describe('member — connection', () => {
  test('gets member role after sign-in', async ({ page }) => {
    await goToTestPageSignedIn(page, APP_URL)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('member', { timeout: 15_000 })
    await expect(page.locator('[data-testid="test-signed-in"]')).toHaveText('true')
  })
})

test.describe('member — create', () => {
  test('can create a draft item', async ({ page }) => {
    await goToTestPageSignedIn(page, APP_URL)

    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Test Item').first()).toBeVisible({ timeout: 10_000 })
  })

  test('can create a published item', async ({ page }) => {
    await goToTestPageSignedIn(page, APP_URL)

    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Public Item').first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('member — update own items', () => {
  test('can update own item', async ({ page }) => {
    await goToTestPageSignedIn(page, APP_URL)

    // Create an item first
    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })

    // Get the created item's recordId from the result
    const resultText = await page.locator('[data-testid="test-last-result"]').textContent()
    const recordId = resultText!.replace('created:', '')

    // Click update button on that item
    await page.locator(`[data-testid="test-update-${recordId}"]`).click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText(`updated:${recordId}`, { timeout: 10_000 })

    // Verify the title changed
    await expect(page.locator(`[data-testid="test-item-${recordId}"]`).getByText('Updated Title')).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('member — delete own items', () => {
  test('can delete own item', async ({ page }) => {
    await goToTestPageSignedIn(page, APP_URL)

    // Create an item
    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })

    const resultText = await page.locator('[data-testid="test-last-result"]').textContent()
    const recordId = resultText!.replace('created:', '')

    // Delete it
    await page.locator(`[data-testid="test-delete-${recordId}"]`).click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText(`deleted:${recordId}`, { timeout: 10_000 })

    // Verify it's gone
    await expect(page.locator(`[data-testid="test-item-${recordId}"]`)).not.toBeAttached({ timeout: 5_000 })
  })
})
