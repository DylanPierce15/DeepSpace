/**
 * Dashboard API tests — verifies deploy-worker and api-worker endpoints
 * used by the dashboard.
 */

import { test, expect, DEPLOY_URL, API_URL } from './fixtures'

test.describe('Deploy worker — apps API', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${DEPLOY_URL}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('deepspace-deploy')
  })

  test('GET /api/apps without auth returns 401', async ({ request }) => {
    const res = await request.get(`${DEPLOY_URL}/api/apps`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/apps returns seeded test apps', async ({ authedRequest, auth }) => {
    const res = await authedRequest.get(`${DEPLOY_URL}/api/apps`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.apps).toBeDefined()
    expect(Array.isArray(body.apps)).toBe(true)

    // Should contain the two seeded apps
    const appIds = body.apps.map((a: { appId: string }) => a.appId)
    expect(appIds).toContain('test-app-one')
    expect(appIds).toContain('test-app-two')

    // Each app has correct structure
    for (const app of body.apps) {
      expect(app.appId).toBeTruthy()
      expect(app.ownerUserId).toBe(auth.userId)
      expect(app.deployedAt).toBeTruthy()
      expect(app.url).toMatch(/^https:\/\/.*\.app\.space$/)
    }
  })

  test('GET /api/apps/:appName/analytics without auth returns 401', async ({ request }) => {
    const res = await request.get(`${DEPLOY_URL}/api/apps/test-app-one/analytics`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/apps/:appName/analytics for non-existent app returns 404', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${DEPLOY_URL}/api/apps/no-such-app/analytics`)
    expect(res.status()).toBe(404)
  })

  test('GET /api/apps/:appName/analytics validates period param', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${DEPLOY_URL}/api/apps/test-app-one/analytics?period=invalid`)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid period')
  })

  test('GET /api/apps/:appName/analytics returns analytics structure', async ({ authedRequest }) => {
    // This calls the real CF GraphQL API, which may return empty data in local dev
    // (no actual traffic). We verify the response structure, not the values.
    const res = await authedRequest.get(`${DEPLOY_URL}/api/apps/test-app-one/analytics?period=24h`)

    // If CF API token is not set, we'll get a 502 — that's expected in local dev
    if (res.status() === 502) {
      console.log('[test] Analytics returned 502 — expected without CF API credentials')
      return
    }

    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('totals')
    expect(body).toHaveProperty('cpuTime')
    expect(body).toHaveProperty('timeseries')
    expect(body).toHaveProperty('period', '24h')
    expect(body.totals).toHaveProperty('requests')
    expect(body.totals).toHaveProperty('errors')
    expect(body.totals).toHaveProperty('subrequests')
  })
})

test.describe('API worker — usage API', () => {
  test('GET /api/usage/summary without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/usage/summary`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/usage/summary returns usage structure', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${API_URL}/api/usage/summary`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()

    // Credits structure
    expect(body).toHaveProperty('credits')
    expect(body.credits).toHaveProperty('userId')
    expect(body.credits).toHaveProperty('credits')
    expect(body.credits).toHaveProperty('subscriptionCredits')
    expect(body.credits).toHaveProperty('bonusCredits')
    expect(body.credits).toHaveProperty('purchasedCredits')

    // Usage arrays
    expect(body).toHaveProperty('usageByIntegration')
    expect(Array.isArray(body.usageByIntegration)).toBe(true)
    expect(body).toHaveProperty('recentUsage')
    expect(Array.isArray(body.recentUsage)).toBe(true)
  })

  test('GET /api/users/me returns user profile', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${API_URL}/api/users/me`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('subscriptionTier')
    expect(body.subscriptionTier).toBe('free')
    expect(body.email).toBe('dashboard-test@deepspace.test')
  })
})
