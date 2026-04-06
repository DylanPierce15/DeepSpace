/**
 * deepspace dev
 *
 * Starts local development:
 *   1. Ensures you're logged in
 *   2. Writes .dev.vars with production auth/api worker URLs + JWT public key
 *   3. Starts wrangler dev
 *
 *   deepspace dev             # start dev server
 *   deepspace dev --port 8780 # custom port
 */

import { defineCommand } from 'citty'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync, spawn } from 'node:child_process'
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
    port: {
      type: 'string',
      description: 'Dev server port',
      required: false,
    },
  },
  async run({ args }) {
    const appDir = resolve(args.dir ?? '.')

    // Verify this is a DeepSpace app
    const wranglerPath = join(appDir, 'wrangler.toml')
    if (!existsSync(wranglerPath)) {
      console.error('No wrangler.toml found. Are you in a DeepSpace app directory?')
      process.exit(1)
    }

    // Ensure logged in and get user info
    let token: string
    try {
      token = await ensureToken()
    } catch (err: any) {
      console.error(err.message)
      process.exit(1)
    }

    const payload = JSON.parse(atob(token.split('.')[1]))
    const userId = payload.sub
    console.log(`Logged in as ${payload.name ?? payload.email}`)

    // Fetch JWT public key from auth worker
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

    const jwtIssuer = `${AUTH_WORKER_URL}/api/auth`

    // Write .dev.vars
    const devVars = [
      `AUTH_JWT_PUBLIC_KEY=${jwtPublicKey}`,
      `AUTH_JWT_ISSUER=${jwtIssuer}`,
      `AUTH_WORKER_URL=${AUTH_WORKER_URL}`,
      `API_WORKER_URL=${API_WORKER_URL}`,
      `OWNER_USER_ID=${userId}`,
      `INTERNAL_STORAGE_HMAC_SECRET=dev-${Date.now()}`,
    ].join('\n')

    writeFileSync(join(appDir, '.dev.vars'), devVars + '\n')
    console.log('Wrote .dev.vars')

    // Ensure dist/ exists (wrangler requires it for assets, Vite creates it on build)
    const distDir = join(appDir, 'dist')
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true })
    }

    // Start wrangler dev (worker backend — API, WebSocket, DOs)
    const wranglerPort = args.port ?? '8780'
    console.log('Starting wrangler dev (worker)...')

    const wrangler = spawn('npx', ['wrangler', 'dev', '--port', wranglerPort], {
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    // Wait for wrangler to be ready
    await new Promise<void>((resolve) => {
      const onData = (data: Buffer) => {
        const text = data.toString()
        process.stderr.write(text)
        if (text.includes('Ready on')) resolve()
      }
      wrangler.stderr?.on('data', onData)
      wrangler.stdout?.on('data', onData)
      // Timeout fallback
      setTimeout(resolve, 10000)
    })

    // Start Vite dev server (frontend — proxies /api and /ws to wrangler)
    console.log('Starting Vite dev server...\n')

    const vite = spawn('npx', ['vite', '--host'], {
      cwd: appDir,
      stdio: 'inherit',
    })

    const cleanup = () => {
      wrangler.kill('SIGTERM')
      vite.kill('SIGTERM')
    }

    vite.on('close', (code) => {
      wrangler.kill('SIGTERM')
      process.exit(code ?? 0)
    })

    wrangler.on('close', () => {
      vite.kill('SIGTERM')
    })

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  },
})
