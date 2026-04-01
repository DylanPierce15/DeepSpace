/**
 * RecordRoom Durable Object
 * 
 * SQLite-based storage with query-based real-time subscriptions.
 * 
 * Architecture:
 * - Data stored in SQLite (single `records` table)
 * - Clients subscribe to QUERIES, not collections
 * - On record change, server evaluates which subscriptions match
 * - Only matching subscribers receive updates
 * 
 * Protocol:
 * - SUBSCRIBE { subscriptionId, query } → QUERY_RESULT { subscriptionId, records }
 * - UNSUBSCRIBE { subscriptionId }
 * - PUT { collection, recordId, data } → broadcasts RECORD_CHANGE to matching
 * - DELETE { collection, recordId } → broadcasts RECORD_CHANGE to matching
 */

/// <reference types="@cloudflare/workers-types" />

import * as Y from 'yjs'
import type {
  ConnectionAttachment,
  YjsDocKey,
  SubscribePayload,
  UnsubscribePayload,
  PutPayload,
  DeletePayload,
  SetRolePayload,
  YjsJoinPayload,
  YjsLeavePayload,
} from './types'
import {
  MSG_SUBSCRIBE,
  MSG_UNSUBSCRIBE,
  MSG_PUT,
  MSG_DELETE,
  MSG_ERROR,
  MSG_USER_INFO,
  MSG_USER_LIST,
  MSG_USER_UPDATE,
  MSG_SET_ROLE,
  MSG_YJS_JOIN,
  MSG_YJS_LEAVE,
  MSG_REGISTER_SCHEMAS,
  MSG_LIST_SCHEMAS,
} from './constants'
import {
  type CollectionSchema,
  type PermissionContext,
  SchemaRegistry,
  BASE_USERS_SCHEMA,
  resolveColumn,
  collectionTableName,
  columnId,
  dataToColumnValues,
} from './schemas'
// User DOs removed — schemas are baked in at deploy time
import {
  handleSubscribe,
  handleUnsubscribe,
  handlePut,
  handleDelete,
  handleUserList,
  handleUserUpdate,
  handleSetRole,
  registerUser,
  handleYjsJoin,
  handleYjsLeave,
  handleYjsBinaryMessage,
  handleApiRequest,
} from './handlers'
import { SYSTEM_COLLECTION_SCHEMAS, broadcastAwarenessRemoval } from './handlers/yjs'
import { getGlobalDOSchemas, GLOBAL_DO_TYPE_NAMES } from './shared-do-schemas'

/**
 * RecordRoom configuration options
 */
export interface RecordRoomConfig {
  /** 
   * Default role for new users who don't have a role in user-roles collection.
   * Defaults to 'member'.
   */
  defaultRole?: string
  /**
   * User ID of the app owner.
   * This user automatically gets 'admin' role on connect.
   */
  ownerUserId?: string
}

/**
 * RecordRoom Durable Object
 */
export class RecordRoom {
  private state: DurableObjectState
  private env: { [key: string]: unknown }
  private schemaRegistry: SchemaRegistry
  private sql: SqlStorage
  private initPromise: Promise<void> | null = null
  /** Yjs docs loaded in memory (key: collection:recordId:fieldName) */
  private yjsDocs: Map<YjsDocKey, Y.Doc> = new Map()
  /** Next Yjs client ID counter */
  private nextYjsClientId = 1
  /** Default role for new users */
  private defaultRole: string
  /** Owner user ID — gets admin role automatically */
  private ownerUserId: string | null
  /** True until the first fetch() completes — detects hibernation wake-up */
  private freshConstruct = true

  constructor(
    state: DurableObjectState,
    env: unknown,
    schemas: CollectionSchema[] = [],
    config: RecordRoomConfig = {}
  ) {
    this.state = state
    this.env = (env ?? {}) as { [key: string]: unknown }
    this.sql = state.storage.sql
    this.schemaRegistry = new SchemaRegistry([...SYSTEM_COLLECTION_SCHEMAS, BASE_USERS_SCHEMA, ...schemas])
    const usersSchemaDefaultRole = schemas.find(s => s.name === 'users')?.defaultRole
    this.defaultRole = config.defaultRole ?? usersSchemaDefaultRole ?? 'member'
    this.ownerUserId = config.ownerUserId ?? null

    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    )

