/**
 * Presence feature tests.
 *
 * Tests real-time presence tracking via PresenceRoom DO:
 * - Single user connects and sees presence page
 * - Two users see each other in the peers list
 * - State updates (cursor, typing) propagate between users
 * - User leaving removes them from the peers list
 */

import { test, expect, APP_URL } from './fixtures'
import { signIn } from './helpers'

const PRESENCE_URL = `${APP_URL}/presence-test`

/** Navigate to presence test page and sign in. */
async function goToPresenceSignedIn(page: import('@playwright/test').Page, user: 1 | 2 = 1) {
  await page.goto(PRESENCE_URL, { waitUntil: 'networkidle' })
  await signIn(page, user)
  await expect(page.locator('[data-testid="presence-test-page"]')).toBeVisible({ timeout: 20_000 })
  // Wait for WebSocket connection
  await expect(page.locator('[data-testid="presence-connected"]')).toHaveText('true', { timeout: 15_000 })
}

// ============================================================================
// Single user — page load and connection
// ============================================================================

test.describe('presence — connection', () => {
  test('shows presence page after sign-in', async ({ page }) => {
    await goToPresenceSignedIn(page)
    await expect(page.locator('[data-testid="presence-test-page"]')).toBeVisible()
  })

  test('connects to presence WebSocket', async ({ page }) => {
    await goToPresenceSignedIn(page)
    await expect(page.locator('[data-testid="presence-connected"]')).toHaveText('true')
    await expect(page.locator('[data-testid="presence-scope"]')).toHaveText('test-presence-room')
  })

  test('shows no peers when alone', async ({ page }) => {
    await goToPresenceSignedIn(page)
    await expect(page.locator('[data-testid="presence-peer-count"]')).toHaveText('0', { timeout: 5_000 })
    await expect(page.locator('[data-testid="presence-peers-empty"]')).toBeVisible()
  })
})

// ============================================================================
// Two users — peer detection
// ============================================================================

test.describe('presence — two users', () => {
  test('user 2 sees user 1 in the peers list', async ({ browser }) => {
    // User 1 connects
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToPresenceSignedIn(page1, 1)

    // User 2 connects
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToPresenceSignedIn(page2, 2)

    // User 2 should see user 1 as a peer (and vice versa)
    // The peer count should be 1 for each (they don't see themselves)
    await expect(page2.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })
    await expect(page1.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })

  test('user leaving removes them from peers list', async ({ browser }) => {
    // User 1 connects
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToPresenceSignedIn(page1, 1)

    // User 2 connects
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToPresenceSignedIn(page2, 2)

    // Both should see each other
    await expect(page1.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })
    await expect(page2.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })

    // User 2 navigates away (closes context)
    await ctx2.close()

    // User 1 should see peer count drop to 0
    await expect(page1.locator('[data-testid="presence-peer-count"]')).toHaveText('0', { timeout: 10_000 })
    await expect(page1.locator('[data-testid="presence-peers-empty"]')).toBeVisible()

    await ctx1.close()
  })
})

// ============================================================================
// State updates
// ============================================================================

test.describe('presence — state updates', () => {
  test('cursor position propagates between users', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToPresenceSignedIn(page1, 1)

    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToPresenceSignedIn(page2, 2)

    // Wait for mutual visibility
    await expect(page1.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })
    await expect(page2.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })

    // User 1 sends cursor position
    await page1.locator('[data-testid="presence-send-cursor"]').click()

    // Get user1's sent cursor value
    const cursorText = await page1.locator('[data-testid="presence-local-cursor"]').textContent()

    // User 2 should see user 1's cursor in the peers list
    // Find the peer entry for user 1 (we don't know the exact userId, but there's only one peer)
    const peerCursor = page2.locator('[data-testid^="presence-peer-cursor-"]').first()
    await expect(peerCursor).toBeVisible({ timeout: 10_000 })
    await expect(peerCursor).toContainText(`cursor: ${cursorText}`)

    await ctx1.close()
    await ctx2.close()
  })

  test('typing indicator propagates between users', async ({ browser }) => {
    const ctx1 = await browser.newContext()
    const page1 = await ctx1.newPage()
    await goToPresenceSignedIn(page1, 1)

    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    await goToPresenceSignedIn(page2, 2)

    // Wait for mutual visibility
    await expect(page1.locator('[data-testid="presence-peer-count"]')).toHaveText('1', { timeout: 10_000 })

    // User 1 starts typing
    await page1.locator('[data-testid="presence-send-typing"]').click()

    // User 2 should see "typing..." indicator
    const peerTyping = page2.locator('[data-testid^="presence-peer-typing-"]').first()
    await expect(peerTyping).toHaveText('typing...', { timeout: 10_000 })

    // User 1 stops typing
    await page1.locator('[data-testid="presence-stop-typing"]').click()

    // User 2 should see "idle"
    await expect(peerTyping).toHaveText('idle', { timeout: 10_000 })

    await ctx1.close()
    await ctx2.close()
  })
})
