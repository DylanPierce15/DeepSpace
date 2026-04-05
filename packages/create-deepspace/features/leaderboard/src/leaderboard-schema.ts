/**
 * Leaderboard Feature - Schema
 *
 * A score-based leaderboard demonstrating:
 * - ownerField for 'own' permission checks
 * - userBound fields that auto-populate with current user ID
 * - Admin override for updating any entry
 */

import type { CollectionSchema } from 'deepspace/worker'

export const leaderboardSchema: CollectionSchema = {
  name: 'leaderboard',
  columns: [
    { name: 'playerName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'score', storage: 'number', interpretation: 'plain', required: true },
    { name: 'category', storage: 'text', interpretation: 'plain', default: 'general' },
    { name: 'playerId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true },
  ],
  ownerField: 'playerId', // Used for 'own' permission checks
  permissions: {
    viewer: {
      read: true,  // Can see the leaderboard
      create: false,
      update: false,
      delete: false,
    },
    member: {
      read: true,
      create: true,
      update: 'own',  // Can only update own scores
      delete: 'own',  // Can only delete own entries
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
