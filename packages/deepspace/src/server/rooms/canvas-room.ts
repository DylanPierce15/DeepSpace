/**
 * CanvasRoom — Spatial canvas Durable Object (tldraw-style).
 *
 * Extends BaseRoom with Yjs-backed spatial operations.
 * Each shape is a Y.Map entry, enabling multi-user concurrent editing.
 *
 * Features:
 * - Shape CRUD (add, move, resize, delete, update properties)
 * - Viewport awareness (each user's visible region)
 * - Per-user undo/redo stacks
 *
 * Message types: 60-79 (MSG_CANVAS_*)
 */

/// <reference types="@cloudflare/workers-types" />

import * as Y from 'yjs'
import { BaseRoom, type UserAttachment } from './base-room'
import {
  MSG_CANVAS_SHAPES,
  MSG_CANVAS_ADD,
  MSG_CANVAS_MOVE,
  MSG_CANVAS_RESIZE,
  MSG_CANVAS_DELETE,
  MSG_CANVAS_UPDATE,
  MSG_CANVAS_VIEWPORT,
  MSG_CANVAS_UNDO,
  MSG_CANVAS_REDO,
  MSG_ERROR,
} from '../../shared/protocol/constants'

// ============================================================================
// Types
// ============================================================================

export interface CanvasShape {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  props: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Viewport {
  userId: string
  x: number
  y: number
  width: number
  height: number
  zoom: number
}

interface CanvasAttachment extends UserAttachment {
  viewport: Viewport | null
}

interface UndoEntry {
  type: 'add' | 'delete' | 'update'
  shapeId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

// ============================================================================
// CanvasRoom
// ============================================================================

export class CanvasRoom extends BaseRoom {
  private doc: Y.Doc | null = null
  private initialized = false
  private viewports: Map<string, Viewport> = new Map()
  private undoStacks: Map<string, UndoEntry[]> = new Map()
  private redoStacks: Map<string, UndoEntry[]> = new Map()

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
      CREATE TABLE IF NOT EXISTS canvas_state (
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

    const rows = this.sql.exec('SELECT doc FROM canvas_state WHERE id = 1').toArray()
    if (rows.length > 0 && rows[0].doc) {
      Y.applyUpdate(this.doc, new Uint8Array(rows[0].doc as ArrayBuffer))
    }

    this.doc.on('update', () => this.persistDoc())
    return this.doc
  }

  private persistDoc(): void {
    if (!this.doc) return
    const state = Y.encodeStateAsUpdate(this.doc)
    const now = new Date().toISOString()
    this.sql.exec(
      `INSERT INTO canvas_state (id, doc, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET doc = ?, updated_at = ?`,
      state, now, state, now,
    )
  }

  private getShapesMap(): Y.Map<Record<string, unknown>> {
    return this.getDoc().getMap('shapes') as Y.Map<Record<string, unknown>>
  }

  // --------------------------------------------------------------------------
  // BaseRoom Lifecycle
  // --------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    this.ensureInitialized()
    return super.fetch(request)
  }

  protected onConnect(ws: WebSocket, user: UserAttachment): CanvasAttachment {
    this.ensureInitialized()

    const attachment: CanvasAttachment = {
      ...user,
      viewport: null,
    }

    // Send current shapes
    const shapes = this.getAllShapes()
    this.sendTo(ws, {
      type: MSG_CANVAS_SHAPES,
      payload: {
        shapes,
        viewports: Array.from(this.viewports.values()),
      },
    })

    return attachment
  }

