/**
 * Collection Schemas
 *
 * Defines all collections with columns and RBAC permissions.
 * This is the SINGLE SOURCE OF TRUTH — imported by both worker and frontend.
 *
 * Roles:
 * - anonymous: Unauthenticated users (read-only public data)
 * - viewer: Authenticated but read-only
 * - member: Can create and edit own content
 * - admin: Full access
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
  ],
  permissions: {
    viewer: { read: 'own', create: false, update: 'own', delete: false },
    member: { read: true, create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}

// ============================================================================
// Items Collection — demonstrates RBAC
// ============================================================================

const itemsSchema: CollectionSchema = {
  name: 'items',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'description', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: { kind: 'select', options: ['draft', 'published', 'archived'] } },
    { name: 'createdBy', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'createdBy',
  permissions: {
    // Anonymous: can read published items only
    anonymous: { read: 'published', create: false, update: false, delete: false },
    // Viewers: can read all items
    viewer: { read: true, create: false, update: false, delete: false },
    // Members: full CRUD on own items
    member: { read: true, create: true, update: 'own', delete: 'own' },
    // Admins: full access
    admin: { read: true, create: true, update: true, delete: true },
  },
  visibilityField: { field: 'status', value: 'published' },
}

// ============================================================================
// Export all schemas
// ============================================================================

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  itemsSchema,
]
