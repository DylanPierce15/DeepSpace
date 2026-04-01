/**
 * Collection Schemas
 *
 * Defines all collections with columns and RBAC permissions.
 * This is the SINGLE SOURCE OF TRUTH — imported by both worker and frontend.
 *
 * Roles (stored on user records):
 * - viewer: Read-only access (default for new users)
 * - member: Can create and edit own content
 * - admin: Full access (automatically assigned to global admins)
 */

import type { CollectionSchema } from '@deepspace/sdk-worker'
import { USERS_COLUMNS } from '@deepspace/sdk-worker'
import { settingsSchema } from './schemas/admin-schema'

// ============================================================================
// Users Collection (required)
// ============================================================================

const usersSchema: CollectionSchema = {
  name: 'users',
  columns: [
    ...USERS_COLUMNS,
    // Add your app-specific columns here:
    // { name: 'bio', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: {
      read: 'own',
      create: false,
      update: 'own',
      delete: false,
    },
    member: {
      read: true,
      create: false,
      update: 'own',
      delete: false,
    },
    admin: { read: true, create: false, update: true, delete: true },
  },
}

// ============================================================================
// Export all schemas
// ============================================================================

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,

  // Add feature schemas here:
  // itemsSchema,
  // ...teamsSchemas,
]
