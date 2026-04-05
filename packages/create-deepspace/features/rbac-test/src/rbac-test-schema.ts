/**
 * RBAC Test Feature - Schemas
 *
 * Multiple collections that exercise every RBAC permission pattern:
 * - Collection-level deny (viewer can't create/update/delete)
 * - 'own' permission (member can only edit/delete own records)
 * - writableFields (member can only update specific fields)
 * - immutable fields (cannot change after creation)
 * - userBound fields (auto-set to current user)
 * - 'unclaimed-or-own' (claiming pattern)
 * - 'team' permission (team-scoped access)
 * - Admin-only collection (viewer/member fully denied)
 */

import type { CollectionSchema } from 'deepspace/worker'

/**
 * Notes collection — demonstrates ownership + writableFields
 *
 * - viewer: read-only
 * - member: create, edit own (title + body only), delete own
 * - admin: full access
 */
export const rbacNotesSchema: CollectionSchema = {
  name: 'rbac-notes',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'body', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'category', storage: 'text', interpretation: 'plain', default: 'general' },
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
      update: 'own',
      delete: 'own',
      // Can only update title and body — NOT category
      writableFields: ['title', 'body'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

/**
 * Bounties collection — demonstrates unclaimed-or-own claiming
 *
 * - viewer: read-only
 * - member: can claim unclaimed bounties, edit own claimed, writable fields restricted
 * - admin: full access
 */
export const rbacBountiesSchema: CollectionSchema = {
  name: 'rbac-bounties',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'reward', storage: 'number', interpretation: 'plain', default: 10 },
    { name: 'claimedById', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: 'plain', default: 'open' },
    { name: 'submission', storage: 'text', interpretation: 'plain' },
    { name: 'createdById', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'claimedById',
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
      update: 'unclaimed-or-own',
      delete: 'own',
      writableFields: ['claimedById', 'status', 'submission'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

/**
 * Team posts collection — demonstrates team-scoped permissions
 *
 * - viewer: can only read posts from own team
 * - member: can read + create + update own team's posts
 * - admin: full access
 */
export const rbacTeamPostsSchema: CollectionSchema = {
  name: 'rbac-team-posts',
  columns: [
    { name: 'teamId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'authorId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  teamField: 'teamId',
  permissions: {
    viewer: {
      read: 'team',
      create: false,
      update: false,
      delete: false,
    },
    member: {
      read: 'team',
      create: true,
      update: 'team',
      delete: false,
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

/**
 * Secrets collection — admin-only, completely locked for non-admins
 */
export const rbacSecretsSchema: CollectionSchema = {
  name: 'rbac-secrets',
  columns: [
    { name: 'key', storage: 'text', interpretation: 'plain', required: true },
    { name: 'value', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}

/** All RBAC test schemas as an array for easy spreading */
export const rbacTestSchemas = [
  rbacNotesSchema,
  rbacBountiesSchema,
  rbacTeamPostsSchema,
  rbacSecretsSchema,
]
