/**
 * E2E: Verify the test app is reachable at deepspace-sdk-test.app.space
 * and serves correct responses through the WfP dispatch pipeline.
 */

import { test, expect } from '@playwright/test'

test.describe('WfP dispatch pipeline', () => {
  test('app is reachable at deepspace-sdk-test.app.space', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
  })

  test('serves HTML with correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('DeepSpace SDK Test')
  })

  test('renders heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#heading')).toHaveText('DeepSpace SDK Test App')
  })

  test('inline script fetches /api/health and updates status', async ({ page }) => {
    await page.goto('/')
    // The page's inline JS fetches /api/health and updates #status
    await expect(page.locator('#status')).toHaveText(
      /App: deepspace-sdk-test \| Status: ok/,
      { timeout: 10_000 },
    )
  })
})

test.describe('API routes via dispatch', () => {
  test('GET /api/health returns app name and status', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.app).toBe('deepspace-sdk-test')
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })

  test('POST /api/echo returns request metadata', async ({ request }) => {
    const res = await request.post('/api/echo', {
      data: { message: 'hello from e2e' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.method).toBe('POST')
    expect(body.body).toEqual({ message: 'hello from e2e' })
    expect(body.url).toContain('deepspace-sdk-test.app.space')
  })

  test('GET /api/meta returns correct hostname', async ({ request }) => {
    const res = await request.get('/api/meta')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.hostname).toBe('deepspace-sdk-test.app.space')
  })

  test('unknown path returns 404', async ({ request }) => {
    const res = await request.get('/nonexistent', {
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(404)
  })
})
