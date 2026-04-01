/**
 * E2E: API worker — user profile, credits, billing config.
 * All authenticated routes use the JWT from the test fixture.
 */

import { test, expect, API_URL } from './fixtures'

test.describe('API worker', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('deepspace-api')
  })

  test('GET /api/stripe/config returns Stripe config (public)', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/stripe/config`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toHaveProperty('enabled')
    expect(body).toHaveProperty('publishableKey')
    expect(body).toHaveProperty('priceIds')
  })

  test('GET /api/users/me without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users/me`)
    expect(res.status()).toBe(401)
  })

  test('GET /api/users/me with JWT returns user profile', async ({ authedRequest, auth }) => {
    const res = await authedRequest.get(`${API_URL}/api/users/me`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.id).toBe(auth.userId)
    expect(body.email).toBe('e2e-test@deepspace.test')
    expect(body.name).toBe('E2E Test User')
    expect(body.subscriptionTier).toBe('free')
  })

  test('GET /api/stripe/credits-available with JWT returns credits', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${API_URL}/api/stripe/credits-available`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    // Free tier = 500 credits, no usage yet
    expect(body.credits).toBe(500)
  })

  test('POST /api/integrations/openai/chat-completion without auth returns 401', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/integrations/openai/chat-completion`, {
      data: { messages: [] },
    })
    expect(res.status()).toBe(401)
  })
})
