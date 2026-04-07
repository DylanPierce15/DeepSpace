/**
 * deepspace test [suite] [-- playwright-args]
 *
 * Runs tests for a DeepSpace app.
 *
 *   deepspace test              # smoke + api (quick check)
 *   deepspace test smoke        # smoke tests only
 *   deepspace test api          # API tests only
 *   deepspace test e2e          # all Playwright tests
 *   deepspace test unit         # vitest unit tests
 *   deepspace test all          # everything
 *   deepspace test -- --headed  # pass args to Playwright
 */

import { defineCommand } from 'citty'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { ensureToken } from '../auth'

const AUTH_WORKER_URL =
  process.env.DEEPSPACE_AUTH_URL ?? 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
const API_WORKER_URL =
  process.env.DEEPSPACE_API_URL ?? 'https://deepspace-api.eudaimonicincorporated.workers.dev'

export default defineCommand({
  meta: {
    name: 'test',
    description: 'Run tests for your DeepSpace app',
  },
  args: {
    suite: {
      type: 'positional',
      description: 'Test suite: smoke, api, e2e, unit, all (default: smoke+api)',
      required: false,
    },
  },
  async run({ args }) {
    const appDir = resolve('.')
    const suite = args.suite ?? 'default'

    if (!existsSync(join(appDir, 'wrangler.toml'))) {
      console.error('No wrangler.toml found. Are you in a DeepSpace app directory?')
      process.exit(1)
    }

    // Ensure .dev.vars exists
    await ensureDevVars(appDir)

    // Ensure Playwright is installed
    if (suite !== 'unit') {
      ensurePlaywright(appDir)
    }

    let exitCode = 0

    switch (suite) {
      case 'smoke':
        exitCode = runPlaywright(appDir, ['tests/smoke.spec.ts'])
        break
      case 'api':
        exitCode = runPlaywright(appDir, ['tests/api.spec.ts'])
        break
      case 'e2e':
        exitCode = runPlaywright(appDir, [])
        break
      case 'unit':
        exitCode = runVitest(appDir)
        break
      case 'all':
        exitCode = runVitest(appDir)
        if (exitCode === 0) exitCode = runPlaywright(appDir, [])
        break
      case 'default':
        exitCode = runPlaywright(appDir, ['tests/smoke.spec.ts', 'tests/api.spec.ts'])
        break
      default:
        // Treat as a file path
        if (suite.endsWith('.spec.ts')) {
          exitCode = runPlaywright(appDir, [suite])
        } else {
          console.error(`Unknown test suite: ${suite}`)
          console.error('Available: smoke, api, e2e, unit, all')
          process.exit(1)
        }
    }

    process.exit(exitCode)
  },
})

function runPlaywright(appDir: string, testFiles: string[]): number {
  const args = [
    'npx', 'playwright', 'test',
    '--config', 'tests/playwright.config.ts',
    ...testFiles,
    // Pass through any args after --
    ...process.argv.slice(process.argv.indexOf('--') + 1).filter((_, i, a) => a !== process.argv),
  ]
  const result = spawnSync(args[0], args.slice(1), {
    cwd: appDir,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

function runVitest(appDir: string): number {
  const result = spawnSync('npx', ['vitest', 'run', '--passWithNoTests'], {
    cwd: appDir,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

function ensurePlaywright(appDir: string) {
  // Check if playwright is installed
  try {
    execSync('npx playwright --version', { cwd: appDir, stdio: 'pipe' })
  } catch {
    console.log('Installing Playwright...')
    execSync('npm install -D @playwright/test', { cwd: appDir, stdio: 'pipe' })
  }

  // Check if browsers are installed
  try {
    execSync('npx playwright install --dry-run chromium', { cwd: appDir, stdio: 'pipe' })
  } catch {
    console.log('Installing Chromium for Playwright...')
    execSync('npx playwright install chromium', { cwd: appDir, stdio: 'inherit' })
  }
}

async function ensureDevVars(appDir: string) {
  const devVarsPath = join(appDir, '.dev.vars')
  if (existsSync(devVarsPath)) return

  // Write .dev.vars with dev mode enabled
  let jwtPublicKey: string
  try {
    const token = await ensureToken()
    const payload = JSON.parse(atob(token.split('.')[1]))

    const res = await fetch(`${AUTH_WORKER_URL}/api/auth/jwks`)
    if (!res.ok) throw new Error(`Failed (${res.status})`)
    const data = (await res.json()) as { publicKey: string }
    jwtPublicKey = data.publicKey

    const devVars = [
      `AUTH_JWT_PUBLIC_KEY=${jwtPublicKey}`,
      `AUTH_JWT_ISSUER=${AUTH_WORKER_URL}/api/auth`,
      `AUTH_WORKER_URL=${AUTH_WORKER_URL}`,
      `API_WORKER_URL=${API_WORKER_URL}`,
      `OWNER_USER_ID=${payload.sub}`,
      `INTERNAL_STORAGE_HMAC_SECRET=dev-${Date.now()}`,
      `DEV_MODE=true`,
    ].join('\n')

    writeFileSync(devVarsPath, devVars + '\n')
    console.log('Wrote .dev.vars')
  } catch (err: any) {
    console.error(`Could not set up .dev.vars: ${err.message}`)
    console.error('Run `npx deepspace login` first.')
    process.exit(1)
  }
}
