/**
 * YjsRoom — Lightweight Durable Object for collaborative Yjs documents.
 * Extends BaseRoom for WebSocket/connection infrastructure.
 *
 * Unlike RecordRoom (schemas, RBAC, queries, user state), YjsRoom is
 * purpose-built for Yjs: sync, relay, persist. One DO per document.
 *
 * Architecture (SOTA for Yjs + Cloudflare DOs):
 * - Auth verified at the worker edge, role passed to DO via URL params
 * - DO is a thin Yjs sync relay: receive → apply → persist → broadcast
 * - Viewers can observe but not write; members/admins can write
 * - State persisted as a single binary blob in SQLite
 *
 * Uses the shared yjs-protocol.ts encoding utilities — no duplication.
 */

/// <reference types="@cloudflare/workers-types" />

import * as Y from 'yjs'
import { BaseRoom, type UserAttachment } from './base-room'
import {
  MSG_SYNC,
  MSG_AWARENESS,
  MSG_SYNC_STEP1,
  MSG_SYNC_STEP2,
  MSG_SYNC_UPDATE,
  createEncoder,
  createDecoder,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array,
  readVarUint,
  readVarUint8Array,
} from '../../shared/protocol/yjs'

// ============================================================================
// Connection attachment (extends UserAttachment, survives hibernation)
// ============================================================================

interface YjsAttachment extends UserAttachment {
  role: string
  canWrite: boolean
  awarenessClientId: number | null
}

// ============================================================================
// YjsRoom Durable Object
// ============================================================================

