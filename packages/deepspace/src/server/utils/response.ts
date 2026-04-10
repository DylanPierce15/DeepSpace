/**
 * Safe Response Helpers — Workaround for @cloudflare/vite-plugin bug
 *
 * The Vite plugin's `createRequestHandler` passes errors from
 * `miniflare.dispatchFetch()` to Vite's `next(error)`, which shows the
 * error overlay. Miniflare rejects `dispatchFetch` for certain non-2xx
 * POST responses (likely a miniflare/undici issue with response framing),
 * crashing dev with "fetch failed" even when the worker returned a valid
 * Response.
 *
 * Workaround: every worker endpoint always returns HTTP 200. The real
 * status lives in the response body's `status` field. Clients read that
 * instead of `res.status`.
 *
 * Usage (server):
 *   import { safeJson } from 'deepspace/worker'
 *   return safeJson(c, { error: 'Unauthorized' }, 401)
 *
 * Usage (client):
 *   import { parseSafeResponse } from 'deepspace'
 *   const { data, status, ok } = await parseSafeResponse(res)
 *   if (!ok) throw new Error(data.error)
 */

import type { Context } from 'hono'

/**
 * Return a Hono JSON response with HTTP 200 but the real status encoded in
 * the body as `status`. Always prefer this over `c.json(data, nonOkStatus)`
 * in worker code that may be called via the Vite dev plugin.
 *
 * WARNING: `data` must not contain a top-level `status` field — it will be
 * silently overwritten by the numeric HTTP status this helper injects. If
 * you need to express domain state, use a different name (e.g. `state`,
 * `subscriptionStatus`). Nested `status` fields inside arrays or sub-objects
 * are unaffected.
 */
export function safeJson<T extends Record<string, unknown>>(
  c: Context,
  data: T,
  status: number = 200,
  headers?: Record<string, string>,
): Response {
  return c.json({ ...data, status }, 200, headers)
}

/**
 * Shape returned to clients inside a safeJson body. `status` is the
 * original HTTP status the worker intended to return.
 */
export type SafeJsonBody<T = Record<string, unknown>> = T & { status: number }
