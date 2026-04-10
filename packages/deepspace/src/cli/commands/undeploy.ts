/**
 * deepspace undeploy
 *
 * Removes a deployed app from *.app.space via the deploy worker.
 */

import { defineCommand } from 'citty'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseToml } from 'smol-toml'
import * as p from '@clack/prompts'
import { ensureToken } from '../auth'

import { ENVS } from '../env'

const DEPLOY_URL = process.env.DEEPSPACE_DEPLOY_URL ?? ENVS.prod.deploy

export default defineCommand({
  meta: {
    name: 'undeploy',
    description: 'Remove a deployed DeepSpace app',
  },
  args: {
    name: {
      type: 'positional',
      description: 'App name to undeploy (reads from wrangler.toml if omitted)',
      required: false,
    },
  },
  async run({ args }) {
    let appName = args.name

    // If no name given, try to read from wrangler.toml in cwd
    if (!appName) {
      const wranglerPath = join(process.cwd(), 'wrangler.toml')
      if (existsSync(wranglerPath)) {
        const config = parseToml(readFileSync(wranglerPath, 'utf-8')) as { name?: string }
        if (config.name) appName = config.name
      }
    }

    if (!appName) {
      p.cancel('Provide an app name or run from a DeepSpace app directory.')
      process.exit(1)
    }

    let token: string
    try {
      token = await ensureToken()
    } catch (err: any) {
      p.cancel(err.message)
      process.exit(1)
    }

    p.intro(`Undeploying ${appName}`)
    const s = p.spinner()
    s.start('Removing...')

    const res = await fetch(`${DEPLOY_URL}/api/deploy/${appName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }

    if (!res.ok || !body.success) {
      s.stop('Failed')
      p.cancel(body.error ?? `Undeploy error (${res.status})`)
      process.exit(1)
    }

    s.stop('Removed')
    p.outro(`${appName}.app.space has been taken down`)
  },
})
