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

    // ── Build with Vite (Cloudflare plugin bundles both client + worker) ──
    const s = p.spinner()
    s.start('Building with Vite...')
    try {
      execSync('npx vite build', { cwd: appDir, stdio: 'pipe' })
    } catch (err: any) {
      s.stop('Build failed')
      console.error(err.stderr?.toString() ?? err.message)
      process.exit(1)
    }
    s.stop('Built')

    // Cloudflare Vite plugin outputs: dist/client/ (assets) + dist/<name>/ (worker)
    const clientDir = join(appDir, 'dist', 'client')
    const workerDir = join(appDir, 'dist', appName)

    // Fallback: if no client/ dir, the build used the old structure (flat dist/)
    const assetsDir = existsSync(clientDir) ? clientDir : join(appDir, 'dist')

    // ── Collect assets ────────────────────────────────────────
    s.start('Collecting assets...')
    const assets = collectAssets(assetsDir)
    s.stop(`Collected ${assets.length} assets`)

    // Worker bundle: prefer Vite plugin output, fall back to esbuild
    let workerJs: string
    const viteWorkerBundle = join(workerDir, 'index.js')
    if (existsSync(viteWorkerBundle)) {
      workerJs = readFileSync(viteWorkerBundle, 'utf-8')
    } else {
      s.start('Bundling worker...')
      const workerOut = join(appDir, '.worker-bundle.js')
      try {
        execSync(
          `npx esbuild ${join(appDir, 'worker.ts')} --bundle --format=esm --outfile=${workerOut} --target=esnext --platform=browser "--external:cloudflare:*"`,
          { cwd: appDir, stdio: 'pipe' },
        )
      } catch (err: any) {
        s.stop('Worker bundle failed')
        console.error(err.stderr?.toString() ?? err.message)
        process.exit(1)
      }
      s.stop('Worker bundled')
      workerJs = readFileSync(workerOut, 'utf-8')
    }

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
 * Returns null if no manifest is found (backward compat → deploy worker uses default).
 */
function extractDOManifest(source: string): Array<{ binding: string; className: string; sqlite: boolean }> | null {
  // Match: export const __DO_MANIFEST__ = [ ... ] as const satisfies DOManifest
  // or:    export const __DO_MANIFEST__ = [ ... ]
  const match = source.match(
    /export\s+const\s+__DO_MANIFEST__\s*=\s*\[([\s\S]*?)\]/
  )
  if (!match) return null

  const entries: Array<{ binding: string; className: string; sqlite: boolean }> = []
  // Match individual entries: { binding: '...', className: '...', sqlite: true/false }
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
