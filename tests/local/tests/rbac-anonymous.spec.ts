/**
 * RBAC — anonymous (viewer) user tests.
 * Tests role assignment, create denial, and visibility filtering.
 */

import { test, expect, APP_URL } from './fixtures'
import { goToTestPage, goToTestPageSignedIn } from './helpers'

test.describe('anonymous — connection', () => {
  test('gets viewer role', async ({ page }) => {
    await goToTestPage(page, APP_URL)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 15_000 })
  })

  test('shows not signed in', async ({ page }) => {
    await goToTestPage(page, APP_URL)
    await expect(page.locator('[data-testid="test-signed-in"]')).toHaveText('false', { timeout: 10_000 })
  })
})

test.describe('anonymous — create denied', () => {
  test('cannot create draft items', async ({ page }) => {
    await goToTestPage(page, APP_URL)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-error"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-empty"]')).toBeVisible()
  })

  test('cannot create published items', async ({ page }) => {
    await goToTestPage(page, APP_URL)
    await expect(page.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 15_000 })

    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-error"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-empty"]')).toBeVisible()
  })
})

test.describe('anonymous — visibility', () => {
  test('can see published items created by a member', async ({ page, browser }) => {
    await goToTestPageSignedIn(page, APP_URL)

    await page.locator('[data-testid="test-create-published"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Public Item')).toBeVisible({ timeout: 10_000 })

    // Anonymous context
    const anonCtx = await browser.newContext()
    const anonPage = await anonCtx.newPage()
    await goToTestPage(anonPage, APP_URL)
    await expect(anonPage.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 15_000 })
    await expect(anonPage.locator('[data-testid="test-items-list"]').getByText('Public Item')).toBeVisible({ timeout: 10_000 })
    await anonCtx.close()
  })

  test('cannot see draft items', async ({ page, browser }) => {
    await goToTestPageSignedIn(page, APP_URL)

    await page.locator('[data-testid="test-create-item"]').click()
    await expect(page.locator('[data-testid="test-last-result"]')).toContainText('created:', { timeout: 10_000 })
    await expect(page.locator('[data-testid="test-items-list"]').getByText('Test Item').first()).toBeVisible({ timeout: 10_000 })

    // Anonymous context
    const anonCtx = await browser.newContext()
    const anonPage = await anonCtx.newPage()
    await goToTestPage(anonPage, APP_URL)
    await expect(anonPage.locator('[data-testid="test-user-role"]')).toHaveText('viewer', { timeout: 15_000 })
    await anonPage.waitForTimeout(3_000)
    await expect(anonPage.locator('[data-testid="test-items-list"]').getByText('Test Item')).not.toBeVisible()
    await anonCtx.close()
  })
})
