/**
 * E2E: Platform worker — health, app registry CRUD.
 */

import { test, expect, PLATFORM_URL } from './fixtures'

test.describe('Platform worker', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get(`${PLATFORM_URL}/api/health`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('deepspace-platform')
  })

  test('PUT /api/app-registry without auth returns 401', async ({ request }) => {
    const res = await request.put(`${PLATFORM_URL}/api/app-registry/e2e-test-app`, {
      data: { name: 'test' },
    })
    expect(res.status()).toBe(401)
  })

  test('PUT + GET app registry round-trip', async ({ authedRequest }) => {
    const appId = `e2e-test-${Date.now()}`
    const metadata = { name: 'E2E Test App', description: 'Created by E2E tests' }

    // Write
    const putRes = await authedRequest.put(`${PLATFORM_URL}/api/app-registry/${appId}`, {
      data: metadata,
    })
    expect(putRes.ok()).toBeTruthy()

    // Read back
    const getRes = await authedRequest.get(`${PLATFORM_URL}/api/app-registry/${appId}`)
    expect(getRes.ok()).toBeTruthy()
    const body = await getRes.json()
    expect(body.name).toBe('E2E Test App')
    expect(body.appId).toBe(appId)
    expect(body.updatedAt).toBeTruthy()
  })

  test('GET /api/app-registry lists apps', async ({ request }) => {
    const res = await request.get(`${PLATFORM_URL}/api/app-registry`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.apps).toBeInstanceOf(Array)
  })

  test('GET /ws/app:test without auth returns 401', async ({ request }) => {
    const res = await request.get(`${PLATFORM_URL}/ws/app:test`)
    expect(res.status()).toBe(401)
  })

})
