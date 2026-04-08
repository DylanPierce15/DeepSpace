#!/usr/bin/env npx tsx
/**
 * Step: Scaffold multiple apps, add features, login, and deploy all.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/steps/scaffold-multi.ts
 *
 * Creates 3 apps with different features, deploys all, and saves state.
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

const MONOREPO = resolve(import.meta.dirname, '../../../..')
const E2E_DIR = resolve(import.meta.dirname, '../..')
const STATE_PATH = resolve(E2E_DIR, '.e2e-state.json')
const WORK_DIR = join(tmpdir(), `deepspace-e2e-multi-${Date.now()}`)

const createBin = join(MONOREPO, 'packages/create-deepspace/dist/index.js')
if (!existsSync(createBin)) {
  throw new Error('create-deepspace not built. Run the "build" step first.')
}

const apps = [
  { suffix: 'files', features: ['file-manager'] },
  { suffix: 'items', features: ['items'] },
  { suffix: 'msg', features: ['messaging'] },
]

function run(cmd: string, cwd: string) {
  console.log(`  $ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

mkdirSync(WORK_DIR, { recursive: true })

const deployed: Array<{ name: string; dir: string; url: string; features: string[] }> = []

for (const app of apps) {
  const name = `ds-e2e-${Date.now().toString(36)}-${app.suffix}`
  const dir = join(WORK_DIR, name)
  const cli = join(dir, 'node_modules/.bin/deepspace')

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Scaffold: ${name} (features: ${app.features.join(', ')})`)
  console.log(`${'='.repeat(60)}`)

  execSync(`"${createBin}" ${name} --local "${MONOREPO}"`, { cwd: WORK_DIR, stdio: 'inherit' })

  for (const feature of app.features) {
    console.log(`\n  Adding feature: ${feature}`)
    run(`${cli} add ${feature}`, dir)
  }

  console.log(`\n  Logging in...`)
  run(`${cli} login --email e2e-test@deepspace.test --password TestPass123!`, dir)

  console.log(`\n  Deploying...`)
  run(`${cli} deploy`, dir)

  deployed.push({ name, dir, url: `https://${name}.app.space`, features: app.features })
}

// Save state for testing/teardown
const state = { workDir: WORK_DIR, apps: deployed }
writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))

console.log(`\n${'='.repeat(60)}`)
console.log(`  All 3 apps deployed:`)
for (const app of deployed) {
  console.log(`    ${app.url}  (${app.features.join(', ')})`)
}
console.log(`${'='.repeat(60)}`)
