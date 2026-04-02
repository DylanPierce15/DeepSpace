/**
 * deepspace/worker — Server-side Worker Module
 *
 * Cloudflare Worker / Durable Object utilities for DeepSpace apps.
 *
 * RecordRoom: SQLite-backed record storage with RBAC
 * - Schema-driven validation and permissions
 * - Query-based WebSocket subscriptions
 * - Yjs integration for collaborative fields
 *
 * @example
 * import { RecordRoom, handleMcAPIProxy } from 'deepspace/worker'
 *
 * export { RecordRoom }
 *
 * export default {
 *   async fetch(request, env) {
 *     // ... route to Durable Object
 *   }
 * }
 */

export * from './protocol'
export * from './tools'
export * from './backup'
export * from './mcapi'
export * from './schemas'
export * from './constants'
export * from './types'
export * from './scoped-r2-files'
export * from './messaging-schemas'
export * from './conversation-schemas'
export * from './directory-schemas'
export * from './shared-do-schemas'
export * from './workspace-schemas'
export * from './app-registry'
export * from './action-types'
export * from './app-presets'
export * from './linked-ref'
export { type CronContext, buildCronContext } from './cron'
export { RecordRoom, type RecordRoomConfig } from './record-room'

// System collections and legacy storage constants
export { SYSTEM_COLLECTIONS, LEGACY_STORAGE_COLLECTION, LEGACY_STORAGE_FIELD } from './handlers/yjs'
