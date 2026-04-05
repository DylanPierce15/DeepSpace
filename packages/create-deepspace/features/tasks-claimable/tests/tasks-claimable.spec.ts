/**
 * Tasks (Challenges) feature tests.
 * Verifies page load after sign-in.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Tasks Claimable', () => {
  test('page loads with heading and new challenge button', async ({ page }) => {
    await page.goto(`${APP_URL}/tasks`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify main heading
    await expect(page.locator('h1', { hasText: 'Challenges' })).toBeVisible({ timeout: 10_000 })

    // Verify "New Challenge" button is visible for members
    await expect(page.getByRole('button', { name: 'New Challenge' })).toBeVisible({ timeout: 10_000 })
  })
})
