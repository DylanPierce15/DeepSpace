/**
 * Integration API client.
 *
 * Plain functions for calling third-party integrations (OpenAI, weather, etc.)
 * through the DeepSpace API worker. Works anywhere — React components,
 * event handlers, server actions, outside React entirely.
 *
 * Usage:
 *   import { integration } from 'deepspace'
 *   const result = await integration.post('openai/chat-completion', { messages })
 */

import { getAuthToken } from '../auth/token'

const ENDPOINT_PREFIX = '/api/integrations'
const DEFAULT_TIMEOUT_MS = 120_000

interface IntegrationResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface RequestOptions {
  headers?: Record<string, string>
  timeoutMs?: number
}

function resolveUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  const path = endpoint.startsWith('/') ? endpoint : `${ENDPOINT_PREFIX}/${endpoint}`
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return path
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<IntegrationResponse<T>> {
  const url = resolveUrl(endpoint)
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  // Attach auth token if available
  try {
    const token = await getAuthToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {
    // Not signed in — continue without auth
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const json = await res.json() as Record<string, unknown>

    // The integration proxy always returns HTTP 200 (Cloudflare Vite plugin
    // crashes on non-2xx in dev). The real status is in the response body.
    const status = (json.status as number) ?? res.status

    if (status >= 400 || json.success === false) {
      return {
        success: false,
        error: (json.error as string) ?? (json.message as string) ?? `Request failed (${status})`,
      }
    }

    // Normalize response — handle both { success, data } and { success, ...rest }
    if ('data' in json) {
      return { success: true, data: json.data as T }
    }
    const { success, status: _, ...rest } = json
    return { success: true, data: rest as T }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, error: `Request timed out after ${timeoutMs}ms` }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Request failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const integration = {
  post<T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return request<T>('POST', endpoint, data, options)
  },
  get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean | null | undefined>, options?: RequestOptions) {
    let url = endpoint
    if (params) {
      const searchParams = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v != null) searchParams.set(k, String(v))
      }
      const qs = searchParams.toString()
      if (qs) url = `${endpoint}?${qs}`
    }
    return request<T>('GET', url, undefined, options)
  },
  put<T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return request<T>('PUT', endpoint, data, options)
  },
  delete<T = unknown>(endpoint: string, data?: unknown, options?: RequestOptions) {
    return request<T>('DELETE', endpoint, data, options)
  },
}

export type { IntegrationResponse, RequestOptions }
