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
import { parse as parseToml } from 'smol-toml'
import { join, resolve, dirname } from 'node:path'
import * as p from '@clack/prompts'
import { ensureToken } from '../auth'
import { ENVS } from '../env'
import { parseSafeResponse } from '../../shared/safe-response'

const DEPLOY_URL = process.env.DEEPSPACE_DEPLOY_URL ?? ENVS.prod.deploy

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

    const wranglerConfig = parseToml(readFileSync(wranglerPath, 'utf-8')) as { name?: string }
    const appName = wranglerConfig.name
    if (!appName) {
      p.cancel('Could not find app name in wrangler.toml')
      process.exit(1)
    }
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
      durable_objects?: { bindings: Array<{ name: string; class_name: string }> }
      migrations?: Array<{ new_sqlite_classes?: string[] }>
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

    // ── Extract DO manifest from build output config ───────────
    const doBindings = outputConfig.durable_objects?.bindings as Array<{ name: string; class_name: string }> | undefined
    const sqliteClasses = new Set(
      (outputConfig.migrations as Array<{ new_sqlite_classes?: string[] }> | undefined)
        ?.flatMap(m => m.new_sqlite_classes ?? []) ?? []
    )
    const doManifest = doBindings?.map(b => ({
      binding: b.name,
      className: b.class_name,
      sqlite: sqliteClasses.has(b.class_name),
    }))
    if (doManifest?.length) {
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

    const { data: body, ok, status } = await parseSafeResponse<{
      success?: boolean
      url?: string
      error?: string
    }>(res)

    if (!ok || !body.success) {
      s.stop('Deploy failed')
      p.cancel(body.error ?? `Deployment error (${status})`)
      process.exit(1)
    }

    s.stop('Deployed!')
    p.log.success(`Live at: ${body.url}`)
    p.outro('Done')
  },
})

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
