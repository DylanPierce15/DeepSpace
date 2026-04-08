#!/usr/bin/env npx tsx
/** Step: Log in the test user. */

import { loadState, run, step } from './state'

const state = loadState()

step('Login')
run(
  `${state.cliBin} login --email e2e-test@deepspace.test --password TestPass123!`,
  state.appDir,
)
console.log('\n  Done.')
