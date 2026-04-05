/**
 * Admin Page feature tests.
 * Verifies that non-admin users cannot access the admin page.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Admin Page', () => {
  test('member is redirected away from admin page', async ({ page }) => {
    await page.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Navigate to /admin — ProtectedRoute should redirect member back to /home
    await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    // Should be on /home, not /admin
    await expect(page).toHaveURL(/\/home/)
  })
})