    // Log hibernation wake-up (WebSockets preserved but memory cleared)
    const wsCount = this.state.getWebSockets().length
    if (wsCount > 0) {
      console.log('[DO] Woke from hibernation:', wsCount, 'connections')
    }
  }

  // ============================================================================
  // Permission Context
  // ============================================================================

  /**
   * Create permission context for checking team membership.
   *
   * Team membership is stored in the c_team_members collection table
   * within workspace:default. Only DOs with a team_members collection
   * schema (i.e. workspace DOs) support teamField RBAC.
   */
  private getPermissionContext(): PermissionContext {
    const teamMembersSchema = this.schemaRegistry.get('team_members')
    const hasTeamMembers = !!teamMembersSchema?.columns?.length

    return {
      isTeamMember: (teamId: string, userId: string): boolean => {
        if (!hasTeamMembers) return false
        const cursor = this.sql.exec(
          `SELECT 1 FROM c_team_members WHERE col_teamid = ? AND col_userid = ? AND (col_status = 'active' OR col_status IS NULL) LIMIT 1`,
          teamId, userId
        )
        return cursor.toArray().length > 0
      },
    }
  }

  // ============================================================================
  // HTTP Entry Point
  // ============================================================================

  /**
   * Ensure database is initialized exactly once.
   * Uses cached promise to prevent race conditions on hibernation wake-up.
   */
  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initializeDatabase()
    }
    return this.initPromise
  }

  async fetch(request: Request): Promise<Response> {
    const fetchStart = Date.now()
    const isColdStart = this.freshConstruct
    const needsInit = !this.initPromise
    this.freshConstruct = false

    await this.ensureInitialized()
    const initMs = Date.now() - fetchStart

    const url = new URL(request.url)

    // Push schemas endpoint (called by platform worker after schema upload)
    if (url.pathname === '/api/push-schemas' && request.method === 'POST') {
      const schemas = await request.json() as CollectionSchema[]
      this.persistSchemas(schemas)
      return Response.json({ success: true, count: schemas.length })
    }

    // HTTP API endpoints (tools, debug, etc.)
    if (url.pathname.startsWith('/api/')) {
      const scopeId = url.searchParams.get('scopeId') ?? ''
      const scopePrefix = scopeId.split(':')[0]
      await this.loadSchemasForScope(scopePrefix)
      return handleApiRequest(this.createHandlerContext(), request, url)
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, url, { fetchStart, isColdStart, needsInit, initMs })
    }

    return new Response('Not Found', { status: 404 })
  }

  // ============================================================================
  // Database
  // ============================================================================

  private async initializeDatabase(): Promise<void> {
    // Core infrastructure tables (yjs docs and runtime schema persistence)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS yjs_docs (
        doc_key TEXT PRIMARY KEY,
        state BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_schemas (
        name TEXT PRIMARY KEY,
        schema TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

    `)

    // Load persisted runtime schemas (survives hibernation)
    this.loadRuntimeSchemas()

    // Create SQL tables for all collections (table-mode)
    this.ensureAllCollectionTables()

    // Migrate legacy data from old storage formats
    await this.migrateUsersTableIfExists()
    await this.migrateRecordsTable()
  }

  /**
   * One-time migration: move users from old `users` table to c_users.
   * Safe to call multiple times - checks if migration is needed.
   */
  private async migrateUsersTableIfExists(): Promise<void> {
    try {
      // Check if old users table exists
      const tableCheck = this.sql.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`
      )
      if (tableCheck.toArray().length === 0) {
        return // No old table, nothing to migrate
      }

      // Get users from old table
      const oldUsers = this.sql.exec(`SELECT * FROM users`).toArray()
      if (oldUsers.length === 0) {
        this.sql.exec(`DROP TABLE IF EXISTS users`)
        return
      }

      const now = new Date().toISOString()
      for (const row of oldUsers) {
        const r = row as { user_id: string; email: string; name: string; image_url?: string; role: string; created_at: string; last_seen_at: string }

        // Check if already migrated to c_users
        const existing = this.sql.exec(
          `SELECT 1 FROM c_users WHERE _row_id = ?`, r.user_id
        ).toArray()
        if (existing.length > 0) continue

        this.sql.exec(
          `INSERT INTO c_users (_row_id, _created_by, _created_at, _updated_at, col_email, col_name, col_imageurl, col_role, col_createdat, col_lastseenat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          r.user_id, r.user_id, r.created_at, now,
          r.email, r.name, r.image_url || null, r.role, r.created_at, r.last_seen_at
        )
      }

      this.sql.exec(`DROP TABLE IF EXISTS users`)
    } catch (error) {
      console.error(`[RecordRoom] Users table migration error:`, error)
    }
  }

  /**
   * One-time migration: move all rows from the document-mode `records` table
   * into their respective `c_*` collection tables. Idempotent — skips rows
   * that already exist in the target table.
   */
  private async migrateRecordsTable(): Promise<void> {
    try {
      // Check if records table exists (new DOs won't have it)
      const tableCheck = this.sql.exec(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='records'`
      )
      if (tableCheck.toArray().length === 0) return

      const rows = this.sql.exec(`SELECT * FROM records`).toArray()
      if (rows.length === 0) {
        this.sql.exec(`DROP TABLE IF EXISTS records`)
        return
      }

      let migrated = 0
      let skipped = 0
      const now = new Date().toISOString()

      for (const row of rows) {
        const r = row as { collection: string; record_id: string; data: string; created_by: string; created_at: string; updated_at: string }
        const schema = this.schemaRegistry.get(r.collection)

        if (!schema || !schema.columns) {
          skipped++
          continue
        }

        const tbl = collectionTableName(r.collection)

        // Check if target table exists
        const tblExists = this.sql.exec(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tbl
        ).toArray().length > 0
        if (!tblExists) {
          this.ensureCollectionTable(schema)
        }

        // Skip if already migrated
        const existing = this.sql.exec(
          `SELECT 1 FROM "${tbl}" WHERE _row_id = ?`, r.record_id
        ).toArray()
        if (existing.length > 0) {
          skipped++
          continue
        }

        // Parse JSON data and convert to column values
        let data: Record<string, unknown>
        try {
          data = JSON.parse(r.data) as Record<string, unknown>
        } catch {
          skipped++
          continue
        }

        const columns = schema.columns.map(resolveColumn)
        const colValues = dataToColumnValues(data, columns)

        const colIds = Object.keys(colValues)
        const allCols = ['_row_id', '_created_by', '_created_at', '_updated_at', ...colIds.map(c => `"${c}"`)]
        const placeholders = allCols.map(() => '?').join(', ')
        const params = [r.record_id, r.created_by, r.created_at, r.updated_at, ...colIds.map(c => colValues[c])]

        this.sql.exec(
          `INSERT INTO "${tbl}" (${allCols.join(', ')}) VALUES (${placeholders})`,
          ...params
        )
        migrated++
      }

      if (migrated > 0 || skipped > 0) {
        console.log(`[RecordRoom] Migrated ${migrated} records from document-mode, ${skipped} skipped`)
      }

      // Drop the old records table and its indexes
      this.sql.exec(`DROP TABLE IF EXISTS records`)
    } catch (error) {
      console.error(`[RecordRoom] Records table migration error:`, error)
      // Don't fail startup — next restart will retry
    }
  }

  // ============================================================================
  // Table-Mode Schema Management
  // ============================================================================

  /**
   * Ensure a SQL table exists for a table-mode collection (one with `columns`).
   * Creates the table if missing; adds any new columns via ALTER TABLE.
   * Idempotent — safe to call on every schema registration.
   */
  private ensureCollectionTable(schema: CollectionSchema): void {
    if (!schema.columns) return

    const tbl = collectionTableName(schema.name)
    const resolved = schema.columns.map(resolveColumn)

    const tableExists = this.sql.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, tbl
    ).toArray().length > 0

    if (!tableExists) {
      const storageCols = resolved
        .filter(c => !c.expression)
        .map(c => `"${c.id}" ${c.storage === 'number' ? 'REAL' : 'TEXT'}`)
        .join(', ')

      const colClause = storageCols ? `, ${storageCols}` : ''
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS "${tbl}" (
          _row_id TEXT PRIMARY KEY,
          _created_by TEXT NOT NULL,
          _created_at TEXT NOT NULL,
          _updated_at TEXT NOT NULL${colClause}
        )
      `)
    } else {
      // Table exists — check for new columns to add
      const existingCols = new Set<string>()
      const pragmaRows = this.sql.exec(`PRAGMA table_info("${tbl}")`).toArray()
      for (const row of pragmaRows) {
        existingCols.add((row as { name: string }).name)
      }

      for (const col of resolved) {
        if (col.expression) continue
        if (!existingCols.has(col.id)) {
          const sqlType = col.storage === 'number' ? 'REAL' : 'TEXT'
          this.sql.exec(`ALTER TABLE "${tbl}" ADD COLUMN "${col.id}" ${sqlType}`)
        }
      }
    }

    // Create UNIQUE index for uniqueOn constraint.
    // Wrapped in try/catch because existing data may have duplicates that
    // violate the constraint — the index will be created once duplicates are cleaned up.
    if (schema.uniqueOn && schema.uniqueOn.length > 0) {
      const uniqueCols = schema.uniqueOn.map(fieldName => {
        const col = resolved.find(c => c.name === fieldName)
        return col ? `"${col.id}"` : `"${columnId(fieldName)}"`
      })
      const indexName = `uniq_${tbl}_${schema.uniqueOn.join('_').replace(/[^a-zA-Z0-9_]/g, '_')}`
      try {
        this.sql.exec(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${indexName}" ON "${tbl}" (${uniqueCols.join(', ')})`
        )
      } catch (e) {
        // Existing data has duplicates — log but don't fail startup
        console.warn(`[RecordRoom] Cannot create UNIQUE index on ${tbl} (${schema.uniqueOn.join(', ')}): ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  /**
   * Ensure all table-mode schemas have their SQL tables created.
   */
  private ensureAllCollectionTables(): void {
    for (const schema of this.schemaRegistry.all()) {
      this.ensureCollectionTable(schema)
    }
  }

  // ============================================================================
  // Three-Tier Schema Loading
  // ============================================================================

  /**
   * Load schemas based on scope type:
   * - Global DOs (workspace, conv, dir): Baked into code, zero I/O
   * - App DOs (app:{appId}): Pushed by platform worker, persisted in runtime_schemas
   * - User DOs (user:{userId}): Fetched from R2 on every wake (~100ms)
   */
  private async loadSchemasForScope(scopePrefix: string): Promise<void> {
    // Tier 1: Global DOs — schemas baked into code
    if (GLOBAL_DO_TYPE_NAMES.includes(scopePrefix)) {
      this.loadGlobalSchemas(scopePrefix)
      return
    }
    // Tier 2: App DOs — schemas pushed by platform worker, in runtime_schemas.
    // Already loaded by loadRuntimeSchemas() in initializeDatabase().
    if (scopePrefix === 'app') {
      return
    }
    // User DOs removed from the SDK — only app, conv, dir, workspace scopes
  }

  /**
   * Load baked-in schemas for a specific global DO type.
   * Always overwrites persisted runtime_schemas with code-level schemas
   * so that deploys take effect without waiting for DO hibernation.
   */
  private globalSchemasLoaded = false
  private loadGlobalSchemas(scopePrefix: string): void {
    if (this.globalSchemasLoaded) return
    this.globalSchemasLoaded = true
    const schemas = getGlobalDOSchemas(scopePrefix)
    if (schemas.length === 0) return
    this.persistSchemas(schemas)
  }


  /**
   * Register schemas as trusted and persist to runtime_schemas SQLite.
   * Shared by push-schemas endpoint and R2 fetch.
   */
  private persistSchemas(schemas: CollectionSchema[]): void {
    const now = new Date().toISOString()
    for (const schema of schemas) {
      if (!schema.name) continue
      this.schemaRegistry.registerTrusted(schema)
      this.sql.exec(
        `INSERT OR REPLACE INTO runtime_schemas (name, schema, created_at) VALUES (?, ?, ?)`,
        schema.name, JSON.stringify(schema), now
      )
      this.ensureCollectionTable(schema)
      if (schema.name === 'users' && schema.defaultRole) {
        this.defaultRole = schema.defaultRole
      }
    }
  }

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  private async handleWebSocket(
    request: Request,
    url: URL,
    timing: { fetchStart: number; isColdStart: boolean; needsInit: boolean; initMs: number },
  ): Promise<Response> {
    const userId = url.searchParams.get('userId')
    const userName = url.searchParams.get('userName') || 'Anonymous'
    const userEmail = url.searchParams.get('userEmail') || ''
    const userImageUrl = url.searchParams.get('userImageUrl') || undefined
    const isAdmin = url.searchParams.get('isAdmin') === 'true'
    const isCanvasOwner = url.searchParams.get('isCanvasOwner') === 'true'
    const scopeId = url.pathname.replace(/^\/ws\//, '')
    const scopePrefix = scopeId.split(':')[0]

    const schemaStart = Date.now()
    await this.loadSchemasForScope(scopePrefix)
    const schemaMs = Date.now() - schemaStart

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.state.acceptWebSocket(server)

    let attachment: ConnectionAttachment

    if (userId) {
      // Authenticated user — register and derive role
      const isOwner = isCanvasOwner || (this.ownerUserId != null && userId === this.ownerUserId)
      const regStart = Date.now()
      const user = await registerUser(this.sql, userId, userName, userEmail, userImageUrl, isAdmin || isOwner, this.defaultRole, this.schemaRegistry)
      const regMs = Date.now() - regStart

      attachment = {
        userId: user.id,
        role: user.role,
        subscriptions: [],
        yjsSubscriptions: [],
        yjsClientId: this.nextYjsClientId++,
      }

      this.send(server, { type: MSG_USER_INFO, payload: user })

      const totalMs = Date.now() - timing.fetchStart
      console.log(`[DO Perf] ${scopeId} | cold=${timing.isColdStart} | init: ${timing.initMs}ms schema: ${schemaMs}ms reg: ${regMs}ms | total: ${totalMs}ms`)
    } else {
      // Anonymous user — read-only viewer, not persisted
      const anonId = `anon-${crypto.randomUUID()}`
      attachment = {
        userId: anonId,
        role: 'viewer',
        subscriptions: [],
        yjsSubscriptions: [],
        yjsClientId: this.nextYjsClientId++,
      }

      this.send(server, { type: MSG_USER_INFO, payload: {
        id: anonId,
        name: 'Anonymous',
        email: '',
        role: 'viewer',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      }})

      const totalMs = Date.now() - timing.fetchStart
      console.log(`[DO Perf] ${scopeId} | cold=${timing.isColdStart} anon | schema: ${schemaMs}ms | total: ${totalMs}ms`)
    }

    server.serializeAttachment(attachment)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    await this.ensureInitialized()

    // Get connection info from attachment (survives hibernation)
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null
    if (!attachment) {
      this.send(ws, { type: MSG_ERROR, payload: { error: 'Connection not found' } })
      return
    }

    // Handle binary messages (Yjs sync)
    if (message instanceof ArrayBuffer) {
      try {
        await handleYjsBinaryMessage(
          this.createYjsContext(),
          ws,
          attachment,
          new Uint8Array(message)
        )
      } catch (e) {
        console.error('[RecordRoom] Yjs binary message error:', e)
      }
      return
    }

    // Handle JSON messages
    try {
      const msg = JSON.parse(message)
      await this.handleMessage(ws, attachment, msg)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const msgPreview = typeof message === 'string' ? message.slice(0, 200) : '(non-string)'
      console.error(`[RecordRoom] Message handler error: ${errMsg}`, { message: msgPreview })
      this.send(ws, { type: MSG_ERROR, payload: { error: `Invalid message: ${errMsg}` } })
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    console.log(`[RecordRoom] webSocketClose code=${code} reason=${reason}`)
    // Broadcast awareness removal so other clients drop this user's cursor
    try {
      const attachment = ws.deserializeAttachment() as ConnectionAttachment | null
      if (attachment) {
        broadcastAwarenessRemoval(this.createYjsContext(), attachment)
      }
    } catch { /* best-effort */ }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error(`[RecordRoom] webSocketError:`, error)
  }

  // ============================================================================
  // Message Routing
  // ============================================================================

  private async handleMessage(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    msg: { type: number; payload: unknown }
  ): Promise<void> {
    const { type, payload } = msg
    const ctx = this.createHandlerContext()
    const recordCtx = this.createRecordContext()
    const userCtx = this.createUserContext()
    const yjsCtx = this.createYjsContext()

    switch (type) {
      case MSG_SUBSCRIBE:
        handleSubscribe(ctx, ws, attachment, payload as SubscribePayload)
        break

      case MSG_UNSUBSCRIBE:
        handleUnsubscribe(ctx, ws, attachment, payload as UnsubscribePayload)
        break

      case MSG_PUT:
        await handlePut(recordCtx, ws, attachment, payload as PutPayload)
        break

      case MSG_DELETE:
        await handleDelete(recordCtx, ws, attachment, payload as DeletePayload)
        break

      case MSG_USER_LIST:
        handleUserList(userCtx, ws, attachment)
        break

      case MSG_USER_UPDATE:
        handleUserUpdate(recordCtx, ws, attachment, payload as { name?: string; email?: string; imageUrl?: string })
        break

      case MSG_SET_ROLE:
        await handleSetRole(userCtx, ws, attachment, payload as SetRolePayload)
        break

      case MSG_YJS_JOIN:
        await handleYjsJoin(yjsCtx, ws, attachment, payload as YjsJoinPayload)
        break

      case MSG_YJS_LEAVE:
        handleYjsLeave(ws, attachment, payload as YjsLeavePayload)
        break

      case MSG_REGISTER_SCHEMAS:
        this.handleRegisterSchemas(ws, payload as { schemas: CollectionSchema[] })
        break

      case MSG_LIST_SCHEMAS:
        this.handleListSchemas(ws)
        break

      default:
        this.send(ws, { type: MSG_ERROR, payload: { error: `Unknown message type: ${type}` } })
    }
  }

  // ============================================================================
  // Schema Registration
  // ============================================================================

  /**
   * Load runtime schemas from SQLite (survives DO hibernation).
   */
  private loadRuntimeSchemas(): void {
    const cursor = this.sql.exec(`SELECT name, schema FROM runtime_schemas`)
    let count = 0
    const names: string[] = []
    for (const row of cursor.toArray()) {
      const r = row as { name: string; schema: string }
      try {
        const schema = JSON.parse(r.schema) as CollectionSchema
        if (!schema.name) continue
        this.schemaRegistry.registerTrusted(schema)
        // Only apply defaultRole from users schemas that aren't scoped to
        // 'user' — user-scope schemas (defaultRole: 'viewer') should only
        // affect user:* DOs, not conv:* or app:* DOs. Guard kept for DOs
        // that may have stale user-scope schemas persisted from earlier code.
        if (schema.name === 'users' && schema.defaultRole && schema.scope !== 'user') {
          this.defaultRole = schema.defaultRole
        }
        names.push(r.name)
        count++
      } catch (e) {
        console.error('[DO] Failed to parse runtime schema:', r.name, e)
      }
    }
    if (count > 0) {
      console.log('[DO] Loaded runtime schemas from SQLite:', count, names)
    }
  }


  /**
   * Handle runtime schema registration from client.
   * Persists to SQLite so schemas survive hibernation.
   */
  private handleRegisterSchemas(
    ws: WebSocket,
    payload: { schemas: CollectionSchema[] }
  ): void {
    const { schemas } = payload

    if (!schemas || !Array.isArray(schemas)) {
      this.send(ws, { type: MSG_ERROR, payload: { error: 'Invalid schemas payload' } })
      return
    }

    const registered: string[] = []
    const skipped: string[] = []
    const now = new Date().toISOString()

    for (const schema of schemas) {
      if (!schema.name || typeof schema.name !== 'string') {
        continue // Skip invalid schemas
      }

      if (this.schemaRegistry.registerRuntime(schema)) {
        registered.push(schema.name)
        // Widget schemas are NOT persisted — they're re-sent on each WS connection.
        // Only pushed schemas (from platform worker) and R2 schemas are persisted.
        this.ensureCollectionTable(schema)
        if (schema.name === 'users' && schema.defaultRole) {
          this.defaultRole = schema.defaultRole
        }
      } else {
        skipped.push(schema.name) // Has trusted schema, cannot override
      }
    }

    // Send confirmation back to client
    this.send(ws, {
      type: MSG_REGISTER_SCHEMAS,
      payload: {
        registered,
        skipped,
        message: skipped.length > 0
          ? `Registered ${registered.length} schemas. ${skipped.length} skipped (trusted schemas exist).`
          : `Registered ${registered.length} schemas.`,
      },
    })
  }

  // ============================================================================
  // Schema Discovery
  // ============================================================================

  /**
   * Handle MSG_LIST_SCHEMAS: return all registered schemas (trusted + runtime).
   * Allows clients to discover what collections exist in this scope.
   */
  private handleListSchemas(ws: WebSocket): void {
    const schemas = this.schemaRegistry.all()
    this.send(ws, {
      type: MSG_LIST_SCHEMAS,
      payload: { schemas },
    })
  }

  // ============================================================================
  // Context Factory Methods
  // ============================================================================

  private createHandlerContext() {
    return {
      sql: this.sql,
      state: this.state,
      schemaRegistry: this.schemaRegistry,
      getPermissionContext: () => this.getPermissionContext(),
      send: (ws: WebSocket, msg: { type: number; payload: unknown }) => this.send(ws, msg),
      sendBinary: (ws: WebSocket, data: Uint8Array) => this.sendBinary(ws, data),
      yjsDocs: this.yjsDocs,
      ownerUserId: this.ownerUserId ?? undefined,
    }
  }

  private createRecordContext() {
    return {
      ...this.createHandlerContext(),
      state: this.state,
    }
  }

  private createUserContext() {
    return {
      sql: this.sql,
      state: this.state,
      schemaRegistry: this.schemaRegistry,
      send: (ws: WebSocket, msg: { type: number; payload: unknown }) => this.send(ws, msg),
    }
  }

  private createYjsContext() {
    return {
      sql: this.sql,
      state: this.state,
      yjsDocs: this.yjsDocs,
      schemaRegistry: this.schemaRegistry,
      getPermissionContext: () => this.getPermissionContext(),
      send: (ws: WebSocket, msg: { type: number; payload: unknown }) => this.send(ws, msg),
      sendBinary: (ws: WebSocket, data: Uint8Array) => this.sendBinary(ws, data),
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private send(ws: WebSocket, message: { type: number; payload: unknown }): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message))
      }
    } catch {
      // Ignore send errors
    }
  }

  private sendBinary(ws: WebSocket, data: Uint8Array): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    } catch {
      // Ignore send errors
    }
  }
}
