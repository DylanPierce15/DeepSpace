/**
 * E2E: Deployed app — UI tests against a scaffolded + deployed app.
 *
 * Only runs when --deploy flag is passed to the runner (E2E_DEPLOY=1).
 * Skipped otherwise.
 */

import { test, expect, SESSION_COOKIE_NAME, getAppBase } from './fixtures'

const APP_BASE = getAppBase()
const deployed = !!APP_BASE

// Skip entire file if no deployed app
test.skip(!deployed, 'No deployed app (run with --deploy)')

test.describe('Deployed app — infrastructure', () => {
  test('serves HTML with correct structure', async ({ request }) => {
    const res = await request.get(APP_BASE!)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('<div id="root"></div>')
    expect(html).toContain('<script type="module"')
  })

  test('SPA fallback returns index.html for unknown routes', async ({ request }) => {
    const res = await request.get(`${APP_BASE}/some/deep/route`)
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain('<div id="root"></div>')
  })
})

test.describe('Deployed app — anonymous browsing', () => {
  test('React mounts without fatal errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      if (/fetch|NetworkError|net::ERR|Failed to fetch/.test(err.message)) return
      errors.push(err.message)
    })
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10_000 })
    expect(errors).toEqual([])
  })

  test('shows sign-in button', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-testid="nav-sign-in-button"]')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Deployed app — R2 file storage', () => {
  test('upload, list, download, delete cycle', async ({ authedRequest }) => {
    const base = APP_BASE!

    // Upload a file
    const uploadRes = await authedRequest.fetch(`${base}/api/files/upload?scope=self`, {
      method: 'POST',
      multipart: {
        file: { name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('hello from e2e') },
      },
    })
    expect(uploadRes.status()).toBe(200)
    const upload = await uploadRes.json() as { success: boolean; key: string; url: string }
    expect(upload.success).toBe(true)
    expect(upload.key).toBeTruthy()

    // List files — should include our upload
    const listRes = await authedRequest.fetch(`${base}/api/files?scope=self`)
    expect(listRes.status()).toBe(200)
    const list = await listRes.json() as { files: Array<{ key: string }> }
    expect(list.files.some(f => f.key === upload.key)).toBe(true)

    // Download the file
    const dlRes = await authedRequest.fetch(`${base}/api/files/${upload.key}?scope=self`)
    expect(dlRes.status()).toBe(200)
    expect(await dlRes.text()).toBe('hello from e2e')

    // Delete the file
    const delRes = await authedRequest.fetch(`${base}/api/files/${upload.key}?scope=self`, {
      method: 'DELETE',
    })
    expect(delRes.status()).toBe(200)

    // Verify it's gone — platform worker uses safeJson so 404 is in the body
    const dl2Res = await authedRequest.fetch(`${base}/api/files/${upload.key}?scope=self`)
    const dl2Body = await dl2Res.json() as { status: number }
    expect(dl2Body.status).toBe(404)
  })
})

test.describe('Deployed app — auth overlay', () => {
  test('opens and closes', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).toBeVisible({ timeout: 5_000 })
    await page.locator('[data-testid="auth-overlay-close"]').click()
    await expect(page.locator('[data-testid="auth-overlay"]')).not.toBeAttached({ timeout: 5_000 })
  })

  test('shows OAuth buttons, email form hidden by default', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await expect(overlay.getByText('Continue with GitHub')).toBeVisible()
    await expect(overlay.getByText('Continue with Google')).toBeVisible()
    await expect(overlay.getByText('Sign in with email')).toBeVisible()
    await expect(overlay.locator('input[type="email"]')).not.toBeAttached()
    // No sign-up toggle
    await expect(overlay.getByText(/Don't have an account/i)).not.toBeVisible()
  })

  test('email toggle reveals form', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await expect(overlay).toBeVisible({ timeout: 5_000 })
    await overlay.locator('[data-testid="auth-email-toggle"]').click()
    await expect(overlay.locator('input[type="email"]')).toBeVisible()
    await expect(overlay.locator('input[type="password"]')).toBeVisible()
    await expect(overlay.locator('button[type="submit"]')).toBeVisible()
  })

  test('wrong credentials show error', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await overlay.locator('[data-testid="auth-email-toggle"]').click()
    await overlay.locator('input[type="email"]').fill('wrong@wrong.com')
    await overlay.locator('input[type="password"]').fill('wrongpassword1')
    await overlay.locator('button[type="submit"]').click()
    await expect(overlay.getByText(/fail|invalid|error|not found/i)).toBeVisible({ timeout: 10_000 })
  })

  test('successful email sign-in shows user', async ({ page }) => {
    await page.goto(APP_BASE!, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-sign-in-button"]').click()
    const overlay = page.locator('[data-testid="auth-overlay"]')
    await overlay.locator('[data-testid="auth-email-toggle"]').click()
    await overlay.locator('input[type="email"]').fill('e2e-test@deepspace.test')
    await overlay.locator('input[type="password"]').fill('TestPass123!')
    await overlay.locator('button[type="submit"]').click()
    await expect(overlay).not.toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="nav-user-name"]')).toBeVisible({ timeout: 15_000 })
  })
})
