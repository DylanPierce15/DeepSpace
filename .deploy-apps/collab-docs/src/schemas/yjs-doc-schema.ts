/**
 * Yjs Document Feature - Schema
 *
 * A document collection with a Yjs collaborative content field.
 * The 'content' field uses type: 'yjs' which stores a Y.Doc on the
 * server and syncs character-level edits across all connected clients.
 */

import type { CollectionSchema } from 'deepspace/worker'

export const yjsDocSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain' }, // Yjs collaborative content (handled by useYjsField hook)
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
      update: true, // all members can edit any document's Yjs content
      delete: 'own',
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
