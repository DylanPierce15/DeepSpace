#!/usr/bin/env npx tsx
/**
 * E2E test runner — orchestrates individual steps.
 *
 * All-in-one:
 *   npx tsx tests/e2e/scripts/run.ts              # auth tests only
 *   npx tsx tests/e2e/scripts/run.ts --deploy     # auth + deployed app tests
 *   npx tsx tests/e2e/scripts/run.ts --keep       # preserve app after tests
 *   npx tsx tests/e2e/scripts/run.ts --skip-build # skip package builds
 *   npx tsx tests/e2e/scripts/run.ts --suite auth # specific suite
 *
 * Step-by-step (for manual intervention between steps):
 *   npx tsx tests/e2e/scripts/steps/build.ts
 *   npx tsx tests/e2e/scripts/steps/scaffold.ts
 *   # ... modify the app, add features, etc.
 *   npx tsx tests/e2e/scripts/steps/login.ts
 *   npx tsx tests/e2e/scripts/steps/deploy.ts
 *   npx tsx tests/e2e/scripts/steps/test.ts app
 *   npx tsx tests/e2e/scripts/steps/teardown.ts
 */

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { hasState } from './steps/state'

const STEPS_DIR = resolve(import.meta.dirname, 'steps')

const args = process.argv.slice(2)
const deploy = args.includes('--deploy')
const keep = args.includes('--keep')
const skipBuild = args.includes('--skip-build')
const suiteArg = args.find((_, i, a) => a[i - 1] === '--suite') ?? (deploy ? 'all' : 'auth')

function tsx(script: string, extraArgs: string[] = []) {
  const cmd = `npx tsx ${resolve(STEPS_DIR, script)} ${extraArgs.join(' ')}`.trim()
  execSync(cmd, { stdio: 'inherit' })
}

async function main() {
  try {
    if (!skipBuild) tsx('build.ts')
    tsx('scaffold.ts')
    tsx('login.ts')
    if (deploy) tsx('deploy.ts')
    tsx('test.ts', [suiteArg])

    console.log(`\n${'='.repeat(60)}\n  ALL PASSED\n${'='.repeat(60)}`)
  } finally {
    if (!keep && hasState()) {
      tsx('teardown.ts')
    } else if (keep) {
      const { loadState } = await import('./steps/state')
      const state = loadState()
      console.log(`\n  --keep: work dir preserved at ${state.workDir}`)
      if (state.deployed) console.log(`  App live at: https://${state.appName}.app.space`)
    }
  }
}

main().catch((err) => {
  console.error('\n  E2E FAILED:', err.message ?? err)
  process.exit(1)
})
