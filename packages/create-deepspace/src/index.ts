/**
 * create-deepspace
 *
 * Scaffolds a new DeepSpace app:
 *   1. Copies embedded starter template
 *   2. Replaces __APP_NAME__ placeholders
 *   3. Installs dependencies
 *
 * Features are imported from the `deepspace` SDK package, not copied.
 *
 * Usage:
 *   npm create deepspace my-app
 *   create-deepspace my-app --local /path/to/deepspace-sdk
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { join, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import * as p from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '..', 'templates')
const FEATURES_DIR = join(__dirname, '..', 'features')

function parseArgs(argv: string[]): { appName?: string; local?: string } {
  let appName: string | undefined
  let local: string | undefined

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--local') {
      local = argv[++i]
    } else if (!argv[i].startsWith('-')) {
      appName = argv[i]
    }
  }

  return { appName, local }
}

function validateAppName(name: string): string | null {
  if (!name) return 'App name is required'
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return 'Name must be lowercase alphanumeric with dashes'
  if (name.length > 63) return 'Name must be 63 characters or less'
  return null
}

const BOILERPLATE_FILES = new Set([
  '.git', '.gitignore', '.gitattributes', 'readme.md', 'readme',
  'license', 'license.md', 'licence', 'licence.md', '.github',
])

function isNearEmpty(dir: string): boolean {
  const entries = readdirSync(dir).filter(
    (name) => !BOILERPLATE_FILES.has(name.toLowerCase()),
  )
  return entries.length === 0
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
 * Pack the deepspace package from the monorepo root and return the tarball path.
 */
function packLocal(monorepoRoot: string, appDir: string): string {
  const pkgDir = join(monorepoRoot, 'packages', 'deepspace')
  if (!existsSync(join(pkgDir, 'dist'))) {
    throw new Error(`deepspace not built — run: cd ${pkgDir} && pnpm build`)
  }
  const tgz = execSync('npm pack --pack-destination ' + JSON.stringify(appDir), {
    cwd: pkgDir,
    encoding: 'utf-8',
  }).trim()
  return join(appDir, tgz)
}

async function main() {
  const args = parseArgs(process.argv)

  p.intro('Create a new DeepSpace app')

  // Get app name
  let appName = args.appName
  if (!appName) {
    const result = await p.text({
      message: 'What is your app name?',
      placeholder: 'my-app',
      validate: (v) => validateAppName(v ?? '') ?? undefined,
    })
    if (p.isCancel(result)) { p.cancel('Cancelled'); process.exit(0) }
    appName = result as string
  } else {
    const error = validateAppName(appName)
    if (error) { p.cancel(error); process.exit(1) }
  }

  // If appName is "." or matches current directory name, and it's a near-empty git repo, scaffold in-place
  const cwd = process.cwd()
  const cwdName = cwd.split('/').pop() ?? ''
  if (appName === '.') appName = cwdName
  const isInPlace = (appName === cwdName) && existsSync(join(cwd, '.git')) && isNearEmpty(cwd)
  const appDir = isInPlace ? cwd : resolve(appName)

  if (!isInPlace && existsSync(appDir)) {
    p.cancel(`Directory ${appName} already exists`)
    process.exit(1)
  }

  // Copy template
  const s = p.spinner()
  const templateDir = join(TEMPLATES_DIR, 'starter')
  if (!existsSync(templateDir)) {
    p.cancel('Starter template not found — this is a bug in create-deepspace')
    process.exit(1)
  }

  s.start(isInPlace ? 'Scaffolding into existing repo' : 'Copying template')
  cpSync(templateDir, appDir, { recursive: true })

  // .gitignore is not included in templates (npm strips it), so generate it
  const gitignorePath = join(appDir, '.gitignore')
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, [
      'node_modules',
      'dist',
      '.wrangler',
      '.dev.vars',
      '.worker-bundle.js',
      '*.tgz',
      '',
    ].join('\n'))
  }
  s.stop('Template ready')

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

  // --local: replace deepspace dep with local tarball
  if (args.local) {
    s.stop('Project configured')
    s.start('Packing local deepspace')
    const tarballPath = packLocal(args.local, appDir)
    pkg.dependencies.deepspace = `file:${tarballPath}`
    s.stop('Local deepspace packed')
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  if (!args.local) s.stop('Project configured')

  // Copy features & add-feature script
  if (existsSync(FEATURES_DIR)) {
    s.start('Copying features')
    const deepspaceDir = join(appDir, '.deepspace')
    const featuresDir = join(deepspaceDir, 'features')
    const scriptsDir = join(deepspaceDir, 'scripts')
    mkdirSync(deepspaceDir, { recursive: true })
    mkdirSync(scriptsDir, { recursive: true })
    cpSync(FEATURES_DIR, featuresDir, {
      recursive: true,
      filter: (src) => !src.includes('/tests/') && !src.endsWith('/tests'),
    })
    const addFeatureScript = join(__dirname, '..', 'scripts', 'add-feature.cjs')
    if (existsSync(addFeatureScript)) {
      cpSync(addFeatureScript, join(scriptsDir, 'add-feature.cjs'))
    }
    writeFileSync(join(deepspaceDir, '.gitignore'), '*\n')
    s.stop('Features ready')
  }

  // Install dependencies
  s.start('Installing dependencies')
  try {
    execSync('npm install --no-fund --no-audit', { cwd: appDir, stdio: 'pipe' })
    s.stop('Dependencies installed')
  } catch {
    s.stop('Install failed — run npm install manually')
  }

  // Initialize git if not already a repo
  if (!existsSync(join(appDir, '.git'))) {
    try {
      execSync('git init', { cwd: appDir, stdio: 'pipe' })
    } catch {
      // git not available, skip
    }
  }

  p.note(
    [
      ...(isInPlace ? [] : [`cd ${appName}`]),
      'npx deepspace login',
      'npx deepspace deploy',
      '',
      'Add features:',
      '  node .deepspace/scripts/add-feature.cjs --list',
      '  node .deepspace/scripts/add-feature.cjs messaging .',
    ].join('\n'),
    'Next steps',
  )
  p.outro(`${appName} is ready`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
