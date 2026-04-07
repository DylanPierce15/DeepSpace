/**
 * deepspace dev [--prod]
 *
 * Starts local development:
 *   1. Ensures you're logged in
 *   2. Writes .dev.vars pointing to dev or prod workers
 *   3. Starts vite dev (Cloudflare Vite plugin runs the worker in-process)
 *
 *   deepspace dev         # uses dev workers (free accounts, mock billing)
 *   deepspace dev --prod  # uses production workers (real auth, real API calls)
 */

import { defineCommand } from 'citty'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { ensureToken, SESSION_PATH } from '../auth'
import { writeDevVars } from '../env'

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
    prod: {
      type: 'boolean',
      description: 'Use production workers (real auth, real API calls)',
      default: false,
    },
  },
  async run({ args }) {
    const appDir = resolve(args.dir ?? '.')
    const env = args.prod ? 'prod' : 'dev'

    if (!existsSync(join(appDir, 'wrangler.toml'))) {
      console.error('No wrangler.toml found. Are you in a DeepSpace app directory?')
      process.exit(1)
    }

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
    console.log(`Environment: ${env}`)

    const ownerSession = existsSync(SESSION_PATH) ? readFileSync(SESSION_PATH, 'utf-8').trim() : undefined

    await writeDevVars(appDir, env, payload.sub, ownerSession)
    console.log('Starting dev server...\n')

    const vite = spawn('npx', ['vite'], { cwd: appDir, stdio: 'inherit' })
    process.on('SIGINT', () => vite.kill())
    process.on('SIGTERM', () => vite.kill())
    vite.on('close', (code) => process.exit(code ?? 0))
  },
})
