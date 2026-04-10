/**
 * deepspace/worker — DeepSpace Worker SDK
 *
 * Everything for Cloudflare Workers: RecordRoom, schemas, auth verification.
 *
 * import { RecordRoom, verifyJwt, CHANNELS_SCHEMA } from 'deepspace/worker'
 */
export * from './server/rooms'
export * from './server/schemas'
export * from './shared/protocol'
export * from './shared/safe-response'
export * from './server/utils'
export * from './server/auth'
export { SYSTEM_COLLECTIONS, LEGACY_STORAGE_COLLECTION, LEGACY_STORAGE_FIELD } from './server/handlers/yjs'
