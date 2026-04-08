/**
 * Shared E2E state — persisted to disk so each step can run independently.
 *
 * State file: tests/e2e/.e2e-state.json
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const STATE_PATH = resolve(import.meta.dirname, '../../.e2e-state.json')

export interface E2EState {
  appName: string
  appDir: string
  workDir: string
  cliBin: string
  deployed?: boolean
}

export function loadState(): E2EState {
  if (!existsSync(STATE_PATH)) {
    throw new Error('No E2E state found. Run the "scaffold" step first.')
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf-8'))
}

export function saveState(state: E2EState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

export function hasState(): boolean {
  return existsSync(STATE_PATH)
}

export function clearState(): void {
  try { rmSync(STATE_PATH) } catch {}
}

export function run(cmd: string, cwd: string, env?: Record<string, string>) {
  console.log(`\n  $ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
}

export function step(msg: string) {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`)
}
