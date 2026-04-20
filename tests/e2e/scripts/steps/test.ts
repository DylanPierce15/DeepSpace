#!/usr/bin/env npx tsx
/**
 * Step: Run Playwright tests.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/steps/test.ts             # auth + cli + app + installed features
 *   npx tsx tests/e2e/scripts/steps/test.ts auth        # auth + cli only
 *   npx tsx tests/e2e/scripts/steps/test.ts app         # deployed app suite only
 *   npx tsx tests/e2e/scripts/steps/test.ts features    # feature-tests only (for installed features)
 *
 * Feature specs live in `tests/feature-tests/tests/<feature-id>.spec.ts`
 * and run against the deployed app under a separate Playwright config
 * (tests/feature-tests/playwright.config.ts). They only execute for
 * feature ids present in `state.features` — which `steps/add-feature.ts`
 * populates. Drop-in a new `<feature>.spec.ts` and `--features <id>`
 * will pick it up on the next run.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadState, run, step } from './state'

const state = loadState()
const REPO_ROOT = resolve(import.meta.dirname, '../../../..')
const E2E_DIR = resolve(REPO_ROOT, 'tests/e2e')
const FEATURE_TESTS_DIR = resolve(REPO_ROOT, 'tests/feature-tests')
const suite = process.argv[2] ?? 'all'

const env = {
  E2E_DEPLOY: state.deployed ? '1' : '',
  E2E_CLI_BIN: state.cliBin,
  E2E_APP_DIR: state.appDir,
}

/**
 * Run a suite and return the error if it threw (non-zero exit). Never
 * rethrows — `main()` is responsible for collecting failures across all
 * suites and exiting at the end, so one failing suite doesn't silently
 * skip the others.
 */
function runSuiteSafe(fn: () => void): Error | null {
  try {
    fn()
    return null
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err))
  }
}

function runCoreSuite(files: string) {
  run(`npx playwright test ${files}`.trim(), E2E_DIR, env)
}

/**
 * For each installed feature, run its matching spec under the
 * feature-tests Playwright config. Missing spec = silently skipped
 * (the feature exists but nobody wrote a test yet — report but don't
 * fail, so dropping a new feature into `--features` without a spec
 * doesn't block merge-gate runs).
 */
function runFeatureSuites(features: string[]) {
  if (!state.deployed) {
    console.log('\n  (skipping feature tests — app not deployed)')
    return
  }
  if (features.length === 0) {
    console.log('\n  (no features installed — nothing to run)')
    return
  }

  const specs: string[] = []
  const missing: string[] = []
  for (const feat of features) {
    const specPath = resolve(FEATURE_TESTS_DIR, 'tests', `${feat}.spec.ts`)
    if (existsSync(specPath)) specs.push(`tests/${feat}.spec.ts`)
    else missing.push(feat)
  }

  if (missing.length) {
    console.log(`\n  (no spec found for: ${missing.join(', ')} — install-only, skipped)`)
  }
  if (specs.length === 0) return

  step(`Feature tests: ${specs.join(', ')}`)
  run(
    `npx playwright test --config playwright.config.ts ${specs.join(' ')}`,
    FEATURE_TESTS_DIR,
    env,
  )
}

const features = state.features ?? []
const failures: Array<{ suite: string; err: Error }> = []

function trackSuite(name: string, fn: () => void) {
  const err = runSuiteSafe(fn)
  if (err) failures.push({ suite: name, err })
}

if (suite === 'auth') {
  step('Playwright tests (suite: auth)')
  trackSuite('auth', () => runCoreSuite('tests/auth.spec.ts tests/cli.spec.ts'))
} else if (suite === 'app') {
  step('Playwright tests (suite: app)')
  trackSuite('app', () => runCoreSuite('tests/app.spec.ts'))
} else if (suite === 'features') {
  trackSuite('features', () => runFeatureSuites(features))
} else {
  // Default "all": core suites + feature suites for whatever's installed.
  // Run all of them even if an earlier one fails, so merge-gate output
  // shows the full picture instead of stopping at the first red.
  step('Playwright tests (suite: all)')
  trackSuite('core', () => runCoreSuite(''))
  trackSuite('features', () => runFeatureSuites(features))
}

if (failures.length > 0) {
  console.error(`\n  Suites failed: ${failures.map(f => f.suite).join(', ')}`)
  for (const f of failures) console.error(`    - ${f.suite}: ${f.err.message}`)
  process.exit(1)
}
