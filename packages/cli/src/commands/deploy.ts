/**
 * deepspace deploy
 *
 * Builds the app locally (Vite + esbuild), then uploads to the deploy worker
 * which handles the Cloudflare WfP deployment on the user's behalf.
 */

import { defineCommand } from 'citty'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import * as p from '@clack/prompts'

const DEPLOY_URL = process.env.DEEPSPACE_DEPLOY_URL ?? 'https://deepspace-deploy.eudaimonicincorporated.workers.dev'

export default defineCommand({
  meta: {
    name: 'deploy',
    description: 'Build and deploy your DeepSpace app',
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
    p.intro('Deploying DeepSpace app')

    // ── Read app name from wrangler.toml ──────────────────────
    const wranglerPath = join(appDir, 'wrangler.toml')
    if (!existsSync(wranglerPath)) {
      p.cancel('No wrangler.toml found. Are you in a DeepSpace app directory?')
      process.exit(1)
    }

    const wranglerContent = readFileSync(wranglerPath, 'utf-8')
    const nameMatch = wranglerContent.match(/^name\s*=\s*"(.+)"/m)
    if (!nameMatch) {
      p.cancel('Could not find app name in wrangler.toml')
      process.exit(1)
    }
    const appName = nameMatch[1]
    p.log.info(`App: ${appName}`)

    // ── Read JWT from ~/.deepspace/token ──────────────────────
    const tokenPath = join(homedir(), '.deepspace', 'token')
    if (!existsSync(tokenPath)) {
      p.cancel('Not logged in. Run `deepspace login` first.')
      process.exit(1)
    }
    const token = readFileSync(tokenPath, 'utf-8').trim()

    // ── Build frontend ────────────────────────────────────────
    const s = p.spinner()
    s.start('Building frontend with Vite...')
    try {
      execSync('npx vite build', { cwd: appDir, stdio: 'pipe' })
    } catch (err: any) {
      s.stop('Vite build failed')
      console.error(err.stderr?.toString() ?? err.message)
      process.exit(1)
    }
    s.stop('Frontend built')

    const distDir = join(appDir, 'dist')
    if (!existsSync(distDir)) {
      p.cancel('No dist/ directory after build')
      process.exit(1)
    }

    // ── Bundle worker ─────────────────────────────────────────
    s.start('Bundling worker...')
    const workerTs = join(appDir, 'worker.ts')
    const workerOut = join(appDir, '.worker-bundle.js')
    try {
      execSync(
        `npx esbuild ${workerTs} --bundle --format=esm --outfile=${workerOut} --target=esnext --platform=browser "--external:cloudflare:*"`,
        { cwd: appDir, stdio: 'pipe' },
      )
    } catch (err: any) {
      s.stop('Worker bundle failed')
      console.error(err.stderr?.toString() ?? err.message)
      process.exit(1)
    }
    s.stop('Worker bundled')

    // ── Collect assets ────────────────────────────────────────
    s.start('Collecting assets...')
    const assets = collectAssets(distDir)
    s.stop(`Collected ${assets.length} assets`)

    const workerJs = readFileSync(workerOut, 'utf-8')

    // ── Upload to deploy worker ───────────────────────────────
    s.start(`Deploying to ${appName}.app.space...`)

    const form = new FormData()
    form.append('worker', new Blob([workerJs], { type: 'application/javascript' }), 'worker.js')
    form.append('assets', JSON.stringify(assets))

    const res = await fetch(`${DEPLOY_URL}/api/deploy/${appName}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    const body = (await res.json()) as { success?: boolean; url?: string; error?: string }

    if (!res.ok || !body.success) {
      s.stop('Deploy failed')
      p.cancel(body.error ?? `Deployment error (${res.status})`)
      process.exit(1)
    }

    s.stop('Deployed!')
    p.log.success(`Live at: ${body.url}`)
    p.outro('Done')
  },
})

function collectAssets(distDir: string): Array<{ path: string; contentBase64: string }> {
  const assets: Array<{ path: string; contentBase64: string }> = []
  function walk(dir: string, prefix: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        walk(full, rel)
      } else {
        assets.push({
          path: '/' + rel,
          contentBase64: readFileSync(full).toString('base64'),
        })
      }
    }
  }
  walk(distDir, '')
  return assets
}
