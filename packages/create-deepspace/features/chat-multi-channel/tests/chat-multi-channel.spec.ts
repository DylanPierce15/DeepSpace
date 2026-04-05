/**
 * Chat Multi-Channel feature tests.
 * Verifies the multi-channel chat page loads with sidebar and channel list.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Chat Multi-Channel', () => {
  test('page loads and shows sidebar with channel list', async ({ page }) => {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify main page container is visible
    await expect(page.locator('[data-testid="chat-multi-page"]')).toBeVisible({ timeout: 15_000 })

    // Verify sidebar is visible with channel list
    await expect(page.locator('[data-testid="channel-sidebar"]')).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar shows Messages header and search input', async ({ page }) => {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="channel-sidebar"]')).toBeVisible({ timeout: 15_000 })

    // Verify header text
    await expect(page.locator('[data-testid="channel-sidebar"]').getByText('Messages')).toBeVisible()

    // Verify search input
    await expect(page.locator('[data-testid="sidebar-search"]')).toBeVisible()
  })

  test('new message button is visible', async ({ page }) => {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.locator('[data-testid="channel-sidebar"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="new-message-btn"]')).toBeVisible()
  })
})
