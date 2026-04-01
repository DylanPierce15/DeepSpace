/**
 * Shared test helpers for D1 migration and cleanup.
 */

import { env } from 'cloudflare:test'

const MIGRATIONS = [
  'CREATE TABLE IF NOT EXISTS user_profiles (id TEXT PRIMARY KEY, email TEXT, name TEXT, image TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT DEFAULT \'free\', subscription_tier TEXT DEFAULT \'free\', subscription_current_period_end INTEGER, subscription_credits REAL DEFAULT 0, purchased_credits REAL DEFAULT 0, bonus_credits_remaining REAL DEFAULT 0, bonus_credits_expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))',

  'CREATE TABLE IF NOT EXISTS integration_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, integration_name TEXT NOT NULL, endpoint TEXT NOT NULL, billing_units TEXT NOT NULL, unit_cost TEXT NOT NULL, total_cost TEXT NOT NULL, currency TEXT DEFAULT \'USD\', status TEXT NOT NULL DEFAULT \'pending\', external_request_id TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), completed_at INTEGER)',

  'CREATE TABLE IF NOT EXISTS stripe_invoices (id TEXT PRIMARY KEY, user_id TEXT, stripe_customer_id TEXT, amount_due INTEGER, amount_paid INTEGER, status TEXT DEFAULT \'void\', credits_purchased REAL, updated_at INTEGER DEFAULT (unixepoch()))',
]

export async function migrateTestDb() {
  const db = env.BILLING_DB
  for (const sql of MIGRATIONS) {
    await db.exec(sql)
  }
}

export async function cleanTables() {
  const db = env.BILLING_DB
  await db.exec('DELETE FROM integration_usage')
  await db.exec('DELETE FROM user_profiles')
  await db.exec('DELETE FROM stripe_invoices')
}
