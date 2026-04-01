#!/usr/bin/env node

/**
 * DeepSpace CLI
 *
 * Commands: create, deploy, dev, login
 */

import { defineCommand, runMain } from 'citty'

const main = defineCommand({
  meta: {
    name: 'deepspace',
    version: '0.1.0',
    description: 'DeepSpace SDK CLI',
  },
  subCommands: {
    // TODO: implement subcommands
  },
  run() {
    console.log('deepspace-sdk CLI — run `deepspace --help` for usage')
  },
})

runMain(main)
