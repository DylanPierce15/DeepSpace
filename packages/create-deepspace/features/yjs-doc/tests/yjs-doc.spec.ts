/**
 * Yjs Document feature tests.
 * Verifies the collaborative documents page loads with header and content area.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Yjs Document', () => {
  test('page loads and shows Documents header', async ({ page }) => {
    await page.goto(`${APP_URL}/yjs-docs`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Verify the Documents heading is visible
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible({ timeout: 15_000 })

    // Verify the subtitle
    await expect(page.getByText('Real-time collaborative editing')).toBeVisible({ timeout: 10_000 })
  })

  test('New Document button is visible for members', async ({ page }) => {
    await page.goto(`${APP_URL}/yjs-docs`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'New Document' })).toBeVisible({ timeout: 10_000 })
  })
})
