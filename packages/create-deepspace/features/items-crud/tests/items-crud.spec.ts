/**
 * Items CRUD feature tests.
 * Verifies page load, item creation, archive, and delete.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Items CRUD', () => {
  test('page loads and shows welcome', async ({ page }) => {
    await page.goto(`${APP_URL}/items`, { waitUntil: 'networkidle' })
    await expect(page.getByText('Welcome,')).toBeVisible({ timeout: 10_000 })
  })

  test('signed-in member can create an item', async ({ page }) => {
    await page.goto(`${APP_URL}/items`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Wait for "New Item" button to appear (member role)
    await expect(page.getByRole('button', { name: 'New Item' })).toBeVisible({ timeout: 10_000 })

    // Open create modal
    await page.getByRole('button', { name: 'New Item' }).click()

    // Fill in title
    const title = `Test Item ${Date.now()}`
    await page.getByPlaceholder('Enter item title').fill(title)
    await page.getByPlaceholder('Enter description (optional)').fill('A test description')

    // Submit
    await page.getByRole('button', { name: 'Create' }).click()

    // Verify item appears in the list
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Active')).toBeVisible()
  })

  test('can archive and delete an item', async ({ page }) => {
    await page.goto(`${APP_URL}/items`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Create an item first
    const title = `Archive Me ${Date.now()}`
    await page.getByRole('button', { name: 'New Item' }).click()
    await page.getByPlaceholder('Enter item title').fill(title)
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

    // Archive the item (click the archive button in "My Items" section)
    const itemCard = page.locator('.rounded-xl', { hasText: title }).first()
    await itemCard.locator('button[title="Archive"]').click()

    // Verify the item shows "Archived" badge
    await expect(itemCard.getByText('Archived')).toBeVisible({ timeout: 10_000 })

    // Delete the item — handle the confirmation dialog
    page.on('dialog', dialog => dialog.accept())
    await itemCard.locator('button[title="Delete"]').click()

    // Verify item is removed
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10_000 })
  })
})
