/**
 * Cloudflare REST API helpers for deploying/deleting scripts
 * in the spaces-apps dispatch namespace.
 *
 * Uses the same API endpoints as Miyagi3's miniapp-deployer and
 * the official Cloudflare "API examples" docs.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const ACCOUNT_ID = '47bdce30e4337b94e234ac9b31aee19f'
const NAMESPACE = 'spaces-apps'
const CF_API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`

export function getApiToken(): string {
  // 1. Env var (CI / explicit)
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN
  }

  // 2. Miyagi3 .env (local dev)
  const miyagiEnv = join(homedir(), 'GitHub/Miyagi3/apps/api/.env')
  if (existsSync(miyagiEnv)) {
    const content = readFileSync(miyagiEnv, 'utf-8')
    const match = content.match(/CLOUDFLARE_API_TOKEN="([^"]+)"/)
    if (match) return match[1]
  }

  // 3. Wrangler OAuth token (fallback)
  const configPaths = [
    join(homedir(), 'Library/Preferences/.wrangler/config/default.toml'),
    join(homedir(), '.wrangler/config/default.toml'),
  ]
  for (const p of configPaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8')
      const match = content.match(/oauth_token\s*=\s*"([^"]+)"/)
      if (match) return match[1]
    }
  }

  throw new Error(
    'No Cloudflare token found. Set CLOUDFLARE_API_TOKEN or run "wrangler login".',
  )
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Deploy an ES module worker script into the dispatch namespace.
 * Uses: PUT /workers/dispatch/namespaces/{ns}/scripts/{name}
 * with multipart form (metadata + module file).
 */
export async function deployScript(
  scriptName: string,
  scriptContent: string,
  token: string,
): Promise<{ success: boolean; errors?: unknown[] }> {
  const url = `${CF_API}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${scriptName}`

  const metadata = JSON.stringify({
    main_module: 'index.js',
    compatibility_date: '2025-01-01',
    compatibility_flags: ['nodejs_compat'],
  })

  // Build multipart form matching Miyagi3's deployer pattern:
  // - metadata blob with filename 'metadata'
  // - worker code blob with key and filename both 'index.js'
  const form = new FormData()
  form.append(
    'metadata',
    new Blob([metadata], { type: 'application/json' }),
    'metadata',
  )
  form.append(
    'index.js',
    new Blob([scriptContent], { type: 'application/javascript+module' }),
    'index.js',
  )

  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: form,
  })

  return res.json() as Promise<{ success: boolean; errors?: unknown[] }>
}

/**
 * Delete a script from the dispatch namespace.
 * Uses: DELETE /workers/dispatch/namespaces/{ns}/scripts/{name}
 */
export async function deleteScript(
  scriptName: string,
  token: string,
): Promise<{ success: boolean; errors?: unknown[] }> {
  const url = `${CF_API}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${scriptName}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(token),
  })

  return res.json() as Promise<{ success: boolean; errors?: unknown[] }>
}

/**
 * Check if a script exists in the dispatch namespace.
 * The GET endpoint always returns success:true with namespace metadata;
 * a real script has a non-null `result.id` field.
 */
export async function scriptExists(
  scriptName: string,
  token: string,
): Promise<boolean> {
  const url = `${CF_API}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${scriptName}`
  const res = await fetch(url, { headers: headers(token) })
  const body = await res.json() as { success: boolean; result?: { id?: string } }
  return body.success && !!body.result?.id
}
