/**
 * Local: Messaging tests — channels, messages, edit, delete, reactions.
 */

import { test, expect, APP_URL } from './fixtures'

async function signIn(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="nav-sign-in-button"]').click()
  const overlay = page.locator('[data-testid="auth-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  await overlay.locator('input[type="email"]').fill('local-test@deepspace.test')
  await overlay.locator('input[type="password"]').fill('LocalTestPass123!')
  await overlay.locator('button[type="submit"]').click()
  await expect(overlay).not.toBeVisible({ timeout: 15_000 })
}

/** Create a channel, select it, join it, and wait for message input. */
async function setupChannel(page: import('@playwright/test').Page, name?: string) {
  await page.goto(`${APP_URL}/messaging`, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-testid="messaging-page"]')).toBeVisible({ timeout: 10_000 })
  await signIn(page)
  await page.waitForTimeout(1000) // Wait for WS reconnect with auth

  const channelName = name ?? `ch-${Date.now()}`
  await page.locator('[data-testid="channel-name-input"]').fill(channelName)
  await page.locator('[data-testid="create-channel-btn"]').click()
  await expect(page.locator('[data-testid="channel-list"]').getByText(channelName)).toBeVisible({ timeout: 10_000 })

  await page.locator('[data-testid="channel-list"]').getByText(channelName).click()
  await expect(page.locator('[data-testid="join-channel-btn"]')).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-testid="join-channel-btn"]').click()
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10_000 })
}

test.describe('Messaging — channels', () => {
  test('create a channel', async ({ page }) => {
    await page.goto(`${APP_URL}/messaging`, { waitUntil: 'networkidle' })
    await signIn(page)
    await page.waitForTimeout(1000)

    const channelName = `test-${Date.now()}`
    await page.locator('[data-testid="channel-name-input"]').fill(channelName)
    await page.locator('[data-testid="create-channel-btn"]').click()
    await expect(page.locator('[data-testid="channel-list"]').getByText(channelName)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Messaging — messages', () => {
  test('send a message', async ({ page }) => {
    await setupChannel(page)
    const msg = `Hello ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="send-message-btn"]').click()
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(msg, { timeout: 10_000 })
  })

  test('send with Enter key', async ({ page }) => {
    await setupChannel(page)
    const msg = `Enter ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(msg, { timeout: 10_000 })
    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('')
  })

  test('edit a message', async ({ page }) => {
    await setupChannel(page)
    const original = `Original ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(original)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(original, { timeout: 10_000 })

    const msgEl = page.locator('[data-testid^="message-"]', { hasText: original }).first()
    await msgEl.hover()
    await msgEl.locator('[data-testid^="edit-btn-"]').click()

    const edited = `Edited ${Date.now()}`
    await page.locator('[data-testid="edit-message-input"]').clear()
    await page.locator('[data-testid="edit-message-input"]').fill(edited)
    await page.locator('[data-testid="save-edit-btn"]').click()

    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(edited, { timeout: 10_000 })
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText('(edited)', { timeout: 10_000 })
  })

  test('delete a message', async ({ page }) => {
    await setupChannel(page)
    const msg = `Delete me ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(msg, { timeout: 10_000 })

    const msgEl = page.locator('[data-testid^="message-"]', { hasText: msg }).first()
    await msgEl.hover()
    await msgEl.locator('[data-testid^="delete-btn-"]').click()
    await expect(page.locator('[data-testid="messages-feed"]')).not.toContainText(msg, { timeout: 10_000 })
  })

  test('add a reaction', async ({ page }) => {
    await setupChannel(page)
    const msg = `React ${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator('[data-testid="messages-feed"]')).toContainText(msg, { timeout: 10_000 })

    const msgEl = page.locator('[data-testid^="message-"]', { hasText: msg }).first()
    await msgEl.hover()
    await msgEl.locator('[data-testid^="add-reaction-"]').click()
    await expect(msgEl.locator('[data-testid^="reaction-"]')).toBeVisible({ timeout: 10_000 })
    await expect(msgEl.locator('[data-testid^="reaction-"]')).toContainText('👍')
  })
})
