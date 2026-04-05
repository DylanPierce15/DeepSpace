/**
 * RBAC Test Page feature tests.
 * Verifies page load with test sections visible.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('RBAC Test Page', () => {
  test('page loads with test sections visible', async ({ page }) => {
    await page.goto(`${APP_URL}/rbac-test`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify heading
    await expect(page.getByRole('heading', { name: 'RBAC Test Harness' })).toBeVisible({ timeout: 10_000 })

    // Verify the role badge is shown
    await expect(page.getByText('Member').first()).toBeVisible({ timeout: 10_000 })

    // Verify test sections are visible
    await expect(page.getByText('1. Notes')).toBeVisible()
    await expect(page.getByText('2. Bounties')).toBeVisible()
    await expect(page.getByText('3. Team Posts')).toBeVisible()
    await expect(page.getByText('4. Secrets')).toBeVisible()
    await expect(page.getByText('5. Error Types')).toBeVisible()

    // Verify "Your Permissions" info box is visible
    await expect(page.getByText('Your Permissions')).toBeVisible()
  })
})
