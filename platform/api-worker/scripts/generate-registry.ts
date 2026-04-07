/**
 * Auto-generates _registry.ts by scanning integrations/ folders.
 * Run: pnpm generate:registry
 * Also runs automatically via pnpm dev/deploy/test hooks.
 */

import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const integrationsDir = resolve(__dirname, '../src/integrations')

const integrations = readdirSync(integrationsDir)
  .filter((name) => {
    if (name.startsWith('_')) return false
    return statSync(join(integrationsDir, name)).isDirectory()
  })
  .sort()

const imports = integrations
  .map((name) => `import { endpoints as ${name} } from './${name}'`)
  .join('\n')

const spread = integrations
  .map((name) => `  ...${name},`)
  .join('\n')

const content = `/**
 * AUTO-GENERATED — do not edit manually.
 * Run \`pnpm generate:registry\` to regenerate.
 * Source: scripts/generate-registry.ts
 */

import type { z } from 'zod'
import type { IntegrationHandler, BillingConfig } from './_types'
${imports}

const ALL_ENDPOINTS = {
${spread}
}

export const HANDLER_REGISTRY = new Map<string, IntegrationHandler>()
export const BILLING_CONFIGS: Record<string, BillingConfig & { integrationName: string; endpoint: string }> = {}
export const SCHEMA_REGISTRY = new Map<string, z.ZodType>()

for (const [key, def] of Object.entries(ALL_ENDPOINTS)) {
  const [integrationName, endpoint] = key.split('/')
  HANDLER_REGISTRY.set(key, def.handler)
  BILLING_CONFIGS[key] = { ...def.billing, integrationName, endpoint }
  if (def.schema) SCHEMA_REGISTRY.set(key, def.schema)
}
`

writeFileSync(join(integrationsDir, '_registry.ts'), content)
console.log(`✓ Generated _registry.ts with ${integrations.length} integrations: ${integrations.join(', ')}`)
