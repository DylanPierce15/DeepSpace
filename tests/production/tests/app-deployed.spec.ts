/**
 * E2E: Real starter template deployed via WfP.
 * Tests anonymous browsing, sign-in, navigation, and RBAC.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect } from './fixtures'

function getAppBase(): string {
  const nameFile = resolve(import.meta.dirname, '../.app-name')
  if (existsSync(nameFile)) {
    const name = readFileSync(nameFile, 'utf-8').trim()
    return `https://${name}.app.space`
  }
  return 'https://ds-sdk-e2e.app.space'
}

const APP_BASE = getAppBase()

test.describe('Deployed app — infrastructure', () => {
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

test.describe('Deployed app — anonymous browsing', () => {
  test('no fatal JS errors on page load', async ({ page }) => {
    const fatalErrors: string[] = []
    page.on('pageerror', (err) => {
      if (/fetch|NetworkError|net::ERR|Failed to fetch/.test(err.message)) return
      fatalErrors.push(err.message)
    })
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    expect(fatalErrors).toEqual([])
  })

  test('React mounts and shows content', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    const root = page.locator('#root')
    await expect(root).not.toBeEmpty({ timeout: 10_000 })
    await expect(page.getByText('Welcome')).toBeVisible({ timeout: 10_000 })
  })

  test('shows navigation with sign-in button', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="app-navigation"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="nav-sign-in-button"]')).toBeVisible()
  })

  test('no auth overlay on initial load', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeAttached()
  })
})

test.describe('Deployed app — sign-in', () => {
  test('clicking sign-in opens closeable modal', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('[data-testid="auth-overlay-close"]')).toBeVisible()
    await page.locator('[data-testid="auth-overlay-close"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeAttached({ timeout: 5_000 })
  })

  test('can switch between sign-in and sign-up modes', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await expect(overlay.getByText('Sign in to DeepSpace')).toBeVisible()
    await overlay.getByText("Don't have an account? Sign up").click()
    await expect(overlay.getByText('Create your account')).toBeVisible()
    await overlay.getByText('Already have an account? Sign in').click()
    await expect(overlay.getByText('Sign in to DeepSpace')).toBeVisible()
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await overlay.locator('input[type="email"]').fill('wrong@wrong.com')
    await overlay.locator('input[type="password"]').fill('wrongpassword')
    await overlay.locator('button[type="submit"]').click()
    await expect(overlay.getByText(/fail|invalid|error|not found/i)).toBeVisible({ timeout: 10_000 })
  })

  test('successful sign-in replaces sign-in button with user info', async ({ page }) => {
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await overlay.locator('input[type="email"]').fill('e2e-test@deepspace.test')
    await overlay.locator('input[type="password"]').fill('TestPass123!')
    await overlay.locator('button[type="submit"]').click()
    await expect(overlay).not.toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="nav-user-name"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="nav-sign-in-button"]')).not.toBeAttached()
  })
})
