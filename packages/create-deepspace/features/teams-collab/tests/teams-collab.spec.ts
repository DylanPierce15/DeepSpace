/**
 * Teams Collab feature tests.
 * Verifies the teams page loads with header and content area.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Teams Collab', () => {
  test('page loads and shows Teams header', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Wait for Teams nav link to appear (member role resolves)
    const teamsLink = page.locator('a[href="/teams"]')
    await expect(teamsLink).toBeVisible({ timeout: 10_000 })

    // Click to navigate
    await teamsLink.click()
    await page.waitForTimeout(500)

    await expect(page.locator('h1', { hasText: 'Teams' })).toBeVisible({ timeout: 15_000 })
  })

  test('Create Team button is visible', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await page.locator('a[href="/teams"]').click()
    await page.waitForTimeout(500)

    await expect(page.locator('h1', { hasText: 'Teams' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible({ timeout: 10_000 })
  })
})
