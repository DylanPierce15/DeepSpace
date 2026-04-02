/**
 * deepspace login
 *
 * Authenticates via email/password and stores credentials locally.
 * Supports both interactive (prompts) and non-interactive (flags) modes.
 *
 *   deepspace login                          # interactive
 *   deepspace login --email x --password y   # non-interactive (CI/agents)
 */

import { defineCommand } from 'citty'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import * as p from '@clack/prompts'

const AUTH_URL = process.env.DEEPSPACE_AUTH_URL ?? 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
const SESSION_COOKIE = '__Secure-better-auth.session_token'

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Log in to your DeepSpace account',
  },
  args: {
    email: {
      type: 'string',
      description: 'Email address (non-interactive mode)',
      required: false,
    },
    password: {
      type: 'string',
      description: 'Password (non-interactive mode)',
      required: false,
    },
  },
  async run({ args }) {
    let email = args.email
    let password = args.password

    const interactive = !email || !password

    if (interactive) {
      p.intro('DeepSpace Login')

      const emailInput = await p.text({
        message: 'Email:',
        validate: (v) => (!v?.includes('@') ? 'Enter a valid email' : undefined),
      })
      if (p.isCancel(emailInput)) return
      email = emailInput

      const passInput = await p.password({
        message: 'Password:',
        validate: (v) => (!v || v.length < 6 ? 'Password too short' : undefined),
      })
      if (p.isCancel(passInput)) return
      password = passInput
    }

    if (interactive) {
      const s = p.spinner()
      s.start('Signing in...')
      try {
        await doLogin(email!, password!)
        s.stop('Logged in')
        p.outro(`Authenticated as ${email}`)
      } catch (err: any) {
        s.stop('Failed')
        p.cancel(err.message)
        process.exit(1)
      }
    } else {
      console.log(`Signing in as ${email}...`)
      await doLogin(email!, password!)
      console.log('Logged in')
    }
  },
})

async function doLogin(email: string, password: string): Promise<void> {
  // Sign in
  const res = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? `Authentication failed (${res.status})`)
  }

  // Extract session cookie
  const setCookie = res.headers.get('set-cookie') ?? ''
  const cookieMatch = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!cookieMatch) {
    throw new Error('No session cookie returned')
  }
  const sessionToken = decodeURIComponent(cookieMatch[1])

  // Get JWT
  const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  if (!tokenRes.ok) {
    throw new Error('JWT issuance failed')
  }

  const { token: jwt } = (await tokenRes.json()) as { token: string }

  // Store in ~/.deepspace/
  const globalDir = join(homedir(), '.deepspace')
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(join(globalDir, 'session'), sessionToken, { mode: 0o600 })
  writeFileSync(join(globalDir, 'token'), jwt, { mode: 0o600 })

  // Store in project-local .deepspace/ too
  const localDir = join(process.cwd(), '.deepspace')
  mkdirSync(localDir, { recursive: true })
  writeFileSync(join(localDir, 'session'), sessionToken, { mode: 0o600 })
  writeFileSync(join(localDir, 'token'), jwt, { mode: 0o600 })
}
