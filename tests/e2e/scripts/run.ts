#!/usr/bin/env npx tsx
/**
 * E2E test runner — scaffolds a real app and runs tests against live infra.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/run.ts              # auth tests only (no deploy)
 *   npx tsx tests/e2e/scripts/run.ts --deploy      # auth + deployed app tests
 *   npx tsx tests/e2e/scripts/run.ts --skip-build  # skip package builds
 *   npx tsx tests/e2e/scripts/run.ts --keep         # preserve app + temp dir
 *   npx tsx tests/e2e/scripts/run.ts --suite auth   # run specific suite
 *
 * Suites:
 *   auth    — auth worker API tests (sign-in, sign-up blocked, test accounts, JWT)
 *   app     — deployed app UI tests (requires --deploy)
 *   all     — everything
 */

import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

// ── Config ─────────────────────────────────────────────────────────

const MONOREPO = resolve(import.meta.dirname, '../../..')
const E2E_DIR = resolve(import.meta.dirname, '..')
const APP_NAME = `ds-e2e-${Date.now().toString(36)}`
const WORK_DIR = join(tmpdir(), `deepspace-e2e-${Date.now()}`)
const APP_DIR = join(WORK_DIR, APP_NAME)

// ── Args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const deploy = args.includes('--deploy')
const keep = args.includes('--keep')
const skipBuild = args.includes('--skip-build')
const suiteArg = args.find((_, i, a) => a[i - 1] === '--suite') ?? (deploy ? 'all' : 'auth')

function run(cmd: string, cwd: string, env?: Record<string, string>) {
  console.log(`\n  $ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
}

function step(msg: string) {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`)
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  mkdirSync(WORK_DIR, { recursive: true })
  console.log(`  Suite:     ${suiteArg}`)
  console.log(`  Deploy:    ${deploy}`)
  console.log(`  App name:  ${APP_NAME}`)
  console.log(`  Work dir:  ${WORK_DIR}`)

  let cliBin = ''

  try {
    // ── 1. Build packages ──────────────────────────────────────────
    if (!skipBuild) {
      step('1. Build packages')
      run('pnpm build', join(MONOREPO, 'packages/deepspace'))
      run('pnpm build', join(MONOREPO, 'packages/create-deepspace'))
    } else {
      step('1. Build packages (skipped)')
    }

    // ── 2. Scaffold app ────────────────────────────────────────────
    step('2. Scaffold app')
    const createBin = join(MONOREPO, 'packages/create-deepspace/dist/index.js')
    if (!existsSync(createBin)) {
      throw new Error(`create-deepspace not built. Run without --skip-build.`)
    }
    execSync(`"${createBin}" ${APP_NAME} --local "${MONOREPO}"`, {
      cwd: WORK_DIR,
      stdio: 'inherit',
    })
    cliBin = join(APP_DIR, 'node_modules/.bin/deepspace')

    // ── 3. Login ───────────────────────────────────────────────────
    step('3. Login')
    run(`${cliBin} login --email e2e-test@deepspace.test --password TestPass123!`, APP_DIR)

    // ── 4. Deploy (optional) ───────────────────────────────────────
    if (deploy) {
      step('4. Deploy')
      run(`${cliBin} deploy`, APP_DIR)
      writeFileSync(join(E2E_DIR, '.app-name'), APP_NAME)
    } else {
      step('4. Deploy (skipped — auth-only mode)')
    }

    // ── 5. Run Playwright ──────────────────────────────────────────
    step('5. Playwright tests')

    // Determine which test files to run
    let testFiles = ''
    if (suiteArg === 'auth') {
      testFiles = 'tests/auth.spec.ts tests/cli.spec.ts'
    } else if (suiteArg === 'app') {
      testFiles = 'tests/app.spec.ts'
    }
    // 'all' or default: run everything (Playwright picks up all *.spec.ts)

    run(
      `npx playwright test ${testFiles}`.trim(),
      E2E_DIR,
      {
        E2E_DEPLOY: deploy ? '1' : '',
        E2E_CLI_BIN: cliBin,
        E2E_APP_DIR: APP_DIR,
      },
    )

    step('ALL PASSED')

  } finally {
    // ── Teardown ─────────────────────────────────────────────────
    if (!keep) {
      step('Teardown')
      if (deploy && cliBin) {
        try {
          run(`${cliBin} undeploy ${APP_NAME}`, APP_DIR)
        } catch {
          console.warn('  Undeploy failed (may already be cleaned up)')
        }
      }
      try {
        rmSync(WORK_DIR, { recursive: true, force: true })
      } catch {
        console.warn(`  Could not clean ${WORK_DIR}`)
      }
      // Clean up .app-name
      try { rmSync(join(E2E_DIR, '.app-name')) } catch {}
    } else {
      console.log(`\n  --keep: work dir preserved at ${WORK_DIR}`)
      if (deploy) console.log(`  App live at: https://${APP_NAME}.app.space`)
    }
  }
}

main().catch((err) => {
  console.error('\n  E2E FAILED:', err.message ?? err)
  process.exit(1)
})
