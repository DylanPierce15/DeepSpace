/**
 * Shared test helpers for integration tests.
 */

import { env } from 'cloudflare:test'

/** Stub context — none of the current integrations use db. */
export const ctx = { userId: 'test-user', db: null as any }

/** Check if a real API key is configured (not a fake placeholder). */
export function hasRealKey(key: string): boolean {
  const val = (env as any)[key]
  return val && !val.includes('fake') && !val.includes('test')
}

export { env }
