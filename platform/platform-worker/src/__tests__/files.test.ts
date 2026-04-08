/**
 * Internal files route tests.
 *
 * Tests the /internal/files/* routes that app workers call via service binding.
 * Verifies identity token verification, upload/download/list/delete, and
 * prefix isolation between apps.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { SELF, env } from 'cloudflare:test'

// ── Helpers ──────────────────────────────────────────────────────────────────

const IDENTITY_SECRET = 'test-platform-identity-secret'

async function computeIdentityToken(appName: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(IDENTITY_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(appName))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fileHeaders(appName: string, token: string, userId?: string): Record<string, string> {
  const h: Record<string, string> = {
    'x-app-identity-token': token,
    'x-app-name': appName,
  }
  if (userId) h['x-user-id'] = userId
  return h
}

async function uploadFile(
  appName: string,
  token: string,
  fileName: string,
  content: string,
  userId?: string,
): Promise<Response> {
  const form = new FormData()
  form.append('file', new Blob([content], { type: 'text/plain' }), fileName)
  return SELF.fetch('https://fake-host/internal/files/upload', {
    method: 'POST',
    headers: fileHeaders(appName, token, userId),
    body: form,
  })
}

async function listFiles(
  appName: string,
  token: string,
  userId?: string,
  scope?: string,
): Promise<Response> {
  const params = new URLSearchParams()
  if (scope) params.set('scope', scope)
  const qs = params.toString() ? `?${params}` : ''
  return SELF.fetch(`https://fake-host/internal/files${qs}`, {
    headers: fileHeaders(appName, token, userId),
  })
}

async function downloadFile(
  appName: string,
  token: string,
  key: string,
  userId?: string,
): Promise<Response> {
  return SELF.fetch(`https://fake-host/internal/files/${key}`, {
    headers: fileHeaders(appName, token, userId),
  })
}

async function deleteFile(
  appName: string,
  token: string,
  key: string,
  userId?: string,
): Promise<Response> {
  return SELF.fetch(`https://fake-host/internal/files/${key}`, {
    method: 'DELETE',
    headers: fileHeaders(appName, token, userId),
  })
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanAppFiles(): Promise<void> {
  const bucket = (env as any).APP_FILES as R2Bucket
  const listed = await bucket.list({ prefix: 'apps/' })
  for (const obj of listed.objects) {
    await bucket.delete(obj.key)
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Internal Files API', () => {
  let tokenA: string
  let tokenB: string

  beforeAll(async () => {
    await cleanAppFiles()
    tokenA = await computeIdentityToken('app-a')
    tokenB = await computeIdentityToken('app-b')
  })

  describe('identity verification', () => {
    it('rejects requests without identity headers', async () => {
      const res = await SELF.fetch('https://fake-host/internal/files', {
        headers: {},
      })
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Missing app identity')
    })

    it('rejects requests with invalid token', async () => {
      const res = await SELF.fetch('https://fake-host/internal/files', {
        headers: {
          'x-app-identity-token': 'bad-token',
          'x-app-name': 'app-a',
        },
      })
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Invalid app identity token')
    })

    it('rejects token for wrong app name', async () => {
      // Use app-a's token but claim to be app-b
      const res = await SELF.fetch('https://fake-host/internal/files', {
        headers: {
          'x-app-identity-token': tokenA,
          'x-app-name': 'app-b',
        },
      })
      expect(res.status).toBe(403)
    })
  })

  describe('upload and download', () => {
    it('uploads a file and downloads it back', async () => {
      const uploadRes = await uploadFile('app-a', tokenA, 'hello.txt', 'Hello World', 'user-1')
      expect(uploadRes.status).toBe(200)

      const uploadBody = (await uploadRes.json()) as { success: boolean; key: string }
      expect(uploadBody.success).toBe(true)
      expect(uploadBody.key).toMatch(/^apps\/app-a\/users\/user-1\//)

      const dlRes = await downloadFile('app-a', tokenA, uploadBody.key, 'user-1')
      expect(dlRes.status).toBe(200)
      expect(await dlRes.text()).toBe('Hello World')
    })

    it('requires auth for upload (scope=self)', async () => {
      const res = await uploadFile('app-a', tokenA, 'test.txt', 'data')
      expect(res.status).toBe(401)
    })
  })

  describe('list', () => {
    it('lists files for the authenticated user', async () => {
      // Upload a file first
      await uploadFile('app-a', tokenA, 'list-test.txt', 'content', 'user-2')

      const res = await listFiles('app-a', tokenA, 'user-2')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { files: Array<{ key: string }> }
      expect(body.files.length).toBeGreaterThan(0)
      expect(body.files.every((f) => f.key.startsWith('apps/app-a/users/user-2/'))).toBe(true)
    })
  })

  describe('delete', () => {
    it('deletes an uploaded file', async () => {
      const uploadRes = await uploadFile('app-a', tokenA, 'delete-me.txt', 'bye', 'user-3')
      const { key } = (await uploadRes.json()) as { key: string }

      const delRes = await deleteFile('app-a', tokenA, key, 'user-3')
      expect(delRes.status).toBe(200)

      const dlRes = await downloadFile('app-a', tokenA, key, 'user-3')
      expect(dlRes.status).toBe(404)
    })
  })

  describe('prefix isolation', () => {
    it('app-b cannot download app-a files', async () => {
      const uploadRes = await uploadFile('app-a', tokenA, 'secret.txt', 'private data', 'user-1')
      const { key } = (await uploadRes.json()) as { key: string }

      // app-b tries to download app-a's file — key starts with apps/app-a/
      // but app-b's prefix is apps/app-b/, so the key is outside scope
      const dlRes = await downloadFile('app-b', tokenB, key, 'user-1')
      expect(dlRes.status).toBe(403)

      const body = (await dlRes.json()) as { error: string }
      expect(body.error).toMatch(/outside scope/)
    })

    it('app-b cannot delete app-a files', async () => {
      const uploadRes = await uploadFile('app-a', tokenA, 'no-delete.txt', 'safe', 'user-1')
      const { key } = (await uploadRes.json()) as { key: string }

      const delRes = await deleteFile('app-b', tokenB, key, 'user-1')
      expect(delRes.status).toBe(403)
    })

    it('app-b list does not show app-a files', async () => {
      await uploadFile('app-a', tokenA, 'a-only.txt', 'aaa', 'user-1')
      await uploadFile('app-b', tokenB, 'b-only.txt', 'bbb', 'user-1')

      const resB = await listFiles('app-b', tokenB, 'user-1')
      const bodyB = (await resB.json()) as { files: Array<{ key: string }> }

      // None of app-b's listed files should be under app-a's prefix
      expect(bodyB.files.every((f) => f.key.startsWith('apps/app-b/'))).toBe(true)
    })
  })
})
