/**
 * Messaging Schemas
 *
 * Pre-built collection schemas for messaging functionality.
 * Any app can import these to add channels, messages, reactions, etc.
 *
 * @example
 * ```typescript
 * import { CHANNELS_SCHEMA, MESSAGES_SCHEMA, REACTIONS_SCHEMA } from '@deepspace/sdk-worker'
 * export const schemas = [usersSchema, CHANNELS_SCHEMA, MESSAGES_SCHEMA, REACTIONS_SCHEMA]
 * ```
 */

import type { CollectionSchema } from './schemas'

export const CHANNELS_SCHEMA: CollectionSchema = {
  name: 'channels',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain' },
    { name: 'description', storage: 'text', interpretation: 'plain' },
    { name: 'type', storage: 'text', interpretation: { kind: 'select', options: ['public', 'private', 'dm'] } },
    { name: 'createdBy', storage: 'text', interpretation: 'plain' },
    { name: 'archived', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  ownerField: 'createdBy',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: false },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const MESSAGES_SCHEMA: CollectionSchema = {
  name: 'messages',
  columns: [
    { name: 'channelId', storage: 'text', interpretation: 'plain' },
    { name: 'content', storage: 'text', interpretation: 'plain' },
    { name: 'authorId', storage: 'text', interpretation: 'plain' },
    { name: 'parentMessageId', storage: 'text', interpretation: 'plain' },
    { name: 'edited', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'editedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  ownerField: 'authorId',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const REACTIONS_SCHEMA: CollectionSchema = {
  name: 'reactions',
  columns: [
    { name: 'messageId', storage: 'text', interpretation: 'plain' },
    { name: 'channelId', storage: 'text', interpretation: 'plain' },
    { name: 'emoji', storage: 'text', interpretation: 'plain' },
    { name: 'userId', storage: 'text', interpretation: 'plain' },
  ],
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
  columns: [
    { name: 'channelId', storage: 'text', interpretation: 'plain' },
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'joinedAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
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
  columns: [
    { name: 'channelId', storage: 'text', interpretation: 'plain' },
    { name: 'userId', storage: 'text', interpretation: 'plain' },
    { name: 'lastReadAt', storage: 'text', interpretation: { kind: 'datetime' } },
  ],
  ownerField: 'userId',
  uniqueOn: ['channelId', 'userId'],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: false, create: false, update: false, delete: false },
  },
}
