/**
 * Topbar Nav feature tests.
 * Verifies the topbar navigation component renders on the page.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'

const APP_URL = 'http://localhost:5173'

test.describe('Topbar Nav', () => {
  test('topbar header is visible on page load', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })

    // The Topbar renders a <header> element with sticky positioning and nav items
    await expect(page.locator('header').first()).toBeVisible({ timeout: 15_000 })
  })

  test('topbar contains navigation buttons', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })

    // Verify the topbar has a nav element with buttons
    await expect(page.locator('header').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('header nav button').first()).toBeVisible({ timeout: 10_000 })
  })
})
