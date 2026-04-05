/**
 * Messaging feature tests.
 *
 * Tests the SDK-imported ChatPage component:
 * - Channel auto-creation and auto-join
 * - Sending and receiving messages
 * - Message persistence across page reloads
 * - Two-user real-time messaging
 * - Reactions (add/remove)
 * - Message editing
 * - Message deletion
 * - Hover toolbar visibility
 */

import { test, expect, APP_URL } from './fixtures'
import { signIn } from './helpers'

const CHAT_URL = `${APP_URL}/chat`

/** Navigate to chat, sign in, wait for message input to be ready. */
async function goToChatSignedIn(page: import('@playwright/test').Page, user: 1 | 2 = 1) {
  await page.goto(CHAT_URL, { waitUntil: 'networkidle' })
  await signIn(page, user)
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 20_000 })
}

/** Send a message and wait for it to appear. Returns the message text. */
async function sendMessage(page: import('@playwright/test').Page, text?: string) {
  const msg = text ?? `msg-${Date.now()}`
  await page.locator('[data-testid="message-input"]').fill(msg)
  await page.locator('[data-testid="send-message-btn"]').click()
  await expect(page.locator(`text=${msg}`)).toBeVisible({ timeout: 10_000 })
  return msg
}

/** Get the last message element and its recordId. */
async function getLastMessage(page: import('@playwright/test').Page) {
  // Message containers have data-testid="message-{timestamp}-{id}" (DIVs, not inputs or content)
  const containers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="message-"]'))
      .filter(el => el.tagName === 'DIV' && !['message-input', 'message-input-container', 'message-content', 'message-reactions'].includes(el.getAttribute('data-testid')!))
      .map(el => el.getAttribute('data-testid')!)
      .filter(id => id.length > 15) // UUIDs are long, keywords are short
  )
  const lastTestId = containers[containers.length - 1]
  const recordId = lastTestId.replace('message-', '')
  const messageEl = page.locator(`[data-testid="${lastTestId}"]`)
  return { messageEl, recordId }
}

// ============================================================================
// Channel join
// ============================================================================

test.describe('messaging — channel join', () => {
  test('shows chat page after sign-in', async ({ page }) => {
    await page.goto(CHAT_URL, { waitUntil: 'networkidle' })
    await signIn(page)
    await expect(page.locator('[data-testid="chat-page"]')).toBeVisible({ timeout: 20_000 })
  })

  test('auto-joins and shows message input', async ({ page }) => {
    await goToChatSignedIn(page)
    await expect(page.locator('[data-testid="message-input-container"]')).toBeVisible()
  })
})

// ============================================================================
// Send and receive
// ============================================================================

test.describe('messaging — send and receive', () => {
  test('can send a message and see it appear', async ({ page }) => {
    await goToChatSignedIn(page)
    await sendMessage(page)
    await expect(page.locator('[data-testid="message-input"]')).toHaveValue('')
  })

  test('message persists after page reload', async ({ page }) => {
    await goToChatSignedIn(page)
    const msg = await sendMessage(page)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(`text=${msg}`)).toBeVisible({ timeout: 10_000 })
  })

  test('Enter key sends message', async ({ page }) => {
    await goToChatSignedIn(page)
    const msg = `enter-${Date.now()}`
    await page.locator('[data-testid="message-input"]').fill(msg)
    await page.locator('[data-testid="message-input"]').press('Enter')
    await expect(page.locator(`text=${msg}`)).toBeVisible({ timeout: 10_000 })
  })
})

// ============================================================================
// Two users
// ============================================================================

