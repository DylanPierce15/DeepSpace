#!/usr/bin/env npx tsx
/** Step: Undeploy and clean up the temp directory. */

import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadState, clearState, run, step } from './state'

const state = loadState()
const E2E_DIR = resolve(import.meta.dirname, '../..')

step('Teardown')

if (state.deployed) {
  try {
    run(`${state.cliBin} undeploy ${state.appName}`, state.appDir)
  } catch {
    console.warn('  Undeploy failed (may already be cleaned up)')
  }
}

try {
  rmSync(state.workDir, { recursive: true, force: true })
  console.log(`  Removed ${state.workDir}`)
} catch {
  console.warn(`  Could not clean ${state.workDir}`)
}

try { rmSync(resolve(E2E_DIR, '.app-name')) } catch {}
clearState()

console.log('\n  Done.')
