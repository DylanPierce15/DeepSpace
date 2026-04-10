/**
 * deepspace test [suite]
 *
 * Runs tests for a DeepSpace app. Always uses dev workers.
 *
 *   deepspace test              # smoke + api (quick check)
 *   deepspace test smoke        # smoke tests only
 *   deepspace test api          # API tests only
 *   deepspace test e2e          # all Playwright tests
 *   deepspace test unit         # vitest unit tests
 *   deepspace test all          # everything
 *   deepspace test <file>       # run specific test file
 */

import { defineCommand } from 'citty'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { ensureToken } from '../auth'
import { writeDevVars } from '../env'

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

    // Always write .dev.vars pointing to dev workers. A logged-in user is
    // required so writeDevVars can mint APP_OWNER_JWT via the auth-worker.
    let token: string
    let ownerId: string
    try {
      token = await ensureToken()
      const payload = JSON.parse(atob(token.split('.')[1]))
      ownerId = payload.sub
    } catch (err) {
      console.error('`deepspace test` requires you to be logged in. Run `deepspace login` first.')
      process.exit(1)
    }

    await writeDevVars(appDir, 'dev', ownerId, token)

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
  const result = spawnSync('npx', [
    'playwright', 'test',
    '--config', 'tests/playwright.config.ts',
    ...testFiles,
  ], { cwd: appDir, stdio: 'inherit' })
  return result.status ?? 1
}

function runVitest(appDir: string): number {
  const result = spawnSync('npx', ['vitest', 'run', '--passWithNoTests'], {
    cwd: appDir, stdio: 'inherit',
  })
  return result.status ?? 1
}

function ensurePlaywright(appDir: string) {
  try {
    execSync('npx playwright --version', { cwd: appDir, stdio: 'pipe' })
  } catch {
    console.log('Installing Playwright...')
    execSync('npm install -D @playwright/test', { cwd: appDir, stdio: 'pipe' })
  }
  try {
    execSync('npx playwright install --dry-run chromium', { cwd: appDir, stdio: 'pipe' })
  } catch {
    console.log('Installing Chromium for Playwright...')
    execSync('npx playwright install chromium', { cwd: appDir, stdio: 'inherit' })
  }
}
