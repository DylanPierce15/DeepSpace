/**
 * Cron System — Server-Side Scheduled Tasks
 *
 * Provides CronContext for miniapp cron handlers and buildCronContext
 * to construct it from worker environment bindings.
 *
 * CronContext gives handlers access to:
 *   - records: Query/create/update/delete via RecordRoom tools API
 *   - integrations: Call platform integration endpoints (billed to owner)
 *   - ownerUserId: The app owner's user ID
 */

import { signInternalPayload, buildInternalPayload } from '../auth'

/** Context passed to cron handler functions */
export interface CronContext {
  /** RecordRoom data access (queries the DO directly via tools API) */
  records: {
    query(collection: string, opts?: { where?: Record<string, unknown>; limit?: number }): Promise<any[]>
    create(collection: string, data: Record<string, unknown>): Promise<any>
    update(collection: string, recordId: string, data: Record<string, unknown>): Promise<any>
    delete(collection: string, recordId: string): Promise<any>
  }
  /** Call platform integration endpoints, billed to owner */
  integrations: {
    call(endpoint: string, params: Record<string, unknown>): Promise<any>
  }
  /** App owner's user ID */
  ownerUserId: string
}

/** Environment bindings needed by buildCronContext */
interface CronEnv {
  RECORD_ROOMS: DurableObjectNamespace
  INTERNAL_STORAGE_HMAC_SECRET?: string
  /** Override API base URL for local dev (defaults to https://api.deep.space) */
  API_BASE_URL?: string
}

/**
 * Build a CronContext from worker environment bindings.
 *
 * @param env - Worker environment with RECORD_ROOMS DO namespace and HMAC secret
 * @param ownerUserId - App owner's user ID (for RBAC and billing)
 * @param roomId - RecordRoom ID (defaults to 'default')
 */
export function buildCronContext(
  env: CronEnv,
  ownerUserId: string,
  roomId = 'default'
): CronContext {
  const hmacSecret = env.INTERNAL_STORAGE_HMAC_SECRET
  const apiBase = env.API_BASE_URL || 'https://api.deep.space'

  // Get the RecordRoom DO stub for direct internal calls
  const roomIdObj = env.RECORD_ROOMS.idFromName(roomId)
  const room = env.RECORD_ROOMS.get(roomIdObj)

  /** Execute a tool call against the RecordRoom's tools API */
  async function executeTool(tool: string, params: Record<string, unknown>): Promise<any> {
    const body = JSON.stringify({ tool, params, userId: ownerUserId })
    const response = await room.fetch(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }))
    const result = await response.json() as { success: boolean; data?: any; error?: string }
    if (!result.success) {
      throw new Error(`RecordRoom tool ${tool} failed: ${result.error || 'Unknown error'}`)
    }
    return result.data
  }

  const records: CronContext['records'] = {
    async query(collection, opts) {
      const params: Record<string, unknown> = { collection }
      if (opts?.where) params.where = opts.where
      if (opts?.limit) params.limit = opts.limit
      const data = await executeTool('records.query', params)
      return data.records || []
    },
    async create(collection, data) {
      return executeTool('records.create', { collection, data })
    },
    async update(collection, recordId, data) {
      return executeTool('records.update', { collection, recordId, data })
    },
    async delete(collection, recordId) {
      return executeTool('records.delete', { collection, recordId })
    },
  }

  const integrations: CronContext['integrations'] = {
    async call(endpoint, params) {
      if (!hmacSecret) {
        throw new Error('INTERNAL_STORAGE_HMAC_SECRET not configured — cannot call integrations')
      }
      const payload = { userId: ownerUserId, ...params }
      const payloadStr = buildInternalPayload(payload)
      const { timestamp, signature } = await signInternalPayload({
        secret: hmacSecret,
        payload: payloadStr,
      })
      const response = await fetch(`${apiBase}/api/internal/integrations/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-timestamp': timestamp,
          'x-internal-signature': signature,
        },
        body: payloadStr,
      })
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Integration call ${endpoint} failed (${response.status}): ${errText}`)
      }
      return response.json()
    },
  }

  return { records, integrations, ownerUserId }
}
