/**
 * Landing Page feature tests.
 * Verifies hero section, CTA button, and footer are visible. No auth needed.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'

const APP_URL = 'http://localhost:5173'

test.describe('Landing Page', () => {
  test('hero section and CTA are visible', async ({ page }) => {
    await page.goto(`${APP_URL}/welcome`, { waitUntil: 'networkidle' })

    // Verify the hero headline is visible (rendered via Typewriter component)
    await expect(page.getByText('Welcome to My App')).toBeVisible({ timeout: 15_000 })

    // Verify CTA button is visible
    await expect(page.getByRole('button', { name: 'Get Started' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('footer is visible on scroll', async ({ page }) => {
    await page.goto(`${APP_URL}/welcome`, { waitUntil: 'networkidle' })

    // Scroll to the bottom of the page to see the footer
    const scrollContainer = page.locator('.scrollable-content-layer')
    await scrollContainer.evaluate(el => el.scrollTo(0, el.scrollHeight))

    // Verify footer content
    await expect(page.getByText('All rights reserved.')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Built with DeepSpace')).toBeVisible()
  })
})
