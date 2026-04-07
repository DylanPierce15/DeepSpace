/**
 * deepspace dev
 *
 * Starts local development:
 *   1. Ensures you're logged in
 *   2. Writes .dev.vars with production auth/api worker URLs + JWT public key
 *   3. Starts vite dev (Cloudflare Vite plugin runs the worker in-process)
 *
 *   deepspace dev
 */

import { defineCommand } from 'citty'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { ensureToken } from '../auth'

const AUTH_WORKER_URL =
  process.env.DEEPSPACE_AUTH_URL ?? 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
const API_WORKER_URL =
  process.env.DEEPSPACE_API_URL ?? 'https://deepspace-api.eudaimonicincorporated.workers.dev'

export default defineCommand({
  meta: {
    name: 'dev',
    description: 'Start local development server',
  },
  args: {
    dir: {
      type: 'positional',
      description: 'App directory (default: current directory)',
      required: false,
    },
  },
  async run({ args }) {
    const appDir = resolve(args.dir ?? '.')

    if (!existsSync(join(appDir, 'wrangler.toml'))) {
      console.error('No wrangler.toml found. Are you in a DeepSpace app directory?')
      process.exit(1)
    }

    // Ensure logged in
    let token: string
    try {
      token = await ensureToken()
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }

    let payload: { sub: string; name?: string; email?: string }
    try {
      payload = JSON.parse(atob(token.split('.')[1]))
    } catch {
      console.error('Malformed session token. Run `npx deepspace login`.')
      process.exit(1)
    }
    console.log(`Logged in as ${payload.name ?? payload.email}`)

    // Fetch JWT public key
    console.log('Fetching auth config...')
    let jwtPublicKey: string
    try {
      const res = await fetch(`${AUTH_WORKER_URL}/api/auth/jwks`)
      if (!res.ok) throw new Error(`Failed (${res.status})`)
      const data = (await res.json()) as { publicKey: string }
      jwtPublicKey = data.publicKey
    } catch (err: any) {
      console.error(`Failed to fetch JWT public key: ${err.message}`)
      process.exit(1)
    }

    // Write .dev.vars
    const devVars = [
      `AUTH_JWT_PUBLIC_KEY=${jwtPublicKey}`,
      `AUTH_JWT_ISSUER=${AUTH_WORKER_URL}/api/auth`,
      `AUTH_WORKER_URL=${AUTH_WORKER_URL}`,
      `API_WORKER_URL=${API_WORKER_URL}`,
      `OWNER_USER_ID=${payload.sub}`,
      `INTERNAL_STORAGE_HMAC_SECRET=dev-${Date.now()}`,
      `DEV_MODE=true`,
    ].join('\n')

    writeFileSync(join(appDir, '.dev.vars'), devVars + '\n')
    console.log('Starting dev server...\n')

    // Single process — Cloudflare Vite plugin runs the worker inside Vite
    const vite = spawn('npx', ['vite'], { cwd: appDir, stdio: 'inherit' })

    process.on('SIGINT', () => vite.kill())
    process.on('SIGTERM', () => vite.kill())
    vite.on('close', (code) => process.exit(code ?? 0))
  },
})
