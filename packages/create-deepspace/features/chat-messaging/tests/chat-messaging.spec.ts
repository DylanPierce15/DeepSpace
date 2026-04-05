/**
 * Chat Messaging feature tests.
 * Verifies auto-join, message send, edit, and edited indicator.
 */

import { test, expect } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

const APP_URL = 'http://localhost:5173'

test.describe('Chat Messaging', () => {
  test('auto-joins general channel and can send a message', async ({ page }) => {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Wait for auto-join to complete — the chat page and message input should appear
    await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 15_000 })

    // Send a message
    const msg = `Hello chat ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="send-message-btn"]').click()

    // Verify message appears in feed
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(msg, { timeout: 10_000 })
  })

  test('can edit a message and see edited indicator', async ({ page }) => {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    // Wait for chat to be ready
    await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 15_000 })

    // Send a message
    const original = `Edit me ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(original)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(original, { timeout: 10_000 })

    // Hover over the message to show the edit button
    const msgEl = page.locator('[data-testid^="message-"]', { hasText: original }).first()
    await msgEl.hover()
    await msgEl.locator('[data-testid^="edit-btn-"]').click()

    // Edit the message
    const edited = `Edited ${Date.now()}`
    await page.locator('[data-testid="edit-message-input"]').clear()
    await page.locator('[data-testid="edit-message-input"]').fill(edited)
    await page.locator('[data-testid="save-edit-btn"]').click()

    // Verify edited content and indicator
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(edited, { timeout: 10_000 })
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText('(edited)', { timeout: 10_000 })
  })
})
