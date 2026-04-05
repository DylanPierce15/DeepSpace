/**
 * usePresence — Re-exports the SDK's built-in presence hook.
 *
 * The deepspace SDK's usePresence derives online/offline from lastSeenAt,
 * sends heartbeat pings, and periodically re-evaluates stale timestamps.
 */

export { usePresence } from 'deepspace'
