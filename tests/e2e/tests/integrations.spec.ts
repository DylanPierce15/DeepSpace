/**
 * Integration endpoint smoke tests against the deployed api-worker.
 *
 * Covers the OAuth wiring added in PR #11 (#claim-app-space-email-handles):
 * - generic /oauth/:provider/callback route exists
 * - /status returns aggregated provider connection state
 * - /disconnect requires auth
 * - Google handlers return requiresOAuth with a real authUrl when the
 *   authenticated user has no stored tokens (the legacy body.accessToken
 *   path was removed; tokens come exclusively from oauth_tokens)
 */

import { test, expect, API_URL } from './fixtures'

test.describe('integrations: OAuth wiring', () => {
  test('GET /oauth/google/callback (no params) returns 400 HTML', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/integrations/oauth/google/callback`)
    expect(res.status()).toBe(400)
    expect(res.headers()['content-type']).toMatch(/text\/html/)
    expect(await res.text()).toContain('Connection Failed')
  })

  test('GET /oauth/unknown-provider/callback returns 404', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/integrations/oauth/microsoft/callback`)
    expect(res.status()).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'Unknown OAuth provider' })
  })

  test('GET /status without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/integrations/status`)
    expect(res.status()).toBe(401)
  })

  test('GET /status as authed user returns google block', async ({ authedRequest }) => {
    const res = await authedRequest.get(`${API_URL}/api/integrations/status`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('google')
    expect(body.google).toHaveProperty('connected')
    // Test user has not connected Google → all false
    expect(body.google.connected).toBe(false)
  })

  test('DELETE /oauth/unknown/disconnect returns 404 (with auth)', async ({ authedRequest }) => {
    const res = await authedRequest.delete(`${API_URL}/api/integrations/oauth/microsoft/disconnect`)
    expect(res.status()).toBe(404)
  })
})

test.describe('integrations: Google handlers (no stored tokens)', () => {
  // Test user has no oauth_tokens row → every endpoint should return requiresOAuth
  // with a real authUrl pointing at Google consent. This validates that:
  //   1. The legacy body.accessToken path is gone (we don't pass one)
  //   2. The DB lookup runs and returns null
  //   3. oauthRequired() builds a real authUrl with signed state

  // Minimal valid body per endpoint so zod schema doesn't 400 before the OAuth
  // check runs. The values themselves don't matter — we never reach Google.
  const endpoints: Record<string, Record<string, unknown>> = {
    'gmail-send': { to: 'a@b.com', subject: 's', content: 'c' },
    'gmail-list': {},
    'gmail-get': { messageId: 'x' },
    'gmail-search': { query: 'foo' },
    'calendar-list-events': {},
    'calendar-create-event': { title: 't', start: '2026-01-01T10:00:00Z' },
    'calendar-delete-event': { eventId: 'x' },
    'drive-list': {},
    'drive-get': { fileId: 'x' },
    'contacts-list': {},
  }

  for (const [ep, body] of Object.entries(endpoints)) {
    test(`google/${ep} returns requiresOAuth with valid authUrl`, async ({ authedRequest }) => {
      const res = await authedRequest.post(`${API_URL}/api/integrations/google/${ep}`, {
        data: body,
      })

      expect(res.status(), await res.text()).toBe(200)
      // Billing layer wraps handler returns in { success, data }
      const { data } = (await res.json()) as { success: boolean; data: any }

      expect(data.requiresOAuth).toBe(true)
      expect(data.provider).toBe('google')
      expect(Array.isArray(data.scopes)).toBe(true)
      expect(data.scopes.length).toBeGreaterThan(0)
      expect(data.authUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)

      // authUrl must include a signed state token (HMAC-signed payload.signature)
      const url = new URL(data.authUrl)
      const state = url.searchParams.get('state')
      expect(state).toBeTruthy()
      expect(state).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)

      // redirect_uri must match the deployed callback (no longer api.deep.space)
      expect(url.searchParams.get('redirect_uri')).toBe(
        `${API_URL}/api/integrations/oauth/google/callback`,
      )
    })
  }

  test('legacy body.accessToken is ignored by handlers (falls through to oauthRequired)', async ({ authedRequest }) => {
    const res = await authedRequest.post(`${API_URL}/api/integrations/google/gmail-list`, {
      data: { accessToken: 'fake-token-from-old-clients' },
    })
    // Either schema rejects it (400 — strict mode) or handler ignores it and returns
    // requiresOAuth (200). What must NOT happen: a 200 with actual Gmail data, which
    // would mean the fake token was used and the legacy path still works.
    if (res.status() === 200) {
      const { data } = (await res.json()) as { success: boolean; data: any }
      expect(
        data.requiresOAuth,
        'fake accessToken must not bypass OAuth — handler should ignore it and fall through to oauthRequired',
      ).toBe(true)
    } else {
      expect(res.status()).toBe(400)
    }
  })
})
