#!/usr/bin/env npx tsx
/**
 * Scaffold a test app from the starter template in a fresh directory.
 *
 * Simulates what `create-deepspace-app` does:
 * 1. Copies the starter template to an isolated directory
 * 2. Replaces __APP_NAME__ placeholders
 * 3. Rewrites workspace:* deps to point to packed tarballs
 * 4. Runs npm install
 *
 * Usage: npx tsx e2e/scripts/scaffold-test-app.ts <app-name> <target-dir> <packages-dir>
 */

import { cpSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { execSync } from 'node:child_process'

const MONOREPO_ROOT = resolve(import.meta.dirname, '../..')
const TEMPLATE_DIR = join(MONOREPO_ROOT, 'templates', 'starter')

const appName = process.argv[2]
const targetDir = process.argv[3]
const packagesDir = process.argv[4]

if (!appName || !targetDir || !packagesDir) {
  console.error('Usage: scaffold-test-app.ts <app-name> <target-dir> <packages-dir>')
  process.exit(1)
}

async function main() {
  const absTarget = resolve(targetDir)
  const absPackages = resolve(packagesDir)

  // Clean target if exists
  if (existsSync(absTarget)) {
    rmSync(absTarget, { recursive: true, force: true })
  }

  // Copy template
  console.log(`📁 Copying template to ${absTarget}`)
  copyDirSync(TEMPLATE_DIR, absTarget, new Set(['node_modules', 'dist', '.wrangler', '.deepspace']))

  // Replace __APP_NAME__
  console.log(`✏️  Replacing __APP_NAME__ → ${appName}`)
  replaceInDir(absTarget, '__APP_NAME__', appName)

  // Read package manifest
  const manifest = JSON.parse(readFileSync(join(absPackages, 'manifest.json'), 'utf-8'))
  const tarballPaths: Record<string, string> = manifest.packages

  // Rewrite package.json: replace workspace:* with file: tarball paths
  const pkgJsonPath = join(absTarget, 'package.json')
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

  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
  console.log(`📦 Rewrote workspace:* deps to tarball paths`)

  // Install dependencies
  console.log(`📥 Installing dependencies...`)
  execSync('npm install --no-fund --no-audit', {
    cwd: absTarget,
    stdio: 'inherit',
  })

  console.log(`\n✅ Test app scaffolded at ${absTarget}`)
}

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
  console.error('❌ Scaffold failed:', err)
  process.exit(1)
})
