#!/usr/bin/env npx tsx
/**
 * Pack all @deepspace workspace packages as tarballs.
 *
 * Produces .tgz files in a staging directory, then rewrites workspace:*
 * references in each tarball's package.json to point to the sibling tarballs
 * via file: protocol.
 *
 * Usage: npx tsx e2e/scripts/pack-packages.ts [output-dir]
 */

import { execSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'

const MONOREPO_ROOT = resolve(import.meta.dirname, '../..')
const DEFAULT_OUT = resolve(import.meta.dirname, '../.packages')

// Packages to pack, in dependency order (leaves first)
const PACKAGES = [
  { name: '@deepspace/types', dir: 'packages/shared-types' },
  { name: '@deepspace/config', dir: 'packages/config' },
  { name: '@deepspace/auth', dir: 'packages/auth' },
  { name: '@deepspace/sdk', dir: 'packages/sdk' },
  { name: '@deepspace/sdk-worker', dir: 'packages/sdk-worker' },
]

const outDir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT

async function main() {
  mkdirSync(outDir, { recursive: true })

  // Map package name → tarball filename
  const tarballMap: Record<string, string> = {}

  for (const pkg of PACKAGES) {
    const pkgDir = join(MONOREPO_ROOT, pkg.dir)
    console.log(`📦 Packing ${pkg.name}...`)

    // pnpm pack outputs a .tgz in the package dir
    const result = execSync('pnpm pack --pack-destination ' + outDir, {
      cwd: pkgDir,
      encoding: 'utf-8',
    }).trim()

    // Result is the path or filename of the tarball
    const tgzName = basename(result)
    tarballMap[pkg.name] = tgzName
    console.log(`   → ${tgzName}`)
  }

  // Write a manifest so the E2E setup can find tarballs
  const manifest = {
    packages: Object.fromEntries(
      PACKAGES.map((pkg) => [pkg.name, join(outDir, tarballMap[pkg.name])]),
    ),
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Packed ${PACKAGES.length} packages to ${outDir}`)
  console.log(`   Manifest: ${join(outDir, 'manifest.json')}`)
}

main().catch((err) => {
  console.error('❌ Pack failed:', err)
  process.exit(1)
})
