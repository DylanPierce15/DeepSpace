/**
 * Feature test: messaging
 *
 * Assumes the deployed app has `npx deepspace add messaging` installed,
 * which routes `/chat` → the single-channel `ChatPage` component backed
 * by the messaging schemas and the `useChatChannel` / `useMessages`
 * hooks. The channel defaults to `general`.
 *
 * The spec exercises the end-to-end write path:
 *   signed-in browser → join channel if needed → type into MessageInput →
 *   send → message round-trips through the RecordRoom DO → appears in
 *   MessageList via the subscription. If any layer is broken (schema,
 *   WS, broadcast), the sent message won't render.
 *
 * Multi-user (A sends, B receives) is deferred — same rationale as
 * docs.spec.ts: worth adding once a second-user fixture exists, but
 * single-user send+receive is enough merge-gate signal.
 */

import { test, expect, getAppBase } from '../fixtures'

const APP_BASE = getAppBase()

test.describe('messaging: /chat basic flow', () => {
  test('page renders for signed-in user', async ({ signedInPage }) => {
    const res = await signedInPage.goto(`${APP_BASE}/chat`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(200)
    await expect(signedInPage.getByTestId('chat-page')).toBeVisible({ timeout: 20_000 })
  })

  test('send a message → shows up in feed', async ({ signedInPage }) => {
    await signedInPage.goto(`${APP_BASE}/chat`, { waitUntil: 'domcontentloaded' })
    await expect(signedInPage.getByTestId('chat-page')).toBeVisible({ timeout: 20_000 })

    // First-time viewers of a channel see a "Join Channel" button instead
    // of the composer. Click it if present; otherwise skip.
    const joinBtn = signedInPage.getByTestId('join-channel-btn')
    if (await joinBtn.isVisible().catch(() => false)) {
      await joinBtn.click()
    }

    // After join, the composer should mount.
    const input = signedInPage.getByTestId('message-input')
    await expect(input).toBeVisible({ timeout: 15_000 })

    const body = `e2e-msg-${Date.now()}`
    await input.fill(body)
    await signedInPage.getByTestId('send-message-btn').click()

    // The message should appear in the feed. MessageItem renders the body
    // in a `[data-testid="message-content"]` node; matching by text is the
    // simplest correlation since the recordId isn't exposed to the test.
    const feed = signedInPage.getByTestId('messages-feed')
    await expect(feed).toBeVisible()
    await expect(feed.getByText(body, { exact: true })).toBeVisible({ timeout: 15_000 })
  })
})
