import type { Page } from '@playwright/test'

/**
 * Set up a dev user in the browser. Sets localStorage values that
 * the DeepSpace SDK reads for both React auth (useAuth/useUser)
 * and WebSocket connections (devUserId param).
 *
 * Call before navigating to the app, then reload.
 */
export async function loginAsDev(
  page: Page,
  userId: string,
  opts: { name?: string; email?: string } = {},
) {
  await page.goto('/')
  await page.evaluate(({ id, name, email }) => {
    localStorage.setItem('__dev_user_id', id)
    localStorage.setItem('__dev_user_name', name)
    localStorage.setItem('__dev_user_email', email)
  }, {
    id: userId,
    name: opts.name ?? userId,
    email: opts.email ?? `${userId}@test.local`,
  })
  await page.reload()
}

/**
 * Clear dev user from the browser.
 */
export async function logoutDev(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('__dev_user_id')
    localStorage.removeItem('__dev_user_name')
    localStorage.removeItem('__dev_user_email')
  })
  await page.reload()
}
