#!/usr/bin/env node
/**
 * Music Studio — Canvas Widget → DeepSpace SDK Migration
 *
 * Reads data from the old canvas widget's RecordRoom (hosted on the platform
 * worker) and writes it into the new standalone app's RecordRoom.
 *
 * Prerequisites:
 *   1. `deepspace login` has been run (session stored in ~/.deepspace/session)
 *   2. The new app's dev server is running: cd apps/music-studio && deepspace dev
 *   3. The /api/admin/execute route must be temporarily added to worker.ts
 *      (see the route definition in git history — add it back, run migration, remove it)
 *
 * Usage:
 *   node scripts/migrate-from-canvas.mjs [options]
 *
 * Options:
 *   --room=<id>   Old canvas room ID (default: e545baca-b190-4e55-aa2e-a21517e8e9e5)
 *                 Use --room=default if you used the widget in standalone/deployed mode
 *   --url=<url>   New app dev server URL (default: http://localhost:5173)
 *   --dry-run     Read data only, don't write to new app
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// ── Configuration ──────────────────────────────────────────────────────────────

const PLATFORM_WORKER_URL = 'https://deepspace-platform-worker.eudaimonicincorporated.workers.dev'
const AUTH_URL = 'https://deepspace-auth.eudaimonicincorporated.workers.dev'
const SESSION_COOKIE = '__Secure-better-auth.session_token'

const args = process.argv.slice(2)
const OLD_ROOM_ID = (args.find(a => a.startsWith('--room=')) ?? '--room=e545baca-b190-4e55-aa2e-a21517e8e9e5').replace('--room=', '')
const NEW_APP_URL = (args.find(a => a.startsWith('--url=')) ?? '--url=http://localhost:5173').replace('--url=', '')
const DRY_RUN = args.includes('--dry-run')

// Collections and their field → SQL-column mappings.
// SQL column ID = "col_" + lowercase(fieldName) with non-alphanum → "_"
const COLLECTIONS = [
  {
    name: 'projects',
    tableName: 'c_projects',
    fields: {
      name: 'col_name',
      bpm: 'col_bpm',
      timeSignature: 'col_timesignature',
      tracks: 'col_tracks',
      visibility: 'col_visibility',
      publishedUrl: 'col_publishedurl',
      remixedFrom: 'col_remixedfrom',
      updatedAt: 'col_updatedat',
    },
    numberFields: new Set(['bpm']),
  },
  {
    name: 'published-projects',
    tableName: 'c_published_projects',
    fields: {
      name: 'col_name',
      authorId: 'col_authorid',
      authorName: 'col_authorname',
      bpm: 'col_bpm',
      publishedUrl: 'col_publishedurl',
      tracks: 'col_tracks',
      coverImageUrl: 'col_coverimageurl',
      genre: 'col_genre',
      tags: 'col_tags',
      remixedFrom: 'col_remixedfrom',
      publishedAt: 'col_publishedat',
    },
    numberFields: new Set(['bpm']),
  },
  {
    name: 'track-reactions',
    tableName: 'c_track_reactions',
    fields: {
      projectId: 'col_projectid',
      reactionType: 'col_reactiontype',
    },
    numberFields: new Set(),
  },
  {
    name: 'track-comments',
    tableName: 'c_track_comments',
    fields: {
      projectId: 'col_projectid',
      text: 'col_text',
    },
    numberFields: new Set(),
  },
  {
    name: 'producer-follows',
    tableName: 'c_producer_follows',
    fields: {
      followingId: 'col_followingid',
    },
    numberFields: new Set(),
  },
]

// ── Auth ───────────────────────────────────────────────────────────────────────

async function ensureToken() {
  const sessionPath = join(homedir(), '.deepspace', 'session')
  const tokenPath = join(homedir(), '.deepspace', 'token')

  if (!existsSync(sessionPath)) {
    throw new Error('Not logged in. Run `deepspace login` first.')
  }

  const sessionToken = readFileSync(sessionPath, 'utf-8').trim()

  if (existsSync(tokenPath)) {
    const existing = readFileSync(tokenPath, 'utf-8').trim()
    if (isJwtValid(existing)) return existing
  }

  console.log('Refreshing auth token...')
  const res = await fetch(`${AUTH_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      Cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
      Origin: AUTH_URL,
    },
  })

  if (!res.ok) {
    throw new Error(`Auth failed (${res.status}). Run \`deepspace login\` to re-authenticate.`)
  }

  const data = await res.json()
  if (!data.token) throw new Error('No token in auth response')

  writeFileSync(tokenPath, data.token, { mode: 0o600 })
  return data.token
}

function isJwtValid(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
    return payload.exp * 1000 > Date.now() + 30_000
  } catch {
    return false
  }
}

// ── Read from old widget via platform worker debug SQL ────────────────────────

async function checkTableExists(token, tableName) {
  const q = encodeURIComponent(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`)
  const res = await fetch(
    `${PLATFORM_WORKER_URL}/api/debug/sql?q=${q}&scopeId=${OLD_ROOM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return false
  const data = await res.json()
  return Array.isArray(data.rows) && data.rows.length > 0
}

async function queryTable(token, tableName) {
  const q = encodeURIComponent(`SELECT * FROM "${tableName}" ORDER BY _created_at ASC`)
  const res = await fetch(
    `${PLATFORM_WORKER_URL}/api/debug/sql?q=${q}&scopeId=${OLD_ROOM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SQL query failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  if (data.error) throw new Error(`SQL error: ${data.error}`)
  return data.rows ?? []
}

function rowToRecord(row, collection) {
  const data = {}

  for (const [fieldName, sqlCol] of Object.entries(collection.fields)) {
    const val = row[sqlCol]
    if (val !== undefined && val !== null && val !== '') {
      data[fieldName] = collection.numberFields.has(fieldName) ? Number(val) : val
    }
  }

  return {
    recordId: row._row_id,
    createdBy: row._created_by,
    createdAt: row._created_at,
    data,
  }
}

// ── Write to new app ───────────────────────────────────────────────────────────

async function createRecord(token, collection, recordId, data, asUserId) {
  const res = await fetch(`${NEW_APP_URL}/api/admin/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tool: 'records.create',
      params: { collection, recordId, data },
      asUserId,
    }),
  })

  const result = await res.json()
  return result
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Music Studio — Canvas Widget → DeepSpace SDK Migration')
  console.log('========================================================')
  console.log(`Source room:  ${OLD_ROOM_ID}`)
  console.log(`Destination:  ${NEW_APP_URL}`)
  if (DRY_RUN) console.log('Mode:         DRY RUN (no writes)')
  console.log()

  if (!DRY_RUN) {
    // Quick connectivity check before doing any reads
    try {
      const probe = await fetch(`${NEW_APP_URL}/api/auth/session`, { method: 'GET' })
      if (!probe.ok && probe.status !== 401 && probe.status !== 400) {
        throw new Error(`Dev server returned ${probe.status}`)
      }
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
        throw new Error(
          `Cannot connect to dev server at ${NEW_APP_URL}.\n` +
          `Make sure it's running: cd apps/music-studio && deepspace dev`
        )
      }
      // 401/400 from auth endpoint is fine — server is running
    }
  }

  const token = await ensureToken()
  console.log('Auth token OK\n')

  let totalMigrated = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const collection of COLLECTIONS) {
    console.log(`Collection: "${collection.name}"`)

    // Check if the table exists in the old RecordRoom
    const exists = await checkTableExists(token, collection.tableName)
    if (!exists) {
      console.log(`  Table "${collection.tableName}" not found — skipping\n`)
      continue
    }

    // Query all rows
    let rows
    try {
      rows = await queryTable(token, collection.tableName)
    } catch (err) {
      console.log(`  Error reading table: ${err.message}\n`)
      totalErrors++
      continue
    }

    if (rows.length === 0) {
      console.log('  No records found\n')
      continue
    }

    console.log(`  Found ${rows.length} records`)

    const records = rows.map(row => rowToRecord(row, collection))

    if (DRY_RUN) {
      console.log('  [dry-run] Records:')
      for (const r of records) {
        console.log(`    ${r.recordId} (by ${r.createdBy}): ${JSON.stringify(r.data).slice(0, 80)}`)
      }
      console.log()
      continue
    }

    let migrated = 0
    let skipped = 0

    for (const record of records) {
      try {
        const result = await createRecord(
          token,
          collection.name,
          record.recordId,
          record.data,
          record.createdBy,
        )

        if (result.success) {
          migrated++
        } else if (result.error?.includes('already exists') || result.error?.includes('UNIQUE')) {
          skipped++
        } else {
          console.log(`  ⚠ ${record.recordId}: ${result.error}`)
          totalErrors++
        }
      } catch (err) {
        console.log(`  ✗ ${record.recordId}: ${err.message}`)
        totalErrors++
      }
    }

    console.log(`  ✓ ${migrated} migrated, ${skipped} already existed`)
    totalMigrated += migrated
    totalSkipped += skipped
    console.log()
  }

  console.log('Summary')
  console.log('-------')
  console.log(`Migrated:  ${totalMigrated}`)
  console.log(`Skipped:   ${totalSkipped} (already existed)`)
  console.log(`Errors:    ${totalErrors}`)

  if (totalErrors > 0) {
    console.log('\nSome records failed. Check errors above.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
