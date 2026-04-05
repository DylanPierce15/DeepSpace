/**
 * Yjs Document — Collaborative editing tests.
 *
 * Tests real-time collaboration between two users editing the same document.
 * Uses two separate browser contexts to simulate two concurrent users.
 */

import { test, expect, APP_URL } from '../../../../../tests/local/tests/fixtures'
import { signIn } from '../../../../../tests/local/tests/helpers'

test.describe('Yjs Collaborative Editing', () => {
  test('two users see each other\'s edits in real-time', async ({ browser }) => {
    // Create two independent browser contexts (separate sessions)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // ── User 1: sign in and create a document ──
    await page1.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })
    await signIn(page1, 1)
    await page1.waitForTimeout(1000)

    // Navigate to docs page via nav link
    await page1.locator('a[href="/docs"]').click()
    await expect(page1.locator('h1', { hasText: 'Documents' })).toBeVisible({ timeout: 10_000 })

    // Create a new document
    const docTitle = `Collab Test ${Date.now()}`
    await page1.getByRole('button', { name: 'New Document' }).click()
    await page1.getByPlaceholder('e.g., Meeting Notes').fill(docTitle)
    await page1.getByRole('button', { name: 'Create' }).click()

    // Wait for document to appear in the list
    await expect(page1.getByText(docTitle)).toBeVisible({ timeout: 10_000 })

    // Open the document (click the card)
    await page1.getByText(docTitle).click()

    // Wait for the editor to load and sync
    await expect(page1.locator('textarea')).toBeVisible({ timeout: 10_000 })
    await expect(page1.getByText('Synced')).toBeVisible({ timeout: 15_000 })

    // ── User 2: sign in and open the same document ──
    await page2.goto(`${APP_URL}/home`, { waitUntil: 'networkidle' })
    await signIn(page2, 2)
    await page2.waitForTimeout(1000)

    // Navigate to docs page
    await page2.locator('a[href="/docs"]').click()
    await expect(page2.locator('h1', { hasText: 'Documents' })).toBeVisible({ timeout: 10_000 })

    // Open the same document
    await expect(page2.getByText(docTitle)).toBeVisible({ timeout: 10_000 })
    await page2.getByText(docTitle).click()

    // Wait for editor and sync
    await expect(page2.locator('textarea')).toBeVisible({ timeout: 10_000 })
    await expect(page2.getByText('Synced')).toBeVisible({ timeout: 15_000 })

    // ── User 1: type some text ──
    const testText = 'Hello from user one!'
    await page1.locator('textarea').click()
    await page1.locator('textarea').fill(testText)

    // ── Verify: User 2 sees the text ──
    await expect(page2.locator('textarea')).toHaveValue(testText, { timeout: 10_000 })

    // ── User 2: append text ──
    await page2.locator('textarea').click()
    await page2.locator('textarea').press('End')
    await page2.locator('textarea').type(' And hello from user two!')

    // ── Verify: User 1 sees the combined text ──
    const combined = testText + ' And hello from user two!'
    await expect(page1.locator('textarea')).toHaveValue(combined, { timeout: 10_000 })

    // Cleanup
    await context1.close()
    await context2.close()
  })
})
