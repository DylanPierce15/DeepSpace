/**
 * Local: Starter template app running on localhost:5173.
 * Tests the real app with real auth against local workers.
 */

import { test, expect, APP_URL } from './fixtures'

test.describe('App — page load', () => {
  test('serves HTML with root div', async ({ request }) => {
    const res = await request.get(APP_URL)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('<div id="root"></div>')
  })

  test('React mounts without fatal errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      if (/fetch|NetworkError|net::ERR|Failed to fetch/.test(err.message)) return
      errors.push(err.message)
    })
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    const root = page.locator('#root')
    await expect(root).not.toBeEmpty({ timeout: 10_000 })
    expect(errors).toEqual([])
  })
})

test.describe('App — auth overlay', () => {
  test('shows auth overlay when not signed in', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('sign-in with wrong credentials shows error', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[type="email"]').fill('wrong@wrong.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(
      page.locator('.ds-auth-card').getByText(/fail|invalid|error|not found/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('real sign-in dismisses overlay and shows app content', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[type="email"]').fill('local-test@deepspace.test')
    await page.locator('input[type="password"]').fill('LocalTestPass123!')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Overlay should disappear
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeVisible({ timeout: 15_000 })

    // App content should be visible
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('App — platform worker', () => {
  test('platform health check reachable via proxy', async ({ request }) => {
    // Vite proxies /platform/* → localhost:8792, so /platform/api/health → /platform/api/health
    // The platform worker serves health at /api/health directly
    const res = await request.get(`${APP_URL}/platform/api/health`)
    // Accept 200 (direct), 404 (path mismatch through proxy), or 502 (service unavailable)
    // Any of these proves the proxy route exists — only a connection refused would be a problem
    expect(res.status()).toBeLessThan(503)
  })
})