  protected async onMessage(
    ws: WebSocket,
    user: UserAttachment,
    message: { type: number; [key: string]: unknown }
  ): Promise<void> {
    this.ensureInitialized()
    const { type, payload } = message as { type: number; payload: Record<string, unknown> }

    switch (type) {
      case MSG_CANVAS_ADD: {
        const shape = payload as unknown as Partial<CanvasShape>
        const id = shape.id ?? crypto.randomUUID()
        const now = new Date().toISOString()

        const newShape: CanvasShape = {
          id,
          type: shape.type ?? 'rect',
          x: shape.x ?? 0,
          y: shape.y ?? 0,
          width: shape.width ?? 100,
          height: shape.height ?? 100,
          rotation: shape.rotation,
          props: shape.props ?? {},
          createdBy: user.userId,
          createdAt: now,
          updatedAt: now,
        }

        this.getShapesMap().set(id, newShape as unknown as Record<string, unknown>)

        this.pushUndo(user.userId, { type: 'add', shapeId: id, after: newShape as unknown as Record<string, unknown> })
        this.clearRedo(user.userId)

        this.broadcast({ type: MSG_CANVAS_ADD, payload: { shape: newShape } })
        break
      }

      case MSG_CANVAS_MOVE: {
        const { shapeId, x, y } = payload as { shapeId: string; x: number; y: number }
        const shapesMap = this.getShapesMap()
        const existing = shapesMap.get(shapeId)
        if (!existing) break

        const before = { ...existing }
        const updated = { ...existing, x, y, updatedAt: new Date().toISOString() }
        shapesMap.set(shapeId, updated)

        this.pushUndo(user.userId, { type: 'update', shapeId, before, after: updated })
        this.clearRedo(user.userId)

        this.broadcast({ type: MSG_CANVAS_MOVE, payload: { shapeId, x, y } }, ws)
        break
      }

      case MSG_CANVAS_RESIZE: {
        const { shapeId, width, height, x, y } = payload as { shapeId: string; width: number; height: number; x?: number; y?: number }
        const shapesMap = this.getShapesMap()
        const existing = shapesMap.get(shapeId)
        if (!existing) break

        const before = { ...existing }
        const updated = { ...existing, width, height, updatedAt: new Date().toISOString() }
        if (x !== undefined) (updated as Record<string, unknown>).x = x
        if (y !== undefined) (updated as Record<string, unknown>).y = y
        shapesMap.set(shapeId, updated)

        this.pushUndo(user.userId, { type: 'update', shapeId, before, after: updated })
        this.clearRedo(user.userId)

        this.broadcast({ type: MSG_CANVAS_RESIZE, payload: { shapeId, width, height, x, y } }, ws)
        break
      }

      case MSG_CANVAS_DELETE: {
        const { shapeId } = payload as { shapeId: string }
        const shapesMap = this.getShapesMap()
        const existing = shapesMap.get(shapeId)
        if (!existing) break

        shapesMap.delete(shapeId)

        this.pushUndo(user.userId, { type: 'delete', shapeId, before: existing })
        this.clearRedo(user.userId)

        this.broadcast({ type: MSG_CANVAS_DELETE, payload: { shapeId } })
        break
      }

      case MSG_CANVAS_UPDATE: {
        const { shapeId, props } = payload as { shapeId: string; props: Record<string, unknown> }
        const shapesMap = this.getShapesMap()
        const existing = shapesMap.get(shapeId)
        if (!existing) break

        const before = { ...existing }
        const updated = {
          ...existing,
          props: { ...(existing.props as Record<string, unknown> ?? {}), ...props },
          updatedAt: new Date().toISOString(),
        }
        shapesMap.set(shapeId, updated)

        this.pushUndo(user.userId, { type: 'update', shapeId, before, after: updated })
        this.clearRedo(user.userId)

        this.broadcast({ type: MSG_CANVAS_UPDATE, payload: { shapeId, props } }, ws)
        break
      }

      case MSG_CANVAS_VIEWPORT: {
        const viewport = payload as unknown as Viewport
        viewport.userId = user.userId
        this.viewports.set(user.userId, viewport)
        this.broadcast({ type: MSG_CANVAS_VIEWPORT, payload: { viewport } }, ws)
        break
      }

      case MSG_CANVAS_UNDO: {
        this.handleUndo(user.userId)
        break
      }

      case MSG_CANVAS_REDO: {
        this.handleRedo(user.userId)
        break
      }

      default:
        this.sendTo(ws, { type: MSG_ERROR, payload: { error: `Unknown canvas message type: ${type}` } })
    }
  }

  protected onDisconnect(ws: WebSocket, user: UserAttachment): void {
    this.viewports.delete(user.userId)
    this.undoStacks.delete(user.userId)
    this.redoStacks.delete(user.userId)
    this.broadcast({ type: MSG_CANVAS_VIEWPORT, payload: { userId: user.userId, removed: true } })
  }

  // --------------------------------------------------------------------------
  // Undo / Redo
  // --------------------------------------------------------------------------

  private pushUndo(userId: string, entry: UndoEntry): void {
    if (!this.undoStacks.has(userId)) this.undoStacks.set(userId, [])
    const stack = this.undoStacks.get(userId)!
    stack.push(entry)
    if (stack.length > 100) stack.shift()
  }

  private clearRedo(userId: string): void {
    this.redoStacks.set(userId, [])
  }

  private handleUndo(userId: string): void {
    const stack = this.undoStacks.get(userId)
    if (!stack || stack.length === 0) return

    const entry = stack.pop()!
    const shapesMap = this.getShapesMap()

    if (!this.redoStacks.has(userId)) this.redoStacks.set(userId, [])
    this.redoStacks.get(userId)!.push(entry)

    switch (entry.type) {
      case 'add':
        shapesMap.delete(entry.shapeId)
        this.broadcast({ type: MSG_CANVAS_DELETE, payload: { shapeId: entry.shapeId } })
        break
      case 'delete':
        if (entry.before) {
          shapesMap.set(entry.shapeId, entry.before)
          this.broadcast({ type: MSG_CANVAS_ADD, payload: { shape: entry.before } })
        }
        break
      case 'update':
        if (entry.before) {
          shapesMap.set(entry.shapeId, entry.before)
          this.broadcast({ type: MSG_CANVAS_SHAPES, payload: { shapes: this.getAllShapes() } })
        }
        break
    }
  }

  private handleRedo(userId: string): void {
    const stack = this.redoStacks.get(userId)
    if (!stack || stack.length === 0) return

    const entry = stack.pop()!
    const shapesMap = this.getShapesMap()

    if (!this.undoStacks.has(userId)) this.undoStacks.set(userId, [])
    this.undoStacks.get(userId)!.push(entry)

    switch (entry.type) {
      case 'add':
        if (entry.after) {
          shapesMap.set(entry.shapeId, entry.after)
          this.broadcast({ type: MSG_CANVAS_ADD, payload: { shape: entry.after } })
        }
        break
      case 'delete':
        shapesMap.delete(entry.shapeId)
        this.broadcast({ type: MSG_CANVAS_DELETE, payload: { shapeId: entry.shapeId } })
        break
      case 'update':
        if (entry.after) {
          shapesMap.set(entry.shapeId, entry.after)
          this.broadcast({ type: MSG_CANVAS_SHAPES, payload: { shapes: this.getAllShapes() } })
        }
        break
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private getAllShapes(): CanvasShape[] {
    const shapesMap = this.getShapesMap()
    const shapes: CanvasShape[] = []
    shapesMap.forEach((value, key) => {
      shapes.push({ id: key, ...value } as unknown as CanvasShape)
    })
    return shapes
  }
}
