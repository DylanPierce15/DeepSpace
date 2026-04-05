/**
 * Teams Collab feature tests.
 * Verifies the teams page loads with header and content area.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Teams Collab', () => {
  test('page loads and shows Teams header', async ({ page }) => {
    await page.goto(`${APP_URL}/teams`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify the Teams heading is visible
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 15_000 })

    // Verify the subtitle
    await expect(page.getByText('Collaborate with shared documents')).toBeVisible({ timeout: 10_000 })
  })

  test('Create Team button is visible for signed-in user', async ({ page }) => {
    await page.goto(`${APP_URL}/teams`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible({ timeout: 10_000 })
  })
})
