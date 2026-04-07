import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================================================
// User Profiles
// ============================================================================

export const userProfiles = sqliteTable('user_profiles', {
  id: text('id').primaryKey(), // user ID from JWT sub claim
  email: text('email'),
  name: text('name'),
  image: text('image'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionStatus: text('subscription_status').default('free'),
  subscriptionTier: text('subscription_tier').default('free'),
  subscriptionCurrentPeriodEnd: integer('subscription_current_period_end', { mode: 'timestamp' }),
  subscriptionCredits: real('subscription_credits').default(0),
  purchasedCredits: real('purchased_credits').default(0),
  bonusCreditsRemaining: real('bonus_credits_remaining').default(0),
  bonusCreditsExpiresAt: integer('bonus_credits_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
})

// ============================================================================
// Integration Usage
// ============================================================================

export const integrationUsage = sqliteTable('integration_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),           // who is being billed
  callerUserId: text('caller_user_id'),        // who made the call (null = same as userId)
  integrationName: text('integration_name').notNull(),
  endpoint: text('endpoint').notNull(),
  billingUnits: text('billing_units').notNull(),
  unitCost: text('unit_cost').notNull(),
  totalCost: text('total_cost').notNull(),
  currency: text('currency').default('USD'),
  status: text('status').default('pending').notNull(), // pending, completed, failed, refunded
  externalRequestId: text('external_request_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

// ============================================================================
// Stripe Invoices
// ============================================================================

export const stripeInvoices = sqliteTable('stripe_invoices', {
  id: text('id').primaryKey(), // Stripe invoice ID
  userId: text('user_id'),
  stripeCustomerId: text('stripe_customer_id'),
  amountDue: integer('amount_due'),
  amountPaid: integer('amount_paid'),
  status: text('status').default('void'), // draft, open, paid, uncollectible, void
  creditsPurchased: real('credits_purchased'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

// ============================================================================
// Inferred types
// ============================================================================

export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type IntegrationUsageRow = typeof integrationUsage.$inferSelect
export type NewIntegrationUsage = typeof integrationUsage.$inferInsert
export type StripeInvoice = typeof stripeInvoices.$inferSelect
