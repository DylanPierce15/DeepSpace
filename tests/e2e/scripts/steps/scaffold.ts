#!/usr/bin/env npx tsx
/** Step: Scaffold a new app in a temp directory. */

import { mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { saveState, step } from './state'

const MONOREPO = resolve(import.meta.dirname, '../../../..')
const APP_NAME = `ds-e2e-${Date.now().toString(36)}`
const WORK_DIR = join(tmpdir(), `deepspace-e2e-${Date.now()}`)
const APP_DIR = join(WORK_DIR, APP_NAME)

step('Scaffold app')

const createBin = join(MONOREPO, 'packages/create-deepspace/dist/index.js')
if (!existsSync(createBin)) {
  throw new Error('create-deepspace not built. Run the "build" step first.')
}

mkdirSync(WORK_DIR, { recursive: true })
execSync(`"${createBin}" ${APP_NAME} --local "${MONOREPO}"`, {
  cwd: WORK_DIR,
  stdio: 'inherit',
})

const cliBin = join(APP_DIR, 'node_modules/.bin/deepspace')

saveState({ appName: APP_NAME, appDir: APP_DIR, workDir: WORK_DIR, cliBin })

console.log(`\n  App name:  ${APP_NAME}`)
console.log(`  App dir:   ${APP_DIR}`)
console.log(`  CLI:       ${cliBin}`)
