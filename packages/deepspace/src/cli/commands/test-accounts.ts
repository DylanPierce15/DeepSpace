/**
 * deepspace test-accounts
 *
 * Manage test accounts for local development and CI.
 * Test accounts use @deepspace.test emails and are clearly
 * demarcated in the database. Max 10 per developer.
 *
 * Credentials are saved to ~/.deepspace/test-accounts.json (0600)
 * so they persist across projects and sessions.
 *
 *   deepspace test-accounts create --email bot@deepspace.test --password Pass123!
 *   deepspace test-accounts list
 *   deepspace test-accounts delete <id>
 */

import { defineCommand } from 'citty'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { ensureToken, SESSION_PATH } from '../auth'
import { ENVS } from '../env'
import { parseSafeResponse } from '../../shared/safe-response'

const SESSION_COOKIE = '__Secure-better-auth.session_token'

const AUTH_URL = process.env.DEEPSPACE_AUTH_URL ?? ENVS.prod.auth
const DIR = join(homedir(), '.deepspace')
const ACCOUNTS_PATH = join(DIR, 'test-accounts.json')

// ── Local credential store ─────────────────────────────────────────

interface StoredAccount {
  id: string
  email: string
  password: string
  userId: string
  name?: string
  label?: string | null
  createdAt: number
}

function loadAccounts(): StoredAccount[] {
  if (!existsSync(ACCOUNTS_PATH)) return []
  try {
    return JSON.parse(readFileSync(ACCOUNTS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2), { mode: 0o600 })
}

// ── Helpers ────────────────────────────────────────────────────────

function sessionCookie(): string {
  const token = readFileSync(SESSION_PATH, 'utf-8').trim()
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}`
}

// ── Subcommands ────────────────────────────────────────────────────

const create = defineCommand({
  meta: {
    name: 'create',
    description: 'Create a test account',
  },
  args: {
    email: {
      type: 'string',
      description: 'Email (must end with @deepspace.test)',
      required: true,
    },
    password: {
      type: 'string',
      description: 'Password (min 8 characters)',
      required: true,
    },
    name: {
      type: 'string',
      description: 'Display name',
      required: false,
    },
    label: {
      type: 'string',
      description: 'Label for this test account',
      required: false,
    },
  },
  async run({ args }) {
    await ensureToken()

    const res = await fetch(`${AUTH_URL}/api/auth/test-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie(),
        Origin: AUTH_URL,
      },
      body: JSON.stringify({
        email: args.email,
        password: args.password,
        name: args.name,
        label: args.label,
      }),
    })

    const { data, ok } = await parseSafeResponse<{
      id?: string
      email?: string
      userId?: string
      label?: string | null
      createdAt?: number
      error?: string
    }>(res)

    if (!ok || !data.id) {
      console.error(`Failed: ${data.error ?? 'Unknown error'}`)
      process.exit(1)
    }

    const account = data as { id: string; email: string; userId: string; label: string | null; createdAt: number }

    // Save credentials locally
    const accounts = loadAccounts()
    accounts.push({
      id: account.id,
      email: args.email,
      password: args.password,
      userId: account.userId,
      name: args.name,
      label: account.label,
      createdAt: account.createdAt,
    })
    saveAccounts(accounts)

    console.log(`Created test account:`)
    console.log(`  ID:       ${account.id}`)
    console.log(`  Email:    ${account.email}`)
    console.log(`  Password: ${args.password}`)
    console.log(`  UserID:   ${account.userId}`)
    if (account.label) console.log(`  Label:    ${account.label}`)
    console.log(`\nSaved to ${ACCOUNTS_PATH}`)
  },
})

const list = defineCommand({
  meta: {
    name: 'list',
    description: 'List your test accounts',
  },
  async run() {
    await ensureToken()

    // Fetch remote list (source of truth for what exists)
    const res = await fetch(`${AUTH_URL}/api/auth/test-accounts`, {
      headers: {
        Cookie: sessionCookie(),
        Origin: AUTH_URL,
      },
    })

    const { data, ok } = await parseSafeResponse<{
      accounts?: Array<{ id: string; email: string; userId: string; label: string | null; createdAt: number }>
      error?: string
    }>(res)

    if (!ok || !data.accounts) {
      console.error(`Failed: ${data.error ?? 'Unknown error'}`)
      process.exit(1)
    }

    const remote = data.accounts

    if (remote.length === 0) {
      console.log('No test accounts. Create one with: deepspace test-accounts create --email <email> --password <password>')
      return
    }

    // Merge with local credentials (passwords are only stored locally)
    const local = loadAccounts()
    const localByEmail = new Map(local.map((a) => [a.email, a]))

    console.log(`Test accounts (${remote.length}/10):\n`)
    for (const a of remote) {
      const stored = localByEmail.get(a.email)
      const date = new Date(a.createdAt).toLocaleDateString()
      console.log(`  ${a.email}${a.label ? ` (${a.label})` : ''}`)
      console.log(`    ID: ${a.id}  UserID: ${a.userId}  Created: ${date}`)
      if (stored?.password) {
        console.log(`    Password: ${stored.password}`)
      } else {
        console.log(`    Password: (not saved locally)`)
      }
    }
  },
})

const del = defineCommand({
  meta: {
    name: 'delete',
    description: 'Delete a test account',
  },
  args: {
    id: {
      type: 'positional',
      description: 'Test account ID',
      required: true,
    },
  },
  async run({ args }) {
    await ensureToken()

    const res = await fetch(`${AUTH_URL}/api/auth/test-accounts/${args.id}`, {
      method: 'DELETE',
      headers: {
        Cookie: sessionCookie(),
        Origin: AUTH_URL,
      },
    })

    const { data, ok } = await parseSafeResponse<{ deleted?: boolean; error?: string }>(res)

    if (!ok) {
      console.error(`Failed: ${data.error ?? 'Unknown error'}`)
      process.exit(1)
    }

    // Remove from local store
    const accounts = loadAccounts().filter((a) => a.id !== args.id)
    saveAccounts(accounts)

    console.log('Test account deleted.')
  },
})

export default defineCommand({
  meta: {
    name: 'test-accounts',
    description: 'Manage test accounts for development',
  },
  subCommands: {
    create,
    list,
    delete: del,
  },
})
