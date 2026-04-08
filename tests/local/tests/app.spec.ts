/**
 * Local: App tests against real workers.
 * Tests page load, anonymous browsing, sign-in flow, and navigation.
 */

import { test, expect, APP_URL } from './fixtures'

// Helper: sign in via the nav bar sign-in button → auth modal
async function signIn(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="nav-sign-in-button"]').click()
  const overlay = page.locator('[data-testid="auth-overlay"]')
  await expect(overlay).toBeVisible({ timeout: 5_000 })
  // Expand the email/password form (hidden by default)
  await overlay.locator('[data-testid="auth-email-toggle"]').click()
  await overlay.locator('input[type="email"]').fill('local-test@deepspace.test')
  await overlay.locator('input[type="password"]').fill('LocalTestPass123!')
  await overlay.locator('button[type="submit"]').click()
  await expect(overlay).not.toBeVisible({ timeout: 15_000 })
}

test.describe('App — page load', () => {
  test('serves HTML with root div', async ({ request }) => {
    const res = await request.get(APP_URL)
    expect(res.ok()).toBeTruthy()
    expect(await res.text()).toContain('<div id="root"></div>')
  })

  test('React mounts without fatal errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      if (/fetch|NetworkError|net::ERR|Failed to fetch/.test(err.message)) return
      errors.push(err.message)
    })
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
    expect(errors).toEqual([])
  })
})

test.describe('App — anonymous browsing', () => {
  test('shows navigation and content without signing in', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="app-navigation"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10_000 })
  })

  test('shows sign-in button instead of user pill', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="nav-sign-in-button"]')).toBeVisible({ timeout: 10_000 })
  })

  test('no auth overlay on load', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeAttached()
  })
})

test.describe('App — sign-in flow', () => {
  test('clicking sign-in opens closeable auth modal', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('[data-testid="auth-overlay-close"]')).toBeVisible()

    // Close it
    await page.locator('[data-testid="auth-overlay-close"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeAttached({ timeout: 5_000 })
  })

  test('email form hidden by default, revealed on click', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    // Form hidden
    await expect(overlay.locator('input[type="email"]')).not.toBeAttached()
    // Click toggle
    await overlay.locator('[data-testid="auth-email-toggle"]').click()
    // Form visible
    await expect(overlay.locator('input[type="email"]')).toBeVisible()
    await expect(overlay.locator('input[type="password"]')).toBeVisible()
  })

  test('sign-in with wrong credentials shows error', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await overlay.locator('[data-testid="auth-email-toggle"]').click()
    await overlay.locator('input[type="email"]').fill('wrong@wrong.com')
    await overlay.locator('input[type="password"]').fill('wrongpassword')
    await overlay.locator('button[type="submit"]').click()
    await expect(overlay.locator('.ds-auth-card').getByText(/fail|invalid|error|not found/i)).toBeVisible({ timeout: 10_000 })
  })

  test('successful sign-in shows user info in nav', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await signIn(page)
    await expect(page.locator('[data-testid="nav-user-name"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="nav-sign-in-button"]')).not.toBeAttached()
  })
})

test.describe('App — navigation', () => {
  test('root path redirects to /home', async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/home/, { timeout: 10_000 })
  })

  test('test page accessible', async ({ page }) => {
    await page.goto(`${APP_URL}/test`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="test-page"]')).toBeVisible({ timeout: 10_000 })
  })
})
