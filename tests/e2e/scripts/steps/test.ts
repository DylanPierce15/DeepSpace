#!/usr/bin/env npx tsx
/**
 * Step: Run Playwright tests.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/steps/test.ts           # all suites
 *   npx tsx tests/e2e/scripts/steps/test.ts auth       # auth suite only
 *   npx tsx tests/e2e/scripts/steps/test.ts app        # deployed app suite only
 */

import { resolve } from 'node:path'
import { loadState, run, step } from './state'

const state = loadState()
const E2E_DIR = resolve(import.meta.dirname, '../..')
const suite = process.argv[2] ?? 'all'

let testFiles = ''
if (suite === 'auth') {
  testFiles = 'tests/auth.spec.ts tests/cli.spec.ts'
} else if (suite === 'app') {
  testFiles = 'tests/app.spec.ts'
}

step(`Playwright tests (suite: ${suite})`)
run(
  `npx playwright test ${testFiles}`.trim(),
  E2E_DIR,
  {
    E2E_DEPLOY: state.deployed ? '1' : '',
    E2E_CLI_BIN: state.cliBin,
    E2E_APP_DIR: state.appDir,
  },
)
