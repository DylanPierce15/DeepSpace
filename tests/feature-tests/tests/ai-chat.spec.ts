/**
 * Feature test: ai-chat
 *
 * Assumes the deployed app has `npx deepspace add ai-chat` installed and
 * the app worker's /api/ai/chat route is wired up (baked into the starter
 * template's worker.ts).
 *
 * /api/ai/chat uses real HTTP status codes (not safeJson) because the AI
 * SDK client parses the response as a data stream and can't handle safeJson.
 */

import { test, expect, getAppBase } from '../fixtures'

const APP_BASE = getAppBase()

test.describe('ai-chat: /assistant page', () => {
  test('renders without 404', async ({ page }) => {
    const res = await page.goto(`${APP_BASE}/assistant`, { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(200)
    const html = await page.content()
    expect(html).not.toContain('Page not found')
    // Not signed in in the browser context — should show sign-in prompt
    await expect(page.getByText(/Sign in to use the assistant/i)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('ai-chat: /api/ai/chat auth', () => {
  test('returns 401 without auth', async ({ request }) => {
    const res = await request.post(`${APP_BASE}/api/ai/chat`, {
      data: { messages: [{ role: 'user', content: 'hello' }] },
    })
    expect(res.status()).toBe(401)
  })

  test('returns 400 with empty messages array', async ({ authedRequest }) => {
    const res = await authedRequest.post(`${APP_BASE}/api/ai/chat`, {
      data: { messages: [] },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('ai-chat: /api/ai/chat streaming', () => {
  test('returns a streaming response for a simple prompt', async ({ authedRequest }) => {
    const res = await authedRequest.fetch(`${APP_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        messages: [{ role: 'user', content: 'Say hello in one word.' }],
      }),
    })

    expect(res.status()).toBe(200)
    const body = await res.text()
    // AI SDK data-stream error frames start with 3:
    if (body.startsWith('3:')) {
      throw new Error(`AI chat returned error frame: ${body}`)
    }
    expect(body.length).toBeGreaterThan(0)
  }, 60_000)

  test('can query schemas via tools', async ({ authedRequest }) => {
    const res = await authedRequest.fetch(`${APP_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'List the collections in this app. Be specific about the names.',
        }],
      }),
    })

    expect(res.status()).toBe(200)
    const body = await res.text()
    if (body.startsWith('3:')) {
      throw new Error(`AI chat returned error frame: ${body}`)
    }
    // Starter template has a "users" collection — the model should find it via schema.list
    expect(body.toLowerCase()).toContain('user')
  }, 90_000)
})
