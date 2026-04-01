/**
 * E2E: Test app deployed via WfP dispatch pipeline.
 * Verifies the app is reachable at deepspace-sdk-test.app.space
 * and serves correct responses through the dispatch router.
 */

import { test, expect } from './fixtures'

const APP_BASE = 'https://deepspace-sdk-test.app.space'

test.describe('WfP dispatch pipeline', () => {
  test('app is reachable', async ({ page }) => {
    const res = await page.goto(APP_BASE)
    expect(res?.status()).toBe(200)
  })

  test('serves HTML with correct title', async ({ page }) => {
    await page.goto(APP_BASE)
    await expect(page).toHaveTitle('DeepSpace SDK Test')
  })

  test('renders heading', async ({ page }) => {
    await page.goto(APP_BASE)
    await expect(page.locator('#heading')).toHaveText('DeepSpace SDK Test App')
  })

  test('inline script fetches health and updates status', async ({ page }) => {
    await page.goto(APP_BASE)
    await expect(page.locator('#status')).toHaveText(
      /App: deepspace-sdk-test \| Status: ok/,
      { timeout: 10_000 },
    )
  })
})

test.describe('API routes via dispatch', () => {
  test('GET /api/health returns app name', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.app).toBe('deepspace-sdk-test')
    expect(body.status).toBe('ok')
  })

  test('POST /api/echo returns request metadata', async ({ request }) => {
    const res = await request.post(`${APP_BASE}/api/echo`, {
      data: { message: 'hello from e2e' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.method).toBe('POST')
    expect(body.body).toEqual({ message: 'hello from e2e' })
    expect(body.url).toContain('deepspace-sdk-test.app.space')
  })

  test('GET /api/meta returns correct hostname', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/api/meta`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.hostname).toBe('deepspace-sdk-test.app.space')
  })

  test('unknown path returns 404', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/nonexistent`, { failOnStatusCode: false })
    expect(res.status()).toBe(404)
  })
})
