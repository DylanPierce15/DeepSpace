#!/usr/bin/env npx tsx
/** Step: Deploy the scaffolded app. */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadState, saveState, run, step } from './state'

const state = loadState()
const E2E_DIR = resolve(import.meta.dirname, '../..')

step('Deploy')
run(`${state.cliBin} deploy`, state.appDir)
writeFileSync(resolve(E2E_DIR, '.app-name'), state.appName)
saveState({ ...state, deployed: true })

console.log(`\n  Live at: https://${state.appName}.app.space`)
