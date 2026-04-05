/**
 * Teams Feature - Schema
 *
 * Team-based collaboration demonstrating:
 * - 'team' permission level for team-scoped access
 * - teamField for team membership checks
 * - Yjs fields for real-time collaborative editing
 */

import type { CollectionSchema } from 'deepspace/worker'

// Shared documents (anyone can see, members can create/edit)
export const sharedDocsSchema: CollectionSchema = {
  name: 'shared-docs',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain' },
    { name: 'createdById', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'createdById',
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: true, delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

// Team documents (only team members can access)
export const teamDocsSchema: CollectionSchema = {
  name: 'team-docs',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain' },
  ],
  teamField: 'teamId',
  permissions: {
    viewer: { read: 'team', create: false, update: false, delete: false },
    member: { read: 'team', create: true, update: 'team', delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

// Export both schemas as array for easy spreading
export const teamsSchemas = [sharedDocsSchema, teamDocsSchema]
