#!/usr/bin/env npx tsx
/**
 * Step: Add a feature to the scaffolded app.
 *
 * Usage:
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts file-manager
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts messaging
 *   npx tsx tests/e2e/scripts/steps/add-feature.ts --list
 */

import { loadState, run, step } from './state'

const state = loadState()
const featureArg = process.argv.slice(2).join(' ')

if (!featureArg) {
  console.error('Usage: add-feature.ts <feature-name> | --list')
  process.exit(1)
}

step(`Add feature: ${featureArg}`)
run(`${state.cliBin} add ${featureArg}`, state.appDir)
console.log('\n  Done.')
