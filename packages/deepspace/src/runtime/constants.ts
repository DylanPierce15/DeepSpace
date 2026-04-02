/**
 * Message type constants for RecordRoom protocol
 */

// Core CRUD operations
export const MSG_SUBSCRIBE = 1
export const MSG_UNSUBSCRIBE = 2
export const MSG_QUERY_RESULT = 3
export const MSG_RECORD_CHANGE = 4
export const MSG_PUT = 5
export const MSG_DELETE = 6
export const MSG_ERROR = 7

// User management
export const MSG_USER_INFO = 8
export const MSG_USER_LIST = 9
export const MSG_SET_ROLE = 10
export const MSG_USER_UPDATE = 11

// Yjs collaborative editing
export const MSG_YJS_JOIN = 20
export const MSG_YJS_LEAVE = 21
export const MSG_YJS_SYNC = 22
export const MSG_YJS_AWARENESS = 23

// Mutation acknowledgement
export const MSG_ACK = 31

// Schema discovery
export const MSG_LIST_SCHEMAS = 32

// Team membership change — tells client to re-subscribe all active queries
export const MSG_RESUBSCRIBE = 33

// Built-in role names
/** Role assigned to unauthenticated WebSocket connections */
export const ROLE_ANONYMOUS = 'viewer'
/** Default role for newly registered authenticated users */
export const ROLE_DEFAULT = 'member'
/** Admin role */
export const ROLE_ADMIN = 'admin'

// Gateway multiplexing (single-WS architecture)
export const MSG_GW_SCOPE_CONNECT = 100
export const MSG_GW_SCOPE_DISCONNECT = 101
export const MSG_GW_SCOPE_ERROR = 103
export const MSG_GW_TOKEN_REFRESH = 104
export const MSG_GW_USER_UPDATE = 105