test.describe('messaging — two users', () => {
  test('user 2 sees messages from user 1 in real time', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToChatSignedIn(page1, 1)
    const msg1 = await sendMessage(page1)

    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToChatSignedIn(page2, 2)
    await expect(page2.locator(`text=${msg1}`)).toBeVisible({ timeout: 10_000 })

    const msg2 = await sendMessage(page2)
    await expect(page1.locator(`text=${msg2}`)).toBeVisible({ timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })
})

// ============================================================================
// Hover toolbar
// ============================================================================

test.describe('messaging — hover toolbar', () => {
  test('toolbar hidden by default, visible on hover', async ({ page }) => {
    await goToChatSignedIn(page)
    await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    const toolbar = page.locator(`[data-testid="hover-toolbar-${recordId}"]`)

    // Move mouse away from the message area
    await page.mouse.move(0, 0)
    await page.waitForTimeout(200)

    // Hidden by default
    await expect(toolbar).toHaveCSS('opacity', '0')

    // Visible on hover
    await messageEl.hover()
    await expect(toolbar).toHaveCSS('opacity', '1', { timeout: 2_000 })
  })

  test('own message toolbar has emoji, edit, delete, reply', async ({ page }) => {
    await goToChatSignedIn(page)
    await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()

    const toolbar = page.locator(`[data-testid="hover-toolbar-${recordId}"]`)
    await expect(toolbar.locator('[data-testid="toolbar-emoji-👍"]')).toBeVisible({ timeout: 2_000 })
    await expect(toolbar.locator(`[data-testid="edit-btn-${recordId}"]`)).toBeVisible()
    await expect(toolbar.locator(`[data-testid="delete-btn-${recordId}"]`)).toBeVisible()
    await expect(toolbar.locator(`[data-testid="reply-btn-${recordId}"]`)).toBeVisible()
  })
})

// ============================================================================
// Reactions
// ============================================================================

test.describe('messaging — reactions', () => {
  test('can add a reaction via toolbar', async ({ page }) => {
    await goToChatSignedIn(page)
    await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()

    const toolbar = page.locator(`[data-testid="hover-toolbar-${recordId}"]`)
    await toolbar.locator('[data-testid="toolbar-emoji-👍"]').click()

    // Wait for the reaction to be processed and rendered
    await expect(messageEl.locator('[data-testid="message-reactions"]')).toBeVisible({ timeout: 10_000 })
  })

  test('can toggle reaction off', async ({ page }) => {
    await goToChatSignedIn(page)
    await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()

    const toolbar = page.locator(`[data-testid="hover-toolbar-${recordId}"]`)
    await toolbar.locator('[data-testid="toolbar-emoji-❤️"]').click()
    await expect(messageEl.locator('[data-testid="message-reactions"]')).toBeVisible({ timeout: 5_000 })

    // Click the reaction pill to toggle off
    await messageEl.locator('[data-testid="message-reactions"] button').first().click()
    await expect(messageEl.locator('[data-testid="message-reactions"]')).not.toBeVisible({ timeout: 5_000 })
  })
})

// ============================================================================
// Edit
// ============================================================================

test.describe('messaging — edit', () => {
  test('can edit own message', async ({ page }) => {
    await goToChatSignedIn(page)
    const originalMsg = await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()

    // Click edit
    await page.locator(`[data-testid="edit-btn-${recordId}"]`).click()

    // Edit textarea appears
    const editInput = page.locator('[data-testid="edit-message-input"]')
    await expect(editInput).toBeVisible({ timeout: 2_000 })

    // Type new content and save
    const editedMsg = `edited-${Date.now()}`
    await editInput.fill(editedMsg)
    await page.locator('[data-testid="save-edit-btn"]').click()

    // Verify edit applied
    await expect(page.locator(`text=${editedMsg}`)).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=(edited)')).toBeVisible()
  })

  test('Escape cancels edit', async ({ page }) => {
    await goToChatSignedIn(page)
    const originalMsg = await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()
    await page.locator(`[data-testid="edit-btn-${recordId}"]`).click()

    const editInput = page.locator('[data-testid="edit-message-input"]')
    await expect(editInput).toBeVisible({ timeout: 2_000 })
    await editInput.fill('should be cancelled')
    await editInput.press('Escape')

    await expect(page.locator(`text=${originalMsg}`)).toBeVisible()
    await expect(editInput).not.toBeVisible()
  })
})

// ============================================================================
// Delete
// ============================================================================

test.describe('messaging — delete', () => {
  test('can delete own message', async ({ page }) => {
    await goToChatSignedIn(page)
    const msg = await sendMessage(page)

    const { messageEl, recordId } = await getLastMessage(page)
    await messageEl.hover()

    await page.locator(`[data-testid="delete-btn-${recordId}"]`).click()
    await expect(page.locator(`text=${msg}`)).not.toBeVisible({ timeout: 5_000 })
  })
})

// ============================================================================
// Anonymous
// ============================================================================

test.describe('messaging — anonymous', () => {
  test('anonymous user cannot send messages', async ({ page }) => {
    await page.goto(CHAT_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="message-input"]')).not.toBeVisible({ timeout: 5_000 })
  })
})
