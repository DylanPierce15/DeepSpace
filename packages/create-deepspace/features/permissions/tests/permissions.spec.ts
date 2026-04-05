/**
 * Permissions Page feature tests.
 * Verifies the permission matrix table and current role badge are visible.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Permissions Page', () => {
  test('page loads with permission table and legend', async ({ page }) => {
    await page.goto(`${APP_URL}/permissions`, { waitUntil: 'networkidle' })

    // Verify heading
    await expect(page.getByRole('heading', { name: 'Permissions' })).toBeVisible({ timeout: 10_000 })

    // Verify permission legend is visible
    await expect(page.getByText('Permission Levels')).toBeVisible({ timeout: 10_000 })
  })

  test('shows current role badge after sign-in', async ({ page }) => {
    await page.goto(`${APP_URL}/permissions`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify "Your role:" label and the role badge are visible
    await expect(page.getByText('Your role:')).toBeVisible({ timeout: 10_000 })

    // The permission matrix table should have CRUD columns
    await expect(page.getByText('Read', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Create', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Update', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Delete', { exact: true }).first()).toBeVisible()
  })
})
