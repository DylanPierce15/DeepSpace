/**
 * deepspace deploy
 *
 * Builds the app with Vite (Cloudflare plugin bundles both client + worker),
 * then uploads to the deploy worker which handles Cloudflare WfP deployment.
 *
 * Uses the same build pipeline as dev for full fidelity. Reads the output
 * wrangler.json (via .wrangler/deploy/config.json) to find the built assets
 * and worker bundle — the same contract that `wrangler deploy` uses.
 */

import { defineCommand } from 'citty'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import * as p from '@clack/prompts'
import { ensureToken } from '../auth'

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

    // ── Ensure valid JWT ───────────────────────────────────────
    let token: string
    try {
      token = await ensureToken()
    } catch (err: any) {
      p.cancel(err.message)
      process.exit(1)
    }

    // ── Build with Vite (Cloudflare plugin bundles client + worker) ──
    const s = p.spinner()
    s.start('Building...')
    try {
      execSync('npx vite build', { cwd: appDir, stdio: 'pipe' })
    } catch (err: any) {
      s.stop('Build failed')
      console.error(err.stderr?.toString() ?? err.message)
      process.exit(1)
    }
    s.stop('Built')

    // ── Locate build output via .wrangler/deploy/config.json ──
    // This is the same contract that `wrangler deploy` uses after `vite build`.
    const deployConfigPath = join(appDir, '.wrangler', 'deploy', 'config.json')
    if (!existsSync(deployConfigPath)) {
      p.cancel('Build output config not found at .wrangler/deploy/config.json')
      process.exit(1)
    }

    const deployConfig = JSON.parse(readFileSync(deployConfigPath, 'utf-8')) as { configPath: string }
    const outputWranglerPath = resolve(dirname(deployConfigPath), deployConfig.configPath)

    if (!existsSync(outputWranglerPath)) {
      p.cancel(`Output wrangler.json not found at ${outputWranglerPath}`)
      process.exit(1)
    }

    const outputConfig = JSON.parse(readFileSync(outputWranglerPath, 'utf-8')) as {
      main: string
      assets?: { directory: string }
    }

    const workerDir = dirname(outputWranglerPath)
    const workerBundlePath = join(workerDir, outputConfig.main)
    const clientDir = outputConfig.assets?.directory
      ? resolve(workerDir, outputConfig.assets.directory)
      : null

    if (!existsSync(workerBundlePath)) {
      p.cancel(`Worker bundle not found at ${workerBundlePath}`)
      process.exit(1)
    }
    if (!clientDir || !existsSync(clientDir)) {
      p.cancel(`Client assets not found at ${clientDir}`)
      process.exit(1)
    }

    // ── Collect assets ────────────────────────────────────────
    s.start('Collecting assets...')
    const assets = collectAssets(clientDir)
    s.stop(`Collected ${assets.length} assets`)

    const workerJs = readFileSync(workerBundlePath, 'utf-8')

    // ── Extract DO manifest from worker source ────────────────
    const workerSource = readFileSync(join(appDir, 'worker.ts'), 'utf-8')
    const doManifest = extractDOManifest(workerSource)
    if (doManifest) {
      p.log.info(`DO manifest: ${doManifest.length} binding(s)`)
    }

    // ── Upload to deploy worker ───────────────────────────────
    s.start(`Deploying to ${appName}.app.space...`)

    const form = new FormData()
    form.append('worker', new Blob([workerJs], { type: 'application/javascript' }), 'worker.js')
    form.append('assets', JSON.stringify(assets))
    if (doManifest) {
      form.append('doManifest', JSON.stringify(doManifest))
    }

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

/**
 * Extract __DO_MANIFEST__ from worker.ts source via regex.
 */
function extractDOManifest(source: string): Array<{ binding: string; className: string; sqlite: boolean }> | null {
  const match = source.match(
    /export\s+const\s+__DO_MANIFEST__\s*=\s*\[([\s\S]*?)\]/
  )
  if (!match) return null

  const entries: Array<{ binding: string; className: string; sqlite: boolean }> = []
  const entryRegex = /\{\s*binding:\s*['"]([^'"]+)['"]\s*,\s*className:\s*['"]([^'"]+)['"]\s*,\s*sqlite:\s*(true|false)\s*\}/g
  let m: RegExpExecArray | null
  while ((m = entryRegex.exec(match[1])) !== null) {
    entries.push({
      binding: m[1],
      className: m[2],
      sqlite: m[3] === 'true',
    })
  }

  return entries.length > 0 ? entries : null
}

function collectAssets(dir: string): Array<{ path: string; contentBase64: string }> {
  const assets: Array<{ path: string; contentBase64: string }> = []
  function walk(d: string, prefix: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === '.assetsignore') continue
      const full = join(d, entry.name)
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
  walk(dir, '')
  return assets
}
