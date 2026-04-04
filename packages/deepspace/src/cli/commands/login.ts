/**
 * deepspace login
 *
 * Opens the browser to sign in with GitHub or Google.
 * CLI polls the auth worker until login is complete.
 *
 *   deepspace login                          # browser-based OAuth
 *   deepspace login --email x --password y   # non-interactive (CI/agents)
 */

import { defineCommand } from 'citty'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { exec } from 'node:child_process'
import { platform } from 'node:os'
import * as p from '@clack/prompts'

const AUTH_URL =
  process.env.DEEPSPACE_AUTH_URL ?? 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
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
    // Non-interactive mode for CI/agents with email+password
    if (args.email && args.password) {
      console.log(`Signing in as ${args.email}...`)
      await doEmailLogin(args.email, args.password)
      console.log('Logged in')
      return
    }

    // Browser-based OAuth flow
    p.intro('DeepSpace Login')

    const s = p.spinner()
    s.start('Creating login session...')

    // 1. Create a CLI session
    const sessionRes = await fetch(`${AUTH_URL}/api/auth/cli/session`, { method: 'POST' })
    if (!sessionRes.ok) {
      s.stop('Failed')
      p.cancel('Could not create login session')
      process.exit(1)
    }

    const { sessionId, loginUrl } = (await sessionRes.json()) as {
      sessionId: string
      loginUrl: string
    }

    s.stop('Opening browser...')
    p.log.info(`If the browser doesn't open, visit:\n  ${loginUrl}`)

    // 2. Open browser
    openBrowser(loginUrl)

    // 3. Poll for completion
    s.start('Waiting for authentication...')
    const result = await pollForCompletion(sessionId)

    if (!result) {
      s.stop('Timed out')
      p.cancel('Login timed out. Run `deepspace login` to try again.')
      process.exit(1)
    }

    // 4. Store credentials
    storeCredentials(result.sessionToken, result.jwt)

    s.stop('Authenticated')
    p.outro(`Logged in as ${result.name ?? result.email}`)
  },
})

interface LoginResult {
  sessionToken: string
  jwt: string
  email: string
  name: string | null
}

async function pollForCompletion(sessionId: string): Promise<LoginResult | null> {
  const maxAttempts = 120 // 10 minutes at 5s intervals
  const interval = 5000

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(interval)

    try {
      const res = await fetch(`${AUTH_URL}/api/auth/cli/status/${sessionId}`)

      if (res.status === 410) return null // expired
      if (res.status === 404) return null // not found

      const data = (await res.json()) as {
        status: string
        sessionToken?: string
        jwt?: string
        email?: string
        name?: string
      }

      if (data.status === 'complete' && data.sessionToken && data.jwt) {
        return {
          sessionToken: data.sessionToken,
          jwt: data.jwt,
          email: data.email ?? '',
          name: data.name ?? null,
        }
      }
    } catch {
      // Network error, keep polling
    }
  }

  return null
}

function storeCredentials(sessionToken: string, jwt: string) {
  const dir = join(homedir(), '.deepspace')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session'), sessionToken, { mode: 0o600 })
  writeFileSync(join(dir, 'token'), jwt, { mode: 0o600 })
}

function openBrowser(url: string) {
  const cmd =
    platform() === 'darwin'
      ? `open "${url}"`
      : platform() === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`

  exec(cmd, () => {
    // Ignore errors — we already showed the URL
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Legacy email/password login (for CI/agents) ────────────────────

async function doEmailLogin(email: string, password: string): Promise<void> {
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

  const setCookie = res.headers.get('set-cookie') ?? ''
  const cookieMatch = setCookie.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!cookieMatch) {
    throw new Error('No session cookie returned')
  }
  const sessionToken = decodeURIComponent(cookieMatch[1])

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

  storeCredentials(sessionToken, jwt)
}
