/**
 * App Registry integration tests.
 *
 * Tests the R2-backed app registry CRUD operations:
 * - PUT (authenticated) to register app metadata
 * - GET single app and GET list
 * - 404 for nonexistent apps
 *
 * Since isolated storage is disabled (SQLite DOs conflict with the
 * vitest-pool-workers isolation mechanism), these tests use unique
 * app IDs and explicit cleanup to avoid cross-test interference.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { SELF, env } from 'cloudflare:test'
import { signJwt, cleanRegistry } from './test-helpers'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function putApp(
  appId: string,
  metadata: Record<string, unknown>,
): Promise<Response> {
  const token = await signJwt()
  return SELF.fetch(`https://fake-host/api/app-registry/${appId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(metadata),
  })
}

async function getApp(appId: string): Promise<Response> {
  return SELF.fetch(`https://fake-host/api/app-registry/${appId}`)
}

async function listApps(): Promise<Response> {
  return SELF.fetch('https://fake-host/api/app-registry')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('App Registry', () => {
  // Clean the bucket once before all tests in this file run
  beforeAll(async () => {
    await cleanRegistry()
  })

  describe('GET /api/app-registry/:appId', () => {
    it('returns 404 for nonexistent app', async () => {
      const res = await getApp('nonexistent-app-xyz')
      expect(res.status).toBe(404)

      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Not found')
    })
  })

  describe('PUT then GET round-trip', () => {
    it('stores and retrieves app metadata', async () => {
      const metadata = {
        name: 'My Chat App',
        description: 'A real-time chat application',
        version: '1.0.0',
      }

      // PUT to register
      const putRes = await putApp('reg-chat-app', metadata)
      expect(putRes.status).toBe(200)
      const putBody = (await putRes.json()) as { success: boolean }
      expect(putBody.success).toBe(true)

      // GET to retrieve
      const getRes = await getApp('reg-chat-app')
      expect(getRes.status).toBe(200)

      const app = (await getRes.json()) as Record<string, unknown>
      expect(app.appId).toBe('reg-chat-app')
      expect(app.name).toBe('My Chat App')
      expect(app.description).toBe('A real-time chat application')
      expect(app.version).toBe('1.0.0')
      expect(app).toHaveProperty('updatedAt')
    })

    it('overwrites existing app metadata on re-PUT', async () => {
      await putApp('reg-overwrite-app', { name: 'V1', version: '1.0.0' })

      const putRes = await putApp('reg-overwrite-app', { name: 'V2', version: '2.0.0' })
      expect(putRes.status).toBe(200)

      const getRes = await getApp('reg-overwrite-app')
      const app = (await getRes.json()) as Record<string, unknown>
      expect(app.name).toBe('V2')
      expect(app.version).toBe('2.0.0')
    })
  })

  describe('GET /api/app-registry (list)', () => {
    it('lists apps that were registered above', async () => {
      const res = await listApps()
      expect(res.status).toBe(200)

      const body = (await res.json()) as { apps: string[] }
      // At this point we have reg-chat-app and reg-overwrite-app from previous tests
      expect(body.apps).toContain('reg-chat-app')
      expect(body.apps).toContain('reg-overwrite-app')
    })

    it('includes newly registered apps', async () => {
      await putApp('reg-list-new', { name: 'New App' })

      const res = await listApps()
      expect(res.status).toBe(200)

      const body = (await res.json()) as { apps: string[] }
      expect(body.apps).toContain('reg-list-new')
    })

    it('returns empty list when bucket is cleaned', async () => {
      // Clean ALL keys including any leaked from other test files
      const bucket = (env as any).SCHEMA_REGISTRY as R2Bucket
      let listed = await bucket.list({ prefix: 'app-registry/' })
      for (const obj of listed.objects) {
        await bucket.delete(obj.key)
      }

      const res = await listApps()
      expect(res.status).toBe(200)

      const body = (await res.json()) as { apps: string[] }
      expect(body.apps).toEqual([])
    })
  })
})
