/**
 * Dashboard UI tests — verifies the dashboard pages render correctly
 * with data from the API.
 *
 * These tests navigate the dashboard with a signed-in session and verify
 * that pages load, display real data, and handle interactions.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, expect, DASHBOARD_URL } from './fixtures'

// Helper: sign in to the dashboard by setting session cookies directly.
// The dashboard uses Better Auth social login (GitHub/Google) which can't
// be automated in tests. Instead we set the session cookie from global setup.
async function signInToDashboard(page: import('@playwright/test').Page) {
  const auth = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../.auth-state.json'), 'utf-8'),
  )

  const cookies = auth.sessionToken.split('; ').map((pair: string) => {
    const [name, ...rest] = pair.split('=')
    return {
      name,
      value: rest.join('='),
      domain: 'localhost',
      path: '/',
    }
  })

  await page.context().addCookies(cookies)
}

test.describe('Dashboard — sign-in gate', () => {
  test('shows sign-in screen when not authenticated', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' })
    // Should show the sign-in screen
    await expect(page.locator('text=DeepSpace Console')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Continue with GitHub')).toBeVisible()
    await expect(page.locator('text=Continue with Google')).toBeVisible()
  })
})

test.describe('Dashboard — apps page', () => {
  test.beforeEach(async ({ page }) => {
    await signInToDashboard(page)
  })

  test('loads and shows deployed apps', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' })

    // Wait for the apps page to load
    await expect(page.locator('text=Your Apps')).toBeVisible({ timeout: 10_000 })

    // Should show the seeded test apps
    await expect(page.locator('h3:has-text("test-app-one")')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('h3:has-text("test-app-two")')).toBeVisible()
  })

  test('can navigate to app detail page', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('h3:has-text("test-app-one")')).toBeVisible({ timeout: 15_000 })

    // Click on an app card
    await page.locator('h3:has-text("test-app-one")').click()
    await page.waitForURL('**/apps/test-app-one')

    // App detail page header
    await expect(page.locator('h2:has-text("test-app-one")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=test-app-one.app.space')).toBeVisible()

    // Undeploy button should be present
    await expect(page.locator('text=Undeploy')).toBeVisible()

    // Period selector tabs
    await expect(page.locator('button:has-text("24h")')).toBeVisible()
    await expect(page.locator('button:has-text("7d")')).toBeVisible()
  })
})

test.describe('Dashboard — billing page', () => {
  test.beforeEach(async ({ page }) => {
    await signInToDashboard(page)
  })

  test('shows billing data', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/billing`, { waitUntil: 'networkidle' })

    await expect(page.locator('h2:has-text("Billing")')).toBeVisible({ timeout: 10_000 })

    // Plan section
    await expect(page.locator('text=Current Plan')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Free')).toBeVisible()

    // Credits
    await expect(page.locator('text=credits remaining')).toBeVisible()

    // Upgrade button should be visible for free tier
    await expect(page.locator('text=Upgrade')).toBeVisible()
  })
})

test.describe('Dashboard — settings page', () => {
  test.beforeEach(async ({ page }) => {
    await signInToDashboard(page)
  })

  test('shows user profile', async ({ page }) => {
    await page.goto(`${DASHBOARD_URL}/settings`, { waitUntil: 'networkidle' })

    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Profile')).toBeVisible()
    await expect(page.locator('text=Authentication')).toBeVisible()

    // Sign out button
    await expect(page.locator('text=Sign out').first()).toBeVisible()
  })
})

test.describe('Dashboard — sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signInToDashboard(page)
  })

  test('sidebar links navigate between pages', async ({ page }) => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' })
    await expect(page.locator('text=Your Apps')).toBeVisible({ timeout: 10_000 })

    // Navigate to Billing
    await page.locator('aside a:has-text("Billing")').click()
    await page.waitForURL('**/billing')
    await expect(page.locator('h2:has-text("Billing")')).toBeVisible({ timeout: 10_000 })

    // Navigate to Settings
    await page.locator('aside a:has-text("Settings")').click()
    await page.waitForURL('**/settings')
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 10_000 })

    // Navigate back to Apps
    await page.locator('aside a:has-text("Apps")').click()
    await page.waitForURL('**/')
    await expect(page.locator('h2:has-text("Your Apps")')).toBeVisible({ timeout: 10_000 })
  })
})
