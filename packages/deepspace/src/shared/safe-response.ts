/**
 * Client-side helper for reading responses from workers that use `safeJson`.
 *
 * Background: the @cloudflare/vite-plugin crashes dev with "fetch failed"
 * when a worker returns non-2xx responses for certain POST requests. The
 * workaround is to always return HTTP 200 with the real status encoded in
 * the body as `{ status: number, ... }`.
 *
 * Server side (workers):
 *   import { safeJson } from 'deepspace/worker'
 *   return safeJson(c, { error: 'Unauthorized' }, 401)
 *
 * Client side (this module):
 *   const { data, status, ok } = await parseSafeResponse<{ token: string }>(res)
 *   if (!ok) throw new Error(data.error)
 */

export interface SafeResponse<T> {
  /** Parsed body with `status` field stripped */
  data: T
  /** Actual status the worker intended (from body.status, not res.status) */
  status: number
  /** True if status is in the 2xx range */
  ok: boolean
}

/**
 * Parse a fetch Response whose body follows the safeJson convention.
 * Returns the real status from the body rather than the HTTP status,
 * which is always 200 for safeJson responses.
 *
 * Falls back to the HTTP status if the body doesn't have a `status` field
 * or isn't JSON.
 */
export async function parseSafeResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<SafeResponse<T>> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // Not JSON — fall back to HTTP status
    return { data: {} as T, status: res.status, ok: res.ok }
  }

  // Body has a `status` field → use it
  if (body && typeof body === 'object' && typeof body.status === 'number') {
    const { status, ...rest } = body
    return { data: rest as T, status, ok: status >= 200 && status < 300 }
  }

  // No status field — use HTTP status
  return { data: body as T, status: res.status, ok: res.ok }
}
