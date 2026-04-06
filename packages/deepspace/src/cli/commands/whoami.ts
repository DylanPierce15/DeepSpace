/**
 * deepspace whoami
 *
 * Shows the currently logged-in user. Auto-refreshes the JWT if expired.
 */

import { defineCommand } from 'citty'
import { ensureToken } from '../auth'

export default defineCommand({
  meta: {
    name: 'whoami',
    description: 'Show the currently logged-in user',
  },
  async run() {
    try {
      const jwt = await ensureToken()
      let payload: { name?: string; email?: string }
      try {
        payload = JSON.parse(atob(jwt.split('.')[1]))
      } catch {
        throw new Error('Malformed session token. Run `npx deepspace login`.')
      }
      console.log(payload.name ?? payload.email)
    } catch (err: any) {
      console.log(err.message)
      process.exit(1)
    }
  },
})
