/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 */

import type { CollectionSchema } from 'deepspace/worker'
import {
  USERS_COLUMNS,
  ROLE_ANONYMOUS,
} from 'deepspace/worker'
import { settingsSchema } from './schemas/admin-schema'

const usersSchema: CollectionSchema = {
  name: 'users',
  columns: [...USERS_COLUMNS],
  permissions: {
    viewer: { read: 'own', create: false, update: 'own', delete: false },
    member: { read: true, create: false, update: 'own', delete: false },
    admin: { read: true, create: false, update: true, delete: true },
  },
}

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
    [ROLE_ANONYMOUS]: { read: 'published', create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
  visibilityField: { field: 'status', value: 'published' },
}

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  itemsSchema,
]
