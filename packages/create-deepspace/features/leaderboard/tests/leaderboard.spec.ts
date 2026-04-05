/**
 * Leaderboard feature tests.
 * Verifies page load and score submission.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Leaderboard', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto(`${APP_URL}/leaderboard`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible({ timeout: 10_000 })
  })

  test('signed-in member can submit a score', async ({ page }) => {
    await page.goto(`${APP_URL}/leaderboard`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Wait for "Submit Score" button (member role)
    await expect(page.getByRole('button', { name: 'Submit Score' })).toBeVisible({ timeout: 10_000 })

    // Open submit modal
    await page.getByRole('button', { name: 'Submit Score' }).click()

    // Fill in score details
    const playerName = `Player ${Date.now()}`
    await page.getByPlaceholder('Your name').clear()
    await page.getByPlaceholder('Your name').fill(playerName)
    await page.getByPlaceholder('Enter your score').fill('1234')

    // Submit
    await page.getByRole('button', { name: 'Submit' }).click()

    // Verify score appears in the table
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(playerName)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('1,234')).toBeVisible()
  })
})
