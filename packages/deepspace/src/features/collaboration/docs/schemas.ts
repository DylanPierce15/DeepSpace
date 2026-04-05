/**
 * Docs Feature - Schema
 *
 * A document collection with a Yjs collaborative content field.
 * The 'content' field uses Yjs for storing a Y.Doc on the
 * server and syncing character-level edits across all connected clients.
 */

import type { CollectionSchema } from '@/shared/types'

export const docsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain' },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'ownerId',
  permissions: {
    viewer: {
      read: true,
      create: false,
      update: false,
      delete: false,
    },
    member: {
      read: true,
      create: true,
      update: true,
      delete: 'own',
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
