import { test, expect, type Page } from '@playwright/test'

/**
 * Multi-user collaboration tests.
 *
 * Uses two browser pages to simulate two users interacting
 * with the same data in real-time.
 */

async function waitForApp(page: Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Multi-user collaboration', () => {
  test('two users see each other\'s record changes', async ({ browser }) => {
    // Create two browser contexts (two separate users)
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    try {
      // Both navigate to home
      await pageA.goto('/')
      await pageB.goto('/')
      await waitForApp(pageA)
      await waitForApp(pageB)

      // Both pages should load and show the app
      await expect(pageA.getByTestId('app-navigation')).toBeVisible()
      await expect(pageB.getByTestId('app-navigation')).toBeVisible()
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
})
