/**
 * Apps routes — dashboard endpoints for listing apps and fetching analytics.
 *
 * GET /api/apps — list all apps owned by the authenticated user
 * GET /api/apps/:appName/analytics — per-app request/error/CPU analytics
 */

import { Hono } from 'hono'
import { safeJson } from 'deepspace/worker'
import type { Env } from '../worker'
import { authMiddleware } from '../middleware/auth'

const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'
const DISPATCH_NAMESPACE = 'spaces-apps'

interface AppRegistryEntry {
  appId: string
  ownerUserId: string
  deployedAt: string
  versionId?: string
}

const apps = new Hono<Env>()

// ============================================================================
// GET /api/apps — list user's deployed apps
// ============================================================================

apps.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const userApps: Array<AppRegistryEntry & { url: string }> = []

  let cursor: string | undefined
  do {
    const listed = await c.env.APP_REGISTRY.list({
      prefix: 'app-registry/',
      cursor,
    })

    const entries = await Promise.all(
      listed.objects.map(async (obj) => {
        const data = await c.env.APP_REGISTRY.get(obj.key)
        if (!data) return null
        return (await data.json()) as AppRegistryEntry
      }),
    )

    for (const entry of entries) {
      if (entry && entry.ownerUserId === userId) {
        userApps.push({
          ...entry,
          url: `https://${entry.appId}.app.space`,
        })
      }
    }

    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)

  return safeJson(c, { apps: userApps })
})

// ============================================================================
// GET /api/apps/:appName/analytics — per-app analytics from CF GraphQL API
// ============================================================================

type Period = '1h' | '6h' | '24h' | '7d' | '30d'

function periodToDateRange(period: Period): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case '1h':
      start.setHours(start.getHours() - 1)
      break
    case '6h':
      start.setHours(start.getHours() - 6)
      break
    case '24h':
      start.setDate(start.getDate() - 1)
      break
    case '7d':
      start.setDate(start.getDate() - 7)
      break
    case '30d':
      start.setDate(start.getDate() - 30)
      break
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

apps.get('/:appName/analytics', authMiddleware, async (c) => {
  const appName = c.req.param('appName')
  const userId = c.get('userId')
  const period = (c.req.query('period') || '24h') as Period

  if (!['1h', '6h', '24h', '7d', '30d'].includes(period)) {
    return safeJson(c, { error: 'Invalid period. Use: 1h, 6h, 24h, 7d, 30d' }, 400)
  }

  // Verify ownership
  const registryKey = `app-registry/${appName}.json`
  const existing = await c.env.APP_REGISTRY.get(registryKey)
  if (!existing) {
    return safeJson(c, { error: 'App not found' }, 404)
  }

  const meta = (await existing.json()) as AppRegistryEntry
  if (meta.ownerUserId !== userId) {
    return safeJson(c, { error: 'Not authorized' }, 403)
  }

  const { start, end } = periodToDateRange(period)

  const query = `
    query GetAppAnalytics($accountTag: String!, $start: Time!, $end: Time!, $scriptName: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 1000
            filter: {
              dispatchNamespaceName: "${DISPATCH_NAMESPACE}"
              scriptName: $scriptName
              datetime_geq: $start
              datetime_leq: $end
            }
          ) {
            sum {
              requests
              errors
              subrequests
            }
            quantiles {
              cpuTimeP50
              cpuTimeP99
            }
            dimensions {
              datetime
              status
            }
          }
        }
      }
    }
  `

  const graphqlRes = await fetch(CF_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        accountTag: c.env.CLOUDFLARE_ACCOUNT_ID,
        start,
        end,
        scriptName: appName,
      },
    }),
  })

  if (!graphqlRes.ok) {
    const err = await graphqlRes.text()
    console.error('[analytics] GraphQL error:', err)
    return safeJson(c, { error: 'Failed to fetch analytics' }, 502)
  }

  const graphqlData = (await graphqlRes.json()) as {
    data?: {
      viewer?: {
        accounts?: Array<{
          workersInvocationsAdaptive?: Array<{
            sum: { requests: number; errors: number; subrequests: number }
            quantiles: { cpuTimeP50: number; cpuTimeP99: number }
            dimensions: { datetime: string; status: string }
          }>
        }>
      }
    }
    errors?: Array<{ message: string }>
  }

  if (graphqlData.errors?.length) {
    console.error('[analytics] GraphQL errors:', graphqlData.errors)
    return safeJson(c, { error: 'Analytics query failed' }, 502)
  }

  const rows =
    graphqlData.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? []

  // Aggregate totals
  const totals = { requests: 0, errors: 0, subrequests: 0 }
  let cpuTimeP50 = 0
  let cpuTimeP99 = 0
  const timeseries: Array<{ datetime: string; requests: number; errors: number }> = []

  for (const row of rows) {
    totals.requests += row.sum.requests
    totals.errors += row.sum.errors
    totals.subrequests += row.sum.subrequests
    cpuTimeP50 = Math.max(cpuTimeP50, row.quantiles.cpuTimeP50)
    cpuTimeP99 = Math.max(cpuTimeP99, row.quantiles.cpuTimeP99)
    timeseries.push({
      datetime: row.dimensions.datetime,
      requests: row.sum.requests,
      errors: row.sum.errors,
    })
  }

  // Sort timeseries chronologically
  timeseries.sort((a, b) => a.datetime.localeCompare(b.datetime))

  return safeJson(c, {
    totals,
    cpuTime: { p50: cpuTimeP50, p99: cpuTimeP99 },
    timeseries,
    period,
  })
})

export default apps
