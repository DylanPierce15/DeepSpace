/**
 * deepspace create <app-name>
 *
 * Scaffolds a new DeepSpace app:
 *   1. Fetches @deepspace/starter (from npm, or local monorepo with --local)
 *   2. Extracts template, replaces __APP_NAME__
 *   3. Fetches @deepspace/features → .deepspace/features/
 *   4. Installs dependencies
 */

import { defineCommand } from 'citty'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { tmpdir } from 'node:os'
import * as p from '@clack/prompts'

const STARTER_PACKAGE = '@deepspace/starter'
const FEATURES_PACKAGE = '@deepspace/features'

function validateAppName(name: string): string | null {
  if (!name) return 'App name is required'
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return 'Name must be lowercase alphanumeric with dashes'
  if (name.length > 63) return 'Name must be 63 characters or less'
  return null
}

function replaceInDir(dir: string, search: string, replace: string) {
  const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.toml', '.html', '.css', '.md'])
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.name === 'node_modules' || entry.name === '.wrangler') continue
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

/**
 * Pack a package to a tarball and extract to destDir.
 *
 * --local mode: finds the package in the monorepo and packs it directly.
 * Normal mode: fetches from npm registry via `npm pack`.
 */
function fetchAndExtract(packageName: string, destDir: string, local: boolean, monorepoRoot?: string): void {
  const tmp = join(tmpdir(), `deepspace-create-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  try {
    if (local && monorepoRoot) {
      // Pack from the monorepo workspace
      const pkgDir = findWorkspacePackage(monorepoRoot, packageName)
      if (!pkgDir) throw new Error(`Package ${packageName} not found in monorepo at ${monorepoRoot}`)
      execSync(`pnpm pack --pack-destination ${tmp}`, { cwd: pkgDir, stdio: 'pipe' })
    } else {
      // Fetch from npm
      execSync(`npm pack ${packageName} --pack-destination ${tmp}`, { stdio: 'pipe' })
    }

    const tarball = readdirSync(tmp).find((f) => f.endsWith('.tgz'))
    if (!tarball) throw new Error(`Failed to pack ${packageName}`)

    mkdirSync(destDir, { recursive: true })
    execSync(`tar xzf ${join(tmp, tarball)} -C ${destDir} --strip-components=1`, { stdio: 'pipe' })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/** Find a workspace package directory by its package.json name. */
function findWorkspacePackage(monorepoRoot: string, packageName: string): string | null {
  const searchDirs = ['packages', 'templates', 'platform']
  for (const base of searchDirs) {
    const baseDir = join(monorepoRoot, base)
    if (!existsSync(baseDir)) continue
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(baseDir, entry.name, 'package.json')
      if (!existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === packageName) return join(baseDir, entry.name)
      } catch { /* skip */ }
    }
  }
  return null
}

/** Detect if we're inside the deepspace-sdk monorepo. */
function findMonorepoRoot(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) && existsSync(join(dir, 'packages', 'cli'))) {
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return null
}

export default defineCommand({
  meta: {
    name: 'create',
    description: 'Create a new DeepSpace app',
  },
  args: {
    name: {
      type: 'positional',
      description: 'App name (lowercase, alphanumeric, dashes)',
      required: false,
    },
    local: {
      type: 'boolean',
      description: 'Use local monorepo packages instead of npm',
      default: false,
    },
  },
  async run({ args }) {
    p.intro('Create a new DeepSpace app')

    // Get app name
    let appName = args.name as string | undefined
    if (!appName) {
      const result = await p.text({
        message: 'What is your app name?',
        placeholder: 'my-app',
        validate: (v) => validateAppName(v) ?? undefined,
      })
      if (p.isCancel(result)) { p.cancel('Cancelled'); process.exit(0) }
      appName = result as string
    } else {
      const error = validateAppName(appName)
      if (error) { p.cancel(error); process.exit(1) }
    }

    const appDir = resolve(appName)
    if (existsSync(appDir)) {
      p.cancel(`Directory ${appName} already exists`)
      process.exit(1)
    }

    // Detect local mode
    const local = args.local as boolean
    const monorepoRoot = local ? findMonorepoRoot() : null
    if (local && !monorepoRoot) {
      p.cancel('--local flag used but not inside the deepspace-sdk monorepo')
      process.exit(1)
    }
    if (local) {
      p.log.info(`Using local packages from ${monorepoRoot}`)
    }

    // Download and extract template
    const s = p.spinner()
    s.start('Fetching template')
    try {
      fetchAndExtract(STARTER_PACKAGE, appDir, local, monorepoRoot ?? undefined)
      s.stop('Template ready')
    } catch (e: any) {
      s.stop('Failed to fetch template')
      p.log.error(e.message)
      process.exit(1)
    }

    // Replace placeholders
    s.start('Configuring project')
    replaceInDir(appDir, '__APP_NAME__', appName)

    // Fix package.json
    const pkgPath = join(appDir, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    pkg.name = appName
    pkg.version = '0.0.1'
    pkg.private = true
    delete pkg.files
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

    // Remove dev-only files
    for (const f of ['wrangler.dev.toml']) {
      const fp = join(appDir, f)
      if (existsSync(fp)) rmSync(fp)
    }
    s.stop('Project configured')

    // Download features
    s.start('Fetching features')
    try {
      const deepspaceDir = join(appDir, '.deepspace')
      const featuresDir = join(deepspaceDir, 'features')
      fetchAndExtract(FEATURES_PACKAGE, featuresDir, local, monorepoRoot ?? undefined)
      writeFileSync(join(deepspaceDir, '.gitignore'), '*\n')
      s.stop('Features ready')
    } catch {
      s.stop('Features not available yet')
    }

    // Install dependencies
    s.start('Installing dependencies')
    try {
      execSync('npm install --no-fund --no-audit', { cwd: appDir, stdio: 'pipe' })
      s.stop('Dependencies installed')
    } catch {
      s.stop('Install failed — run npm install manually')
    }

    p.note(
      [`cd ${appName}`, 'deepspace login', 'deepspace deploy'].join('\n'),
      'Next steps',
    )
    p.outro(`${appName} is ready`)
  },
})
