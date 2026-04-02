import type { CollectionSchema } from '@deepspace/types'

export const schemas: CollectionSchema[] = [
  {
    name: 'users',
    fields: {
      Name: { type: 'string' },
      Email: { type: 'string' },
      ImageUrl: { type: 'string' },
    },
    permissions: {
      viewer: { read: true, create: false, update: false, delete: false },
      member: { read: true, create: true, update: 'own', delete: 'own' },
      admin: { read: true, create: true, update: true, delete: true },
    },
  },
  {
    name: 'todos',
    fields: {
      Title: { type: 'string', required: true },
      Done: { type: 'boolean' },
      AssignedTo: { type: 'string' },
      Priority: { type: 'string' },
    },
    permissions: {
      viewer: { read: true, create: false, update: false, delete: false },
      member: { read: true, create: true, update: 'own', delete: 'own' },
      admin: { read: true, create: true, update: true, delete: true },
    },
  },
]
