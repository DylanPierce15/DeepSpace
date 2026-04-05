import { test, APP_URL } from './fixtures'
import { signIn } from './helpers'

test('screenshot chat page', async ({ page }) => {
  await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
  await signIn(page)
  await page.locator('[data-testid="message-input"]').waitFor({ timeout: 20_000 })

  // Send a few messages so there's content
  for (const msg of ['Hello from the test!', 'This is the SDK-imported ChatPage', 'Testing reactions and editing next']) {
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="send-message-btn"]').click()
    await page.waitForTimeout(500)
  }

  await page.waitForTimeout(1000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.screenshot({ path: '/tmp/chat-screenshot.png' })
})
