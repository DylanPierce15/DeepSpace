/**
 * Sidebar Nav feature tests.
 * Verifies the sidebar navigation component renders on the page.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'

const APP_URL = 'http://localhost:5173'

test.describe('Sidebar Nav', () => {
  test('sidebar is visible on page load', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })

    // The AppSidebar renders a <nav> element with class "sidebar"
    await expect(page.locator('nav.sidebar')).toBeVisible({ timeout: 15_000 })
  })

  test('sidebar shows navigation items', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })

    // Verify the sidebar nav section contains links
    await expect(page.locator('nav.sidebar')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.sidebar-nav-section a').first()).toBeVisible({ timeout: 10_000 })
  })
})
