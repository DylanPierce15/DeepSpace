/**
 * Messaging Schemas
 *
 * Pre-built collection schemas for messaging functionality.
 * Any miniapp can import these to add channels, messages, reactions, etc.
 *
 * @example
 * ```typescript
 * import { CHANNELS_SCHEMA, MESSAGES_SCHEMA, REACTIONS_SCHEMA, CHANNEL_MEMBERS_SCHEMA, READ_RECEIPTS_SCHEMA } from '@deepspace/sdk-worker'
 *
 * export const schemas = [usersSchema, CHANNELS_SCHEMA, MESSAGES_SCHEMA, REACTIONS_SCHEMA, CHANNEL_MEMBERS_SCHEMA, READ_RECEIPTS_SCHEMA]
 * ```
 */

import type { CollectionSchema } from './schemas'

export const CHANNELS_SCHEMA: CollectionSchema = {
  name: 'channels',
  fields: {
    name: { type: 'string', required: true },
    description: { type: 'string' },
    type: { type: 'string', required: true }, // 'public' | 'private' | 'dm'
    createdBy: { type: 'string', userBound: true, immutable: true },
    archived: { type: 'boolean', default: false },
  },
  ownerField: 'createdBy',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const MESSAGES_SCHEMA: CollectionSchema = {
  name: 'messages',
  fields: {
    channelId: { type: 'string', required: true, immutable: true },
    content: { type: 'string', required: true },
    authorId: { type: 'string', userBound: true, immutable: true },
    parentMessageId: { type: 'string' }, // for threads
    edited: { type: 'boolean', default: false },
    editedAt: { type: 'string', timestampTrigger: { field: 'edited', value: true } },
  },
  ownerField: 'authorId',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const REACTIONS_SCHEMA: CollectionSchema = {
  name: 'reactions',
  fields: {
    messageId: { type: 'string', required: true, immutable: true },
    channelId: { type: 'string', required: true, immutable: true },
    emoji: { type: 'string', required: true, immutable: true },
    userId: { type: 'string', userBound: true, immutable: true },
  },
  ownerField: 'userId',
  uniqueOn: ['messageId', 'emoji', 'userId'],
  permissions: {
    admin: { read: true, create: true, update: false, delete: true },
    member: { read: true, create: true, update: false, delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const CHANNEL_MEMBERS_SCHEMA: CollectionSchema = {
  name: 'channel-members',
  fields: {
    channelId: { type: 'string', required: true, immutable: true },
    userId: { type: 'string', userBound: true, immutable: true },
    joinedAt: { type: 'string' },
  },
  ownerField: 'userId',
  uniqueOn: ['channelId', 'userId'],
  permissions: {
    admin: { read: true, create: true, update: false, delete: true },
    member: { read: true, create: true, update: false, delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const READ_RECEIPTS_SCHEMA: CollectionSchema = {
  name: 'read-receipts',
  fields: {
    channelId: { type: 'string', required: true, immutable: true },
    userId: { type: 'string', userBound: true, immutable: true },
    lastReadAt: { type: 'string', required: true },
  },
  ownerField: 'userId',
  uniqueOn: ['channelId', 'userId'],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: false, create: false, update: false, delete: false },
  },
}
