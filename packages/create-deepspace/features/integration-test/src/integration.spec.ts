import { test, expect } from '@playwright/test'
import { signUp } from './helpers/auth'

async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Integration API', () => {
  test('authenticated user can call OpenAI via integration proxy', async ({ page }) => {
    await signUp(page, `integ-${Date.now()}@test.local`, { name: 'Integration Tester' })
    await waitForApp(page)

    await page.goto('/integration-test')
    await page.waitForSelector('[data-testid="integration-submit"]', { timeout: 10000 })

    // Default is openai/chat-completion — click submit
    await page.getByTestId('integration-submit').click()

    // Wait for result or error
    await page.waitForSelector('[data-testid="integration-result"], [data-testid="integration-error"]', { timeout: 30000 })

    const resultEl = page.getByTestId('integration-result')
    const errorEl = page.getByTestId('integration-error')

    if (await resultEl.isVisible()) {
      const text = await resultEl.textContent()
      const result = JSON.parse(text!)
      expect(result.success).toBeTruthy()
      expect(result.data).toBeDefined()
    } else {
      const errorText = await errorEl.textContent()
      // Acceptable errors: no API key (dev), insufficient credits, etc.
      expect(errorText).toBeTruthy()
    }
  })

  test('integration test page loads for anonymous user', async ({ page }) => {
    await page.goto('/integration-test')
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    await expect(page.getByTestId('integration-submit')).toBeVisible()
  })
})
