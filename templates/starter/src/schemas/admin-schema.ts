/**
 * Admin Feature - Schema
 *
 * Admin-only settings collection for key-value app configuration.
 */

import type { CollectionSchema } from '@deepspace/sdk-worker'

export const settingsSchema: CollectionSchema = {
  name: 'settings',
  fields: {
    key: { type: 'string', required: true },
    value: { type: 'string', required: true },
  },
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
