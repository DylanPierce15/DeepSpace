/**
 * Collection Schemas — single source of truth for all collections.
 */

import type { CollectionSchema } from 'deepspace/worker'
import { USERS_COLUMNS } from 'deepspace/worker'
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

const projectsSchema: CollectionSchema = {
  name: 'projects',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'bpm', storage: 'number', interpretation: 'plain', required: true },
    { name: 'timeSignature', storage: 'text', interpretation: 'plain', required: true },
    { name: 'tracks', storage: 'text', interpretation: 'plain', required: true },
    { name: 'visibility', storage: 'text', interpretation: 'plain', required: true },
    { name: 'publishedUrl', storage: 'text', interpretation: 'plain' },
    { name: 'remixedFrom', storage: 'text', interpretation: 'plain' },
    { name: 'updatedAt', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: 'own', create: true, update: 'own', delete: 'own' },
    viewer: { read: false, create: false, update: false, delete: false },
  },
}

const publishedProjectsSchema: CollectionSchema = {
  name: 'published-projects',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'authorId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'authorName', storage: 'text', interpretation: 'plain' },
    { name: 'authorImageUrl', storage: 'text', interpretation: 'plain' },
    { name: 'authorUsername', storage: 'text', interpretation: 'plain' },
    { name: 'bpm', storage: 'number', interpretation: 'plain', required: true },
    { name: 'publishedUrl', storage: 'text', interpretation: 'plain', required: true },
    { name: 'tracks', storage: 'text', interpretation: 'plain', required: true },
    { name: 'coverImageUrl', storage: 'text', interpretation: 'plain' },
    { name: 'genre', storage: 'text', interpretation: 'plain' },
    { name: 'tags', storage: 'text', interpretation: 'plain' },
    { name: 'remixedFrom', storage: 'text', interpretation: 'plain' },
    { name: 'publishedAt', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'authorId',
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

const trackReactionsSchema: CollectionSchema = {
  name: 'track-reactions',
  columns: [
    { name: 'projectId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'reactionType', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: false, delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

const trackCommentsSchema: CollectionSchema = {
  name: 'track-comments',
  columns: [
    { name: 'projectId',       storage: 'text', interpretation: 'plain', required: true },
    { name: 'text',            storage: 'text', interpretation: 'plain', required: true },
    { name: 'authorName',      storage: 'text', interpretation: 'plain' },
    { name: 'authorImageUrl',  storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

const producerFollowsSchema: CollectionSchema = {
  name: 'producer-follows',
  columns: [
    { name: 'followingId', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    admin: { read: true, create: true, update: true, delete: true },
    member: { read: true, create: true, update: false, delete: 'own' },
    viewer: { read: true, create: false, update: false, delete: false },
  },
}

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  projectsSchema,
  publishedProjectsSchema,
  trackReactionsSchema,
  trackCommentsSchema,
  producerFollowsSchema,
]
