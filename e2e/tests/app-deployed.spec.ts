/**
 * E2E: Real starter template deployed via WfP.
 * Tests the full SDK app experience — HTML, auth providers, static assets.
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

test.describe('Deployed SDK app', () => {
  test('app is reachable', async ({ page }) => {
    const res = await page.goto(APP_BASE)
    expect(res?.status()).toBe(200)
  })

  test('serves HTML with title', async ({ page }) => {
    await page.goto(APP_BASE)
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

  test('has React mount point', async ({ page }) => {
    await page.goto(APP_BASE)
    const root = page.locator('#root')
    await expect(root).toBeAttached()
  })

  test('SPA fallback works', async ({ page }) => {
    const res = await page.goto(`${APP_BASE}/some/deep/route`)
    expect(res?.status()).toBe(200)
    const root = page.locator('#root')
    await expect(root).toBeAttached()
  })
})
