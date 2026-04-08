#!/usr/bin/env npx tsx
/** Step: Build packages (deepspace + create-deepspace). */

import { join, resolve } from 'node:path'
import { run, step } from './state'

const MONOREPO = resolve(import.meta.dirname, '../../../..')

step('Build packages')
run('pnpm build', join(MONOREPO, 'packages/deepspace'))
run('pnpm build', join(MONOREPO, 'packages/create-deepspace'))
console.log('\n  Done.')
