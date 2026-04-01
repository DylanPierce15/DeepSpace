/**
 * Collection Schemas
 *
 * Defines all collections with fields and RBAC permissions.
 * This is the SINGLE SOURCE OF TRUTH - imported by both worker and frontend.
 *
 * Roles (stored on user records):
 * - viewer: Read-only access (default for new users)
 * - member: Can create and edit own content
 * - admin: Full access (automatically assigned to global admins)
 *
 * To add features, copy schema files to src/schemas/ then import:
 *   import { settingsSchema } from './schemas/admin-schema'
 */

import type { CollectionSchema } from '@deepspace/sdk-worker'
import { USERS_COLLECTION_FIELDS } from '@deepspace/sdk-worker'
import { settingsSchema } from './schemas/admin-schema'

// ============================================================================
// Users Collection (required)
// ============================================================================

const usersSchema: CollectionSchema = {
  name: 'users',
  fields: {
    // System-managed fields (from SDK)
    ...USERS_COLLECTION_FIELDS,

    // Add your app-specific user fields here
    // bio: { type: 'string' },
    // preferences: { type: 'string' },
  },
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