export class YjsRoom extends BaseRoom {
  private doc: Y.Doc | null = null
  private initialized = false

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
  }

  // --------------------------------------------------------------------------
  // Initialization & persistence
  // --------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (this.initialized) return
    this.initialized = true
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS yjs_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        doc BLOB NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
  }

  private getDoc(): Y.Doc {
    if (this.doc) return this.doc

    this.ensureInitialized()
    this.doc = new Y.Doc()

    // Load persisted state
    const rows = this.sql.exec('SELECT doc FROM yjs_state WHERE id = 1').toArray()
    if (rows.length > 0 && rows[0].doc) {
      Y.applyUpdate(this.doc, new Uint8Array(rows[0].doc as ArrayBuffer))
    }

    // Auto-save on every update
    this.doc.on('update', () => this.persistDoc())

    return this.doc
  }

  private persistDoc(): void {
    if (!this.doc) return
    const state = Y.encodeStateAsUpdate(this.doc)
    const now = new Date().toISOString()
    this.sql.exec(
      `INSERT INTO yjs_state (id, doc, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET doc = ?, updated_at = ?`,
      state, now, state, now,
    )
  }

  // --------------------------------------------------------------------------
  // BaseRoom Lifecycle Hooks
  // --------------------------------------------------------------------------

  protected onConnect(ws: WebSocket, user: UserAttachment): YjsAttachment {
    const role = (user as Record<string, unknown>).role as string ?? 'viewer'
    const canWrite = role === 'member' || role === 'admin'

    const attachment: YjsAttachment = {
      ...user,
      role,
      canWrite,
      awarenessClientId: null,
    }

    // Initial sync: send our state vector (STEP1) + full state (STEP2)
    const doc = this.getDoc()

    const step1 = createEncoder()
    writeVarUint(step1, MSG_SYNC)
    writeVarUint(step1, MSG_SYNC_STEP1)
    writeVarUint8Array(step1, Y.encodeStateVector(doc))
    ws.send(toUint8Array(step1).buffer)

    const fullState = Y.encodeStateAsUpdate(doc)
    if (fullState.length > 1) {
      const step2 = createEncoder()
      writeVarUint(step2, MSG_SYNC)
      writeVarUint(step2, MSG_SYNC_STEP2)
      writeVarUint8Array(step2, fullState)
      ws.send(toUint8Array(step2).buffer)
    }

    // Tell client their write access
    ws.send(JSON.stringify({ type: 'auth', canWrite }))

    return attachment
  }

  protected onMessage(
    ws: WebSocket,
    user: UserAttachment,
    message: { type: number; [key: string]: unknown }
  ): void {
    // YjsRoom only handles binary messages; JSON messages are ignored
    // (ping/pong handled by auto-response)
  }

  protected onBinaryMessage(ws: WebSocket, user: UserAttachment, data: ArrayBuffer): void {
    const bytes = new Uint8Array(data)
    const decoder = createDecoder(bytes)
    const messageType = readVarUint(decoder)

    if (messageType === MSG_SYNC) {
      this.handleSync(ws, decoder, bytes)
    } else if (messageType === MSG_AWARENESS) {
      this.handleAwareness(ws, decoder, bytes)
    }
  }

  protected onDisconnect(ws: WebSocket, user: UserAttachment): void {
    const attachment = ws.deserializeAttachment() as YjsAttachment | null
    if (!attachment?.awarenessClientId) return

    // Broadcast awareness removal using shared protocol encoding
    const clientId = attachment.awarenessClientId
    const stateJson = new TextEncoder().encode('null')

    // Inner: [clientId][clock=max][stateJson]
    const inner = createEncoder()
    writeVarUint(inner, clientId)
    writeVarUint(inner, 0xffffff)
    writeVarUint8Array(inner, stateJson)

    // Outer: [MSG_AWARENESS][count=1][inner]
    const outer = createEncoder()
    writeVarUint(outer, MSG_AWARENESS)
    writeVarUint(outer, 1)
    for (const b of inner.data) outer.data.push(b)

    const msg = toUint8Array(outer)
    for (const peer of this.state.getWebSockets()) {
      if (peer === ws) continue
      try { peer.send(msg.buffer) } catch { /* dead socket */ }
    }
  }

  // --------------------------------------------------------------------------
  // Sync protocol
  // --------------------------------------------------------------------------

  private handleSync(
    ws: WebSocket,
    decoder: { data: Uint8Array; pos: number },
    rawMessage: Uint8Array,
  ): void {
    const syncType = readVarUint(decoder)
    const doc = this.getDoc()

    switch (syncType) {
      case MSG_SYNC_STEP1: {
        const clientStateVector = readVarUint8Array(decoder)
        const diff = Y.encodeStateAsUpdate(doc, clientStateVector)
        const enc = createEncoder()
        writeVarUint(enc, MSG_SYNC)
        writeVarUint(enc, MSG_SYNC_STEP2)
        writeVarUint8Array(enc, diff)
        ws.send(toUint8Array(enc).buffer)
        break
      }
      case MSG_SYNC_STEP2:
      case MSG_SYNC_UPDATE: {
        const attachment = ws.deserializeAttachment() as YjsAttachment | null
        if (!attachment?.canWrite) return
        const update = readVarUint8Array(decoder)
        Y.applyUpdate(doc, update, 'remote')
        this.broadcastRaw(ws, rawMessage)
        break
      }
    }
  }

  private handleAwareness(
    ws: WebSocket,
    decoder: { data: Uint8Array; pos: number },
    rawMessage: Uint8Array,
  ): void {
    // Extract awareness clientId on first message
    const attachment = ws.deserializeAttachment() as YjsAttachment | null
    if (attachment && attachment.awarenessClientId === null) {
      try {
        const savedPos = decoder.pos
        const _len = readVarUint(decoder)
        const clientId = readVarUint(decoder)
        decoder.pos = savedPos
        attachment.awarenessClientId = clientId
        ws.serializeAttachment(attachment)
      } catch { /* best effort */ }
    }
    this.broadcastRaw(ws, rawMessage)
  }

  // --------------------------------------------------------------------------
  // Broadcasting
  // --------------------------------------------------------------------------

  private broadcastRaw(sender: WebSocket, rawMessage: Uint8Array): void {
    for (const ws of this.state.getWebSockets()) {
      if (ws === sender) continue
      try { ws.send(rawMessage.buffer) } catch { /* dead socket */ }
    }
  }
}
