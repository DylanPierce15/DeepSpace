/**
 * Messaging Schemas
 *
 * Import and spread into your app's schemas array to enable channels and messaging.
 */

import {
  CHANNELS_SCHEMA,
  MESSAGES_SCHEMA,
  REACTIONS_SCHEMA,
  CHANNEL_MEMBERS_SCHEMA,
  READ_RECEIPTS_SCHEMA,
} from 'deepspace/worker'

export const messagingSchemas = [
  CHANNELS_SCHEMA,
  MESSAGES_SCHEMA,
  REACTIONS_SCHEMA,
  CHANNEL_MEMBERS_SCHEMA,
  READ_RECEIPTS_SCHEMA,
]
