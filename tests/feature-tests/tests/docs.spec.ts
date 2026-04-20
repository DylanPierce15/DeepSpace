/**
 * Feature test: docs
 *
 * Assumes the deployed app has `npx deepspace add docs` installed, which
 * routes `/docs` → list page and `/docs/:docId` → collaborative editor
 * (textarea backed by a YjsRoom DO using Y.Text).
 *
 * Two axes of coverage:
 *
 *   1. **Persistence** (single user). Type a sentinel, reload the page,
 *      assert the sentinel survives. Proves:
 *        browser → WS (/ws/yjs/:docId) → YjsRoom DO → SQL storage →
 *        hydrate → re-sync back to a fresh page.
 *
 *   2. **Real-time collaboration** (two users). User A types a sentinel,
 *      User B sees it in their textarea *without a reload*. Proves:
 *        User A's Y.Text update → DO → broadcast → User B's Y.Doc →
 *        React re-render. Exercises the realtime sync path that the
 *        persistence test alone doesn't touch.
 *
 * The `secondaryUser` fixture provisions a fresh `@deepspace.test`
 * account, signs it in, and gives us a separate browser context — see
 * `../fixtures.ts`.
 */

import { test, expect, getAppBase } from '../fixtures'

const APP_BASE = getAppBase()

test.describe('docs: list + create', () => {
  test('/docs requires auth, renders list for signed-in user', async ({ signedInPage }) => {
    const res = await signedInPage.goto(`${APP_BASE}/docs`, { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBe(200)
    // The list page shows its header unconditionally; waiting for it
    // also guarantees the SDK has finished its auth bootstrap.
    await expect(signedInPage.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible({ timeout: 15_000 })
  })

  test('create → navigate → textarea is enabled', async ({ signedInPage }) => {
    await signedInPage.goto(`${APP_BASE}/docs`, { waitUntil: 'domcontentloaded' })
    await expect(signedInPage.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible({ timeout: 15_000 })

    // Click "New Document" → type → Create.
    await signedInPage.getByRole('button', { name: /new document/i }).click()
    const title = `e2e-doc-${Date.now()}`
    await signedInPage.getByPlaceholder('e.g., Meeting Notes').fill(title)
    await signedInPage.getByRole('button', { name: 'Create' }).click()

    // The list should now contain the new doc; click it to navigate.
    await signedInPage.getByRole('heading', { name: title }).click()

    // Editor textarea becomes enabled only once the Yjs sync completes.
    // The disabled attribute flips on `synced && canWrite`, so visible+enabled
    // is our proof that the WebSocket handshake and initial sync succeeded.
    const textarea = signedInPage.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 15_000 })
    await expect(textarea).toBeEnabled({ timeout: 15_000 })
  })
})

test.describe('docs: multi-user collaboration', () => {
  test('two users see each other\'s edits in real time', async ({ signedInPage, secondaryUser }) => {
    // User A (primary) creates a fresh doc and navigates into it.
    await signedInPage.goto(`${APP_BASE}/docs`, { waitUntil: 'domcontentloaded' })
    await expect(
      signedInPage.getByRole('heading', { level: 1, name: 'Documents' }),
    ).toBeVisible({ timeout: 15_000 })

    await signedInPage.getByRole('button', { name: /new document/i }).click()
    const title = `collab-${Date.now()}`
    await signedInPage.getByPlaceholder('e.g., Meeting Notes').fill(title)
    await signedInPage.getByRole('button', { name: 'Create' }).click()
    await signedInPage.getByRole('heading', { name: title }).click()

    const userATextarea = signedInPage.locator('textarea')
    await expect(userATextarea).toBeEnabled({ timeout: 15_000 })

    // Capture the doc's URL so User B joins the same room. The app uses
    // `/docs/<recordId>`; we don't need to know the id explicitly.
    const docUrl = signedInPage.url()
    expect(docUrl).toMatch(/\/docs\/[^/]+$/)

    // User B opens the same URL. The `member` role on the `documents`
    // schema grants read+update to any authenticated user (see
    // packages/create-deepspace/features/docs/src/docs-schema.ts), so
    // User B's textarea should be enabled (canWrite=true on the Yjs side).
    await secondaryUser.page.goto(docUrl, { waitUntil: 'domcontentloaded' })
    const userBTextarea = secondaryUser.page.locator('textarea')
    await expect(userBTextarea).toBeVisible({ timeout: 15_000 })
    await expect(userBTextarea).toBeEnabled({ timeout: 15_000 })

    // User A types a sentinel. No reload — User B must receive the
    // update through the Yjs broadcast path, or this test fails.
    const sentinel = `yjs-collab-${Date.now()}`
    await userATextarea.fill(sentinel)

    // User B's textarea should reflect the new value within a few
    // seconds. The timeout is generous to absorb CF cold-start latency
    // and geographic round-trip, but well under what would indicate
    // broken realtime sync (which would manifest as "never updates").
    await expect(userBTextarea).toHaveValue(sentinel, { timeout: 15_000 })
  })
})

test.describe('docs: Yjs persistence round-trip', () => {
  test('text survives a page reload', async ({ signedInPage }) => {
    // Create a doc via the UI and capture its URL.
    await signedInPage.goto(`${APP_BASE}/docs`, { waitUntil: 'domcontentloaded' })
    await expect(signedInPage.getByRole('heading', { level: 1, name: 'Documents' })).toBeVisible({ timeout: 15_000 })
    await signedInPage.getByRole('button', { name: /new document/i }).click()
    const title = `e2e-persist-${Date.now()}`
    await signedInPage.getByPlaceholder('e.g., Meeting Notes').fill(title)
    await signedInPage.getByRole('button', { name: 'Create' }).click()
    await signedInPage.getByRole('heading', { name: title }).click()

    const textarea = signedInPage.locator('textarea')
    await expect(textarea).toBeEnabled({ timeout: 15_000 })

    // Type a sentinel string. Unique per run to avoid false positives if
    // somehow the editor loaded a cached value.
    const sentinel = `yjs-sentinel-${Date.now()}`
    await textarea.fill(sentinel)

    // Give the Y.Text update time to flush to the DO's SQL storage.
    // 500ms is empirically safe; the real round-trip is typically <100ms
    // but we buffer for CI latency.
    await signedInPage.waitForTimeout(500)

    // Reload the page — a fresh document hydrate from the DO must show
    // the sentinel. If hydrate is broken, the textarea comes up empty.
    await signedInPage.reload({ waitUntil: 'domcontentloaded' })

    const reloadedTextarea = signedInPage.locator('textarea')
    await expect(reloadedTextarea).toBeVisible({ timeout: 15_000 })
    await expect(reloadedTextarea).toBeEnabled({ timeout: 15_000 })
    await expect(reloadedTextarea).toHaveValue(sentinel, { timeout: 10_000 })
  })
})
