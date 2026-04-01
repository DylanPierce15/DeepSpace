import type { CollectionSchema } from '@deepspace/types'

export const schemas: CollectionSchema[] = [
  {
    name: 'users',
    fields: {
      displayName: { type: 'string' },
      avatarUrl: { type: 'string' },
      bio: { type: 'string' },
    },
    permissions: {
      viewer: { read: true, create: false, update: false, delete: false },
      member: { read: true, create: true, update: 'own', delete: false },
      admin: { read: true, create: true, update: true, delete: true },
    },
  },
]
