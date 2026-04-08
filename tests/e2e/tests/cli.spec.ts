/**
 * E2E: CLI commands — login, whoami, test-accounts, dev (smoke), deploy/undeploy.
 *
 * Runs the actual deepspace CLI binary from the scaffolded app.
 * The CLI path is passed via E2E_CLI_BIN env var from the runner.
 */

import { test, expect } from './fixtures'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const CLI = process.env.E2E_CLI_BIN
const APP_DIR = process.env.E2E_APP_DIR

// Skip if runner didn't provide CLI path
test.skip(!CLI || !APP_DIR, 'No CLI binary (must run via e2e runner)')

function cli(args: string, opts?: { cwd?: string; expectFail?: boolean }): string {
  const cwd = opts?.cwd ?? APP_DIR!
  try {
    return execSync(`${CLI} ${args}`, { cwd, encoding: 'utf-8', timeout: 30_000 }).trim()
  } catch (err: any) {
    if (opts?.expectFail) return err.stderr?.toString() ?? err.stdout?.toString() ?? ''
    throw err
  }
}

// ============================================================================
// Login & identity
// ============================================================================

test.describe('CLI: login & whoami', () => {
  test('whoami shows current user', () => {
    const out = cli('whoami')
    expect(out).toMatch(/e2e-test@deepspace\.test|E2E Test User/)
  })

  test('login with wrong password fails', () => {
    const out = cli('login --email e2e-test@deepspace.test --password WrongPass123!', { expectFail: true })
    expect(out.toLowerCase()).toMatch(/fail|error|denied/)
  })
})

// ============================================================================
// Test accounts
// ============================================================================

test.describe('CLI: test-accounts', () => {
  const email = `cli-e2e-${Date.now()}@deepspace.test`
  let createdId = ''

  test('create a test account', () => {
    const out = cli(`test-accounts create --email ${email} --password CliTest123! --name "CLI Test" --label cli-e2e`)
    expect(out).toContain('Created test account')
    expect(out).toContain(email)
    expect(out).toContain('Saved to')

    // Extract ID from output
    const match = out.match(/ID:\s+(\S+)/)
    expect(match).toBeTruthy()
    createdId = match![1]
  })

  test('credentials saved to ~/.deepspace/test-accounts.json', () => {
    const path = join(homedir(), '.deepspace', 'test-accounts.json')
    expect(existsSync(path)).toBe(true)
    const accounts = JSON.parse(readFileSync(path, 'utf-8'))
    const found = accounts.find((a: any) => a.email === email)
    expect(found).toBeTruthy()
    expect(found.password).toBe('CliTest123!')
    expect(found.id).toBe(createdId)
  })

  test('list shows the created account', () => {
    const out = cli('test-accounts list')
    expect(out).toContain(email)
    expect(out).toContain('cli-e2e')
    expect(out).toContain('Password: CliTest123!')
  })

  test('delete the test account', () => {
    const out = cli(`test-accounts delete ${createdId}`)
    expect(out).toContain('deleted')
  })

  test('list no longer shows deleted account', () => {
    const out = cli('test-accounts list')
    expect(out).not.toContain(email)
  })

  test('create rejects non-@deepspace.test email', () => {
    const out = cli('test-accounts create --email bad@example.com --password BadTest123! --name Bad', { expectFail: true })
    expect(out).toContain('@deepspace.test')
  })
})
