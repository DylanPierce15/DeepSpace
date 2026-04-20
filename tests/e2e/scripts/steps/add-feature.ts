#!/usr/bin/env npx tsx
/**
 * Step: Add a feature to the scaffolded app.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts file-manager
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts messaging
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts --list
 *
 * Non-list invocations also record the installed feature id in
 * `.e2e-state.json` under `features[]`, so `steps/test.ts` knows
 * which `tests/feature-tests/tests/<id>.spec.ts` to run after the
 * app suite. Re-adding the same feature is a no-op for the state
 * list (set semantics) but still delegates to the CLI.
 */

import { loadState, saveState, run, step } from './state'

const state = loadState()
const featureArg = process.argv.slice(2).join(' ')

if (!featureArg) {
  console.error('Usage: add-feature.ts <feature-name> | --list')
  process.exit(1)
}

step(`Add feature: ${featureArg}`)
run(`${state.cliBin} add ${featureArg}`, state.appDir)

// Only track concrete feature ids in state — skip the `--list` / flag cases.
if (!featureArg.startsWith('-')) {
  const installed = new Set(state.features ?? [])
  installed.add(featureArg)
  saveState({ ...state, features: Array.from(installed) })
  console.log(`\n  Recorded in state.features: [${Array.from(installed).join(', ')}]`)
} else {
  console.log('\n  Done.')
}
