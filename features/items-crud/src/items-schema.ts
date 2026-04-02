/**
 * Items Feature - Schema
 * 
 * A simple collection with ownership demonstrating:
 * - ownerField for 'own' permission checks
 * - userBound fields that auto-populate with current user ID
 * - Basic CRUD with role-based permissions
 */

import type { CollectionSchema } from 'deepspace/worker'

export const itemsSchema: CollectionSchema = {
  name: 'items',
  fields: {
    title: { type: 'string', required: true },
    description: { type: 'string' },
    status: { type: 'string', default: 'active' },
    ownerId: { type: 'string', required: true, userBound: true, immutable: true },
  },
  ownerField: 'ownerId', // Used for 'own' permission checks
  permissions: {
    viewer: { 
      read: true,  // Can see all items
      create: false, 
      update: false, 
      delete: false,
    },
    member: { 
      read: true, 
      create: true, 
      update: 'own',  // Can only update own items
      delete: 'own',  // Can only delete own items
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
