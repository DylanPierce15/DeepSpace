import type { Page } from '@playwright/test'

const DEV_API_BASE = 'http://localhost:5173'

/**
 * Set a dev user for API requests (X-Dev-User-Id header).
 * Returns a fetch wrapper that includes the header.
 */
export function devUser(userId: string, claims: Record<string, string> = {}) {
  return {
    userId,
    headers: {
      'X-Dev-User-Id': userId,
      'X-Dev-User-Claims': JSON.stringify(claims),
    },
    /** Fetch with dev auth headers */
    async fetch(path: string, init?: RequestInit): Promise<Response> {
      return fetch(`${DEV_API_BASE}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          'X-Dev-User-Id': userId,
          'X-Dev-User-Claims': JSON.stringify(claims),
        },
      })
    },
  }
}

/**
 * Navigate and set up a dev user in the browser context.
 * Adds the userId as a query param so the WebSocket connections
 * use dev auth.
 */
export async function loginAsDev(page: Page, userId: string) {
  // Set a cookie/localStorage that the app can read to enable dev auth
  await page.goto('/')
  await page.evaluate((uid) => {
    localStorage.setItem('__dev_user_id', uid)
  }, userId)
  await page.reload()
}

/**
 * Create multiple dev users for multiplayer testing.
 */
export function devUsers(count: number, prefix = 'test-user') {
  return Array.from({ length: count }, (_, i) =>
    devUser(`${prefix}-${i + 1}`, { name: `Test User ${i + 1}`, email: `${prefix}-${i + 1}@test.local` })
  )
}
