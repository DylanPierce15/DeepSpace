/**
 * Shared app-level constants and presets for miniapps.
 *
 * These are common patterns used across most miniapps that would
 * otherwise be duplicated in every app's constants.ts / schemas.ts.
 */

import type { CollectionSchema } from '../schemas/registry'

// ============================================================================
// Standard RBAC Roles
// ============================================================================

/**
 * Standard 3-tier role constants used by most miniapps.
 * Apps with custom role systems (e.g., Discord's bitfield permissions)
 * should define their own.
 */
export const ROLES = {
  VIEWER: 'viewer',
  MEMBER: 'member',
  ADMIN: 'admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

// ============================================================================
// Admin Settings Schema
// ============================================================================

/**
 * Admin-only key-value settings collection.
 * Used by 9+ apps for storing app configuration.
 */
export const ADMIN_SETTINGS_SCHEMA: CollectionSchema = {
  name: 'settings',
  columns: [
    { name: 'key', storage: 'text', interpretation: 'plain' },
    { name: 'value', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

// ============================================================================
// Quick Reactions
// ============================================================================

/**
 * Default quick-reaction emoji set used by messaging apps.
 */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'] as const

// ============================================================================
// Presence Defaults
// ============================================================================

/**
 * Default presence timeout/interval constants.
 * These match the defaults in usePresence() — exported so apps
 * can reference them without hardcoding magic numbers.
 */
export const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
export const PRESENCE_UPDATE_INTERVAL_MS = 60 * 1000 // 1 minute
