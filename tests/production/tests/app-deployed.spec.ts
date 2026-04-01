/**
 * E2E: Real starter template deployed via WfP.
 * Tests the full user journey: load → auth overlay → sign in → see content.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, AUTH_URL } from './fixtures'

function getAppBase(): string {
  const nameFile = resolve(import.meta.dirname, '../.app-name')
  if (existsSync(nameFile)) {
    const name = readFileSync(nameFile, 'utf-8').trim()
    return `https://${name}.app.space`
  }
  return 'https://ds-sdk-e2e.app.space'
}

const APP_BASE = getAppBase()

test.describe('Deployed SDK app — infrastructure', () => {
  test('serves HTML with correct content-type and structure', async ({ request }) => {
    const res = await request.get(APP_BASE)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<script type="module"')
  })

  test('JS bundle loads with correct MIME type', async ({ request }) => {
    const html = await (await request.get(APP_BASE)).text()
    const jsPath = html.match(/src="([^"]+\.js)"/)?.[1]
    expect(jsPath).toBeTruthy()
    const res = await request.get(`${APP_BASE}${jsPath}`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('javascript')
  })

  test('CSS bundle loads with correct MIME type', async ({ request }) => {
    const html = await (await request.get(APP_BASE)).text()
    const cssPath = html.match(/href="([^"]+\.css)"/)?.[1]
    expect(cssPath).toBeTruthy()
    const res = await request.get(`${APP_BASE}${cssPath}`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/css')
  })

  test('SPA fallback returns index.html for unknown routes', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/some/deep/route`)
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain('<div id="root"></div>')
  })
})

test.describe('Deployed SDK app — auth overlay', () => {
  test('no fatal JS errors on page load', async ({ page }) => {
    const fatalErrors: string[] = []
    page.on('pageerror', (err) => {
      if (/fetch|NetworkError|net::ERR|Failed to fetch/.test(err.message)) return
      fatalErrors.push(err.message)
    })
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    expect(fatalErrors).toEqual([])
  })

  test('React mounts and renders content', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    const root = page.locator('#root')
    await expect(root).toBeAttached()
    await expect(root).not.toBeEmpty({ timeout: 10_000 })
  })

  test('shows frosted auth overlay with sign-in form', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })

    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 10_000 })

    // Form fields
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()

    // Submit button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    // Branding
    await expect(page.getByText('Sign in to DeepSpace')).toBeVisible()
    await expect(page.getByText('Powered by DeepSpace')).toBeVisible()
  })

  test('can switch between sign-in and sign-up modes', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    // Default is sign-in
    await expect(page.getByText('Sign in to DeepSpace')).toBeVisible()

    // Switch to sign-up
    await page.getByText("Don't have an account? Sign up").click()
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.locator('input[placeholder="Name"]')).toBeVisible()

    // Switch back to sign-in
    await page.getByText('Already have an account? Sign in').click()
    await expect(page.getByText('Sign in to DeepSpace')).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[type="email"]').fill('wrong@wrong.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Should show error message
    await expect(page.locator('.ds-auth-card').getByText(/fail|invalid|error|not found/i)).toBeVisible({ timeout: 10_000 })
  })

  test('app content renders behind the overlay', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    // The HomePage "Welcome" text should exist in the DOM behind the overlay
    await expect(page.getByText('Welcome')).toBeAttached({ timeout: 10_000 })
  })

  test('successful sign-in dismisses overlay and shows app', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 10_000 })

    // Sign in with the test user
    await page.locator('input[type="email"]').fill('e2e-test@deepspace.test')
    await page.locator('input[type="password"]').fill('TestPass123!')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Overlay should disappear
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeVisible({ timeout: 15_000 })

    // App content should be visible
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10_000 })
  })
})
