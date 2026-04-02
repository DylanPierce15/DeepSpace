#!/usr/bin/env npx tsx
/**
 * Full E2E test runner — simulates a real user outside the monorepo.
 *
 * 1. Build deepspace + create-deepspace
 * 2. Scaffold app in /tmp using create-deepspace --local
 * 3. deepspace login (non-interactive, real auth)
 * 4. deepspace deploy (real build + deploy via deploy worker)
 * 5. Run Playwright tests against the live app
 * 6. deepspace undeploy (teardown)
 *
 * Usage: npx tsx tests/production/scripts/run-full-e2e.ts [--keep]
 */

import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const MONOREPO = resolve(import.meta.dirname, '../../..')
const APP_NAME = `ds-e2e-${Date.now().toString(36)}`
const WORK_DIR = join(tmpdir(), `deepspace-e2e-${Date.now()}`)
const APP_DIR = join(WORK_DIR, APP_NAME)

function run(cmd: string, cwd: string) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function step(msg: string) {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`)
}

async function main() {
  const keepApp = process.argv.includes('--keep')
  mkdirSync(WORK_DIR, { recursive: true })
  console.log(`App name: ${APP_NAME}`)
  console.log(`Working directory: ${WORK_DIR}`)

  try {
    // ── Step 1: Build packages ─────────────────────────────────────
    step('Step 1: Build packages')
    run('pnpm build', join(MONOREPO, 'packages/deepspace'))
    run('pnpm build', join(MONOREPO, 'packages/create-deepspace'))

    // ── Step 2: Scaffold app ───────────────────────────────────────
    step('Step 2: Scaffold app via create-deepspace --local')
    const createBin = join(MONOREPO, 'packages/create-deepspace/dist/index.js')
    execSync(`"${createBin}" ${APP_NAME} --local "${MONOREPO}"`, {
      cwd: WORK_DIR,
      stdio: 'inherit',
    })

    // ── Step 3: deepspace login ────────────────────────────────────
    step('Step 3: deepspace login')
    const cliBin = join(APP_DIR, 'node_modules/.bin/deepspace')
    run(`${cliBin} login --email e2e-test@deepspace.test --password TestPass123!`, APP_DIR)

    // ── Step 4: deepspace deploy ───────────────────────────────────
    step('Step 4: deepspace deploy')
    run(`${cliBin} deploy`, APP_DIR)

    // Write app name for Playwright tests to read
    writeFileSync(join(MONOREPO, 'tests/production/.app-name'), APP_NAME)

    // ── Step 5: Run Playwright tests ───────────────────────────────
    step('Step 5: Playwright tests')
    run('npx playwright test', join(MONOREPO, 'tests/production'))

    step('ALL PASSED')

  } finally {
    if (!keepApp) {
      step('Teardown: Undeploy')
      try {
        const cliBin = join(APP_DIR, 'node_modules/.bin/deepspace')
        run(`${cliBin} undeploy ${APP_NAME}`, APP_DIR)
      } catch {
        console.warn('Undeploy failed (may already be cleaned up)')
      }
      try {
        rmSync(WORK_DIR, { recursive: true, force: true })
      } catch {
        console.warn(`Could not clean ${WORK_DIR}`)
      }
    } else {
      console.log(`\n  KEEP_APP: working dir preserved at ${WORK_DIR}`)
      console.log(`  App live at: https://${APP_NAME}.app.space`)
    }
  }
}

main().catch((err) => {
  console.error('\n  E2E failed:', err.message ?? err)
  process.exit(1)
})
