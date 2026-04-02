#!/usr/bin/env node

/**
 * DeepSpace CLI
 *
 * Commands:
 *   create   — scaffold a new DeepSpace app
 *   login    — authenticate with your DeepSpace account
 *   deploy   — build and deploy your app to *.app.space
 *   undeploy — remove a deployed app
 */

import { defineCommand, runMain } from 'citty'
import create from './commands/create'
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
    create,
    login,
    deploy,
    undeploy,
  },
  run() {
    console.log('deepspace-sdk CLI — run `deepspace --help` for usage')
  },
})

runMain(main)
