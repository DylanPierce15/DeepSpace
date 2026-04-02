/**
 * DeepSpace CLI
 *
 * Commands:
 *   login    — authenticate with your DeepSpace account
 *   deploy   — build and deploy your app to *.app.space
 *   undeploy — remove a deployed app
 *   create   — redirects to `npm create deepspace`
 */

import { defineCommand, runMain } from 'citty'
import { execSync } from 'node:child_process'
import login from './commands/login'
import deploy from './commands/deploy'
import undeploy from './commands/undeploy'

const create = defineCommand({
  meta: {
    name: 'create',
    description: 'Create a new DeepSpace app',
  },
  args: {
    name: {
      type: 'positional',
      description: 'App name',
      required: false,
    },
  },
  run({ args }) {
    const name = args.name ? ` ${args.name}` : ''
    console.log(`Running: npm create deepspace${name}\n`)
    execSync(`npm create deepspace@latest${name}`, { stdio: 'inherit' })
  },
})

const main = defineCommand({
  meta: {
    name: 'deepspace',
    version: '0.1.0',
    description: 'DeepSpace SDK CLI',
  },
  subCommands: {
    create,
    login,
    deploy,
    undeploy,
  },
  run() {
    console.log('deepspace CLI — run `deepspace --help` for usage')
  },
})

runMain(main)
