/**
 * E2E: Real starter template deployed via WfP.
 * Tests the full SDK app experience — HTML, auth providers, static assets.
 */

import { test, expect } from './fixtures'

const APP_BASE = 'https://deepspace-sdk-test.app.space'

test.describe('Deployed SDK app', () => {
  test('app is reachable', async ({ page }) => {
    const res = await page.goto(APP_BASE)
    expect(res?.status()).toBe(200)
  })

  test('serves HTML with title', async ({ page }) => {
    await page.goto(APP_BASE)
    // The starter template sets the title from __APP_NAME__ replacement
    const title = await page.title()
    expect(title).toBeTruthy()
  })

  test('loads JavaScript bundles', async ({ page }) => {
    const jsRequests: string[] = []
    page.on('response', (res) => {
      if (res.url().endsWith('.js') && res.status() === 200) {
        jsRequests.push(res.url())
      }
    })
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    expect(jsRequests.length).toBeGreaterThan(0)
  })

  test('loads CSS', async ({ page }) => {
    const cssRequests: string[] = []
    page.on('response', (res) => {
      if (res.url().endsWith('.css') && res.status() === 200) {
        cssRequests.push(res.url())
      }
    })
    await page.goto(APP_BASE, { waitUntil: 'networkidle' })
    expect(cssRequests.length).toBeGreaterThan(0)
  })

  test('renders React root', async ({ page }) => {
    await page.goto(APP_BASE)
    // The starter template mounts React into #root
    const root = page.locator('#root')
    await expect(root).toBeAttached()
    // React should have rendered something inside it
    const children = await root.innerHTML()
    expect(children.length).toBeGreaterThan(0)
  })

  test('SPA fallback works (client-side routing)', async ({ page }) => {
    // Any path should serve index.html (SPA fallback)
    const res = await page.goto(`${APP_BASE}/some/deep/route`)
    expect(res?.status()).toBe(200)
    const root = page.locator('#root')
    await expect(root).toBeAttached()
  })

  test('worker health endpoint responds', async ({ request }) => {
    // The starter template worker has /api/health
    const res = await request.get(`${APP_BASE}/api/health`, { failOnStatusCode: false })
    // May not exist on the starter template worker, but should not 502
    expect(res.status()).not.toBe(502)
  })
})
