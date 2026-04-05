/**
 * Admin Page feature tests.
 * Verifies that non-admin users see access denied.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Admin Page', () => {
  test('member sees access denied', async ({ page }) => {
    await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Member role should see the access denied message
    await expect(page.getByText('Access Denied')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("You don't have permission to view this page.")).toBeVisible()
  })
})
