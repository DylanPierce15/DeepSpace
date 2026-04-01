#!/usr/bin/env node

/**
 * DeepSpace CLI
 *
 * Commands:
 *   login  — authenticate with your DeepSpace account
 *   deploy — build and deploy your app to *.app.space
 */

import { defineCommand, runMain } from 'citty'
import login from './commands/login'
import deploy from './commands/deploy'
import undeploy from './commands/undeploy'

const main = defineCommand({
  meta: {
    name: 'deepspace',
    version: '0.1.0',
    description: 'DeepSpace SDK CLI',
  },
  subCommands: {
    login,
    deploy,
    undeploy,
  },
  run() {
    console.log('deepspace-sdk CLI — run `deepspace --help` for usage')
  },
})

runMain(main)
