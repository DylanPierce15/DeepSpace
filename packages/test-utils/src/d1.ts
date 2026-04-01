/**
 * D1 migration helpers for tests.
 *
 * Each worker has its own schema, so we export per-worker migration sets.
 * Call the relevant `migrate*()` function in beforeEach/beforeAll.
 */

// ============================================================================
// API Worker (BILLING_DB)
// ============================================================================

const BILLING_TABLES = [
  "CREATE TABLE IF NOT EXISTS user_profiles (id TEXT PRIMARY KEY, email TEXT, name TEXT, image TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_status TEXT DEFAULT 'free', subscription_tier TEXT DEFAULT 'free', subscription_current_period_end INTEGER, subscription_credits REAL DEFAULT 0, purchased_credits REAL DEFAULT 0, bonus_credits_remaining REAL DEFAULT 0, bonus_credits_expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))",

  "CREATE TABLE IF NOT EXISTS integration_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, integration_name TEXT NOT NULL, endpoint TEXT NOT NULL, billing_units TEXT NOT NULL, unit_cost TEXT NOT NULL, total_cost TEXT NOT NULL, currency TEXT DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'pending', external_request_id TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), completed_at INTEGER)",

  "CREATE TABLE IF NOT EXISTS stripe_invoices (id TEXT PRIMARY KEY, user_id TEXT, stripe_customer_id TEXT, amount_due INTEGER, amount_paid INTEGER, status TEXT DEFAULT 'void', credits_purchased REAL, updated_at INTEGER DEFAULT (unixepoch()))",
]

export async function migrateBillingDb(db: D1Database) {
  for (const sql of BILLING_TABLES) {
    await db.exec(sql)
  }
}

export async function cleanBillingDb(db: D1Database) {
  await db.exec('DELETE FROM integration_usage')
  await db.exec('DELETE FROM user_profiles')
  await db.exec('DELETE FROM stripe_invoices')
}

// ============================================================================
// Auth Worker (AUTH_DB) — Better Auth manages its own tables, but we need them for tests
// ============================================================================

const AUTH_TABLES = [
  "CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, emailVerified INTEGER DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()))",

  "CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id), token TEXT NOT NULL UNIQUE, expiresAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()))",

  "CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id), accountId TEXT NOT NULL, providerId TEXT NOT NULL, accessToken TEXT, refreshToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()))",

  "CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL DEFAULT (unixepoch()), updatedAt INTEGER NOT NULL DEFAULT (unixepoch()))",
]

export async function migrateAuthDb(db: D1Database) {
  for (const sql of AUTH_TABLES) {
    await db.exec(sql)
  }
}

export async function cleanAuthDb(db: D1Database) {
  await db.exec('DELETE FROM session')
  await db.exec('DELETE FROM account')
  await db.exec('DELETE FROM verification')
  await db.exec('DELETE FROM user')
}
