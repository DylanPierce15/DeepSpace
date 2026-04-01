#!/usr/bin/env npx tsx
/**
 * Full E2E test runner — simulates a real user outside the monorepo.
 *
 * 1. Pack @deepspace/* packages as tarballs
 * 2. Scaffold app in /tmp (from starter template, with tarball deps)
 * 3. npm install (real install, no symlinks)
 * 4. deepspace login (non-interactive, real auth)
 * 5. deepspace deploy (real build + deploy via deploy worker)
 * 6. Run Playwright tests against the live app
 * 7. deepspace undeploy (teardown)
 *
 * Usage: npx tsx tests/production/scripts/run-full-e2e.ts
 */

import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, existsSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'

const MONOREPO = resolve(import.meta.dirname, '../../..')
const APP_NAME = `ds-e2e-${Date.now().toString(36)}`
const WORK_DIR = join(tmpdir(), `deepspace-e2e-${Date.now()}`)
const APP_DIR = join(WORK_DIR, APP_NAME)
const PACKAGES_DIR = join(WORK_DIR, 'packages')
const TEMPLATE_DIR = join(MONOREPO, 'templates', 'starter')
const CLI_BIN = join(MONOREPO, 'packages', 'cli', 'dist', 'cli.js')

const TEST_EMAIL = 'e2e-test@deepspace.test'
const TEST_PASSWORD = 'TestPass123!'

function run(cmd: string, cwd: string) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function step(msg: string) {
  console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`)
}

async function main() {
  const keepApp = process.argv.includes('--keep')
  mkdirSync(WORK_DIR, { recursive: true })
  console.log(`App name: ${APP_NAME}`)
  console.log(`Working directory: ${WORK_DIR}`)

  try {
    // ── Step 1: Pack packages ───────────────────────────────────
    step('Step 1: Pack @deepspace/* packages as tarballs')
    mkdirSync(PACKAGES_DIR, { recursive: true })

    const packOrder = [
      { name: '@deepspace/types', dir: 'packages/shared-types' },
      { name: '@deepspace/config', dir: 'packages/config' },
      { name: '@deepspace/auth', dir: 'packages/auth' },
      { name: '@deepspace/sdk', dir: 'packages/sdk' },
      { name: '@deepspace/sdk-worker', dir: 'packages/sdk-worker' },
    ]

    const tarballPaths: Record<string, string> = {}
    for (const pkg of packOrder) {
      const pkgDir = join(MONOREPO, pkg.dir)
      const result = execSync(`pnpm pack --pack-destination ${PACKAGES_DIR}`, {
        cwd: pkgDir,
        encoding: 'utf-8',
      })
      const lines = result.trim().split('\n').filter(Boolean)
      const lastLine = lines[lines.length - 1].trim()
      const tgzPath = lastLine.startsWith('/') ? lastLine : join(PACKAGES_DIR, lastLine)
      tarballPaths[pkg.name] = tgzPath
      console.log(`  ${pkg.name} → ${tgzPath.split('/').pop()}`)
    }

    // ── Step 2: Scaffold app from template ──────────────────────
    step('Step 2: Scaffold app from starter template')
    copyDirSync(TEMPLATE_DIR, APP_DIR, new Set(['node_modules', 'dist', '.wrangler', '.deepspace']))
    replaceInDir(APP_DIR, '__APP_NAME__', APP_NAME)

    // Rewrite package.json: workspace:* → file: tarballs
    const pkgJsonPath = join(APP_DIR, 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    for (const depType of ['dependencies', 'devDependencies']) {
      const deps = pkgJson[depType]
      if (!deps) continue
      for (const [name, version] of Object.entries(deps)) {
        if (version === 'workspace:*' && tarballPaths[name]) {
          deps[name] = `file:${tarballPaths[name]}`
        }
      }
    }
    pkgJson.overrides = {}
    for (const [name, tgzPath] of Object.entries(tarballPaths)) {
      pkgJson.overrides[name] = `file:${tgzPath}`
    }
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
    console.log(`  Rewrote deps + overrides to tarball paths`)

    // ── Step 3: npm install ─────────────────────────────────────
    step('Step 3: npm install')
    run('npm install --no-fund --no-audit', APP_DIR)

    // ── Step 4: deepspace login ─────────────────────────────────
    step('Step 4: deepspace login')
    run(`node ${CLI_BIN} login --email ${TEST_EMAIL} --password ${TEST_PASSWORD}`, APP_DIR)

    // ── Step 5: deepspace deploy ────────────────────────────────
    step('Step 5: deepspace deploy')
    run(`node ${CLI_BIN} deploy`, APP_DIR)

    // Write app name for Playwright tests to read
    writeFileSync(join(MONOREPO, 'tests', 'production', '.app-name'), APP_NAME)

    // ── Step 6: Run Playwright tests ────────────────────────────
    step('Step 6: Playwright tests')
    run('npx playwright test', join(MONOREPO, 'tests', 'production'))

    step('ALL PASSED')

  } finally {
    if (!keepApp) {
      step('Step 7: Undeploy')
      try {
        run(`node ${CLI_BIN} undeploy ${APP_NAME}`, APP_DIR)
      } catch {
        console.warn('Undeploy failed (may already be cleaned up)')
      }
      try {
        rmSync(WORK_DIR, { recursive: true, force: true })
      } catch {
        console.warn(`Could not clean ${WORK_DIR}`)
      }
    } else {
      console.log(`\n  KEEP_APP: working dir preserved at ${WORK_DIR}`)
      console.log(`  App live at: https://${APP_NAME}.app.space`)
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function copyDirSync(src: string, dest: string, exclude: Set<string>) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue
    const s = join(src, entry.name)
    const d = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(s, d, exclude)
    } else {
      cpSync(s, d)
    }
  }
}

function replaceInDir(dir: string, search: string, replace: string) {
  const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.toml', '.html', '.css', '.md'])
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.name === 'node_modules') continue
    if (entry.isDirectory()) {
      replaceInDir(full, search, replace)
    } else if (textExts.has(extname(entry.name))) {
      const content = readFileSync(full, 'utf-8')
      if (content.includes(search)) {
        writeFileSync(full, content.replaceAll(search, replace))
      }
    }
  }
}

main().catch((err) => {
  console.error('\n❌ E2E failed:', err.message ?? err)
  process.exit(1)
})
