/**
 * Storage Constants
 * 
 * Message type constants for WebSocket protocol.
 * Must match server-side constants.
 */

// Core messages
export const MSG_SUBSCRIBE = 1
export const MSG_UNSUBSCRIBE = 2
export const MSG_QUERY_RESULT = 3
export const MSG_RECORD_CHANGE = 4
export const MSG_PUT = 5
export const MSG_DELETE = 6
export const MSG_ERROR = 7

// User messages
export const MSG_USER_INFO = 8
export const MSG_USER_LIST = 9
export const MSG_SET_ROLE = 10
export const MSG_USER_UPDATE = 11

// Yjs collaborative editing messages
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

// GameRoom messages (40-59)
export const MSG_GAME_STATE = 40
export const MSG_GAME_INPUT = 41
export const MSG_GAME_PLAYER_JOIN = 42
export const MSG_GAME_PLAYER_LEAVE = 43
export const MSG_GAME_PLAYER_READY = 44
export const MSG_GAME_START = 45
export const MSG_GAME_END = 46
export const MSG_GAME_TICK = 47

// CanvasRoom messages (60-79)
export const MSG_CANVAS_SHAPES = 60
export const MSG_CANVAS_ADD = 61
export const MSG_CANVAS_MOVE = 62
export const MSG_CANVAS_RESIZE = 63
export const MSG_CANVAS_DELETE = 64
export const MSG_CANVAS_UPDATE = 65
export const MSG_CANVAS_VIEWPORT = 66
export const MSG_CANVAS_UNDO = 67
export const MSG_CANVAS_REDO = 68

// MediaRoom messages (80-99)
export const MSG_MEDIA_JOIN = 80
export const MSG_MEDIA_LEAVE = 81
export const MSG_MEDIA_OFFER = 82
export const MSG_MEDIA_ANSWER = 83
export const MSG_MEDIA_ICE_CANDIDATE = 84
export const MSG_MEDIA_PEERS = 85

// CronRoom messages (120-139)
export const MSG_CRON_TASKS = 120
export const MSG_CRON_HISTORY = 121
export const MSG_CRON_TRIGGER = 122
export const MSG_CRON_PAUSE = 123
export const MSG_CRON_RESUME = 124
export const MSG_CRON_STATUS = 125

// Gateway multiplexing (single-WS architecture)
export const MSG_GW_SCOPE_CONNECT = 100
export const MSG_GW_SCOPE_DISCONNECT = 101
export const MSG_GW_SCOPE_ERROR = 103
export const MSG_GW_TOKEN_REFRESH = 104
export const MSG_GW_USER_UPDATE = 105
