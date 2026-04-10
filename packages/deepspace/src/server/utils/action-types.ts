/**
 * Server Action Types
 *
 * Types for app-defined server actions that run in the site worker.
 * Actions bypass user RBAC via the X-App-Action header — the app's
 * server-side code IS the trust boundary.
 */

export interface ActionResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface ActionTools {
  create(scopeId: string, collection: string, data: Record<string, unknown>): Promise<ActionResult>
  update(scopeId: string, collection: string, recordId: string, data: Record<string, unknown>): Promise<ActionResult>
  remove(scopeId: string, collection: string, recordId: string): Promise<ActionResult>
  get(scopeId: string, collection: string, recordId: string): Promise<ActionResult>
  query(scopeId: string, collection: string, options?: {
    where?: Record<string, unknown>
    orderBy?: string
    orderDir?: 'asc' | 'desc'
    limit?: number
  }): Promise<ActionResult>
  /** Call an integration endpoint (e.g. 'openai/completions') via the API worker */
  integration(endpoint: string, data?: unknown): Promise<ActionResult>
}

export interface ActionContext {
  userId: string
  params: Record<string, unknown>
  tools: ActionTools
}

export type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>
