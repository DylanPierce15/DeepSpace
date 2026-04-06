/**
 * deepspace add <feature> [dir]
 *
 * Installs a DeepSpace feature into the current app.
 *
 *   deepspace add --list              # list available features
 *   deepspace add messaging           # install into current dir
 *   deepspace add messaging ./my-app  # install into specific dir
 *   deepspace add --info messaging    # show feature details
 */

import { defineCommand } from 'citty'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'

function findScript(from: string): string | null {
  const candidate = join(from, '.deepspace', 'scripts', 'add-feature.cjs')
  if (existsSync(candidate)) return candidate
  return null
}

export default defineCommand({
  meta: {
    name: 'add',
    description: 'Add a feature to your DeepSpace app',
  },
  args: {
    list: {
      type: 'boolean',
      alias: 'l',
      description: 'List available features',
      required: false,
    },
    info: {
      type: 'string',
      description: 'Show details about a feature',
      required: false,
    },
    feature: {
      type: 'positional',
      description: 'Feature to install',
      required: false,
    },
    dir: {
      type: 'positional',
      description: 'App directory (default: current directory)',
      required: false,
    },
  },
  run({ args }) {
    const appDir = resolve(args.dir ?? '.')
    const script = findScript(appDir)

    if (!script) {
      console.error('No .deepspace/scripts/add-feature.cjs found.')
      console.error('Are you in a DeepSpace app directory?')
      process.exit(1)
    }

    const passArgs: string[] = []

    if (args.list) {
      passArgs.push('--list')
    } else if (args.info) {
      passArgs.push('--info', args.info)
    } else if (args.feature) {
      passArgs.push(args.feature, appDir)
    } else {
      passArgs.push('--help')
    }

    execSync(`node ${JSON.stringify(script)} ${passArgs.map(a => JSON.stringify(a)).join(' ')}`, {
      stdio: 'inherit',
      cwd: appDir,
    })
  },
})
