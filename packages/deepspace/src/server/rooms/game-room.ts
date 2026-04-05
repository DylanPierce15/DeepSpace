/**
 * GameRoom — Authoritative game loop Durable Object.
 *
 * Extends BaseRoom with:
 * - Alarm-based tick loop with configurable interval
 * - Player management (join, leave, ready state)
 * - Input collection per tick, authoritative state computation
 * - State broadcast to all connected players
 *
 * Subclasses implement game logic via lifecycle hooks:
 *   onTick, onPlayerJoin, onPlayerLeave, onGameStart, onGameEnd
 *
 * Message types: 40-59 (MSG_GAME_*)
 */

/// <reference types="@cloudflare/workers-types" />

import { BaseRoom, type UserAttachment } from './base-room'
import {
  MSG_GAME_STATE,
  MSG_GAME_INPUT,
  MSG_GAME_PLAYER_JOIN,
  MSG_GAME_PLAYER_LEAVE,
  MSG_GAME_PLAYER_READY,
  MSG_GAME_START,
  MSG_GAME_END,
  MSG_GAME_TICK,
  MSG_ERROR,
} from '../../shared/protocol/constants'

// ============================================================================
// Types
// ============================================================================

export interface GameRoomConfig {
  /** Ticks per second (default: 20) */
  tickRate?: number
  /** Minimum players to start (default: 1) */
  minPlayers?: number
  /** Maximum players (default: unlimited) */
  maxPlayers?: number
}

export interface Player {
  userId: string
  userName: string
  ready: boolean
  connectedAt: string
  data: Record<string, unknown>
}

export interface GameInput {
  userId: string
  action: string
  data: Record<string, unknown>
  tick: number
}

interface GameAttachment extends UserAttachment {
  joinedAt: string
}

// ============================================================================
// GameRoom
// ============================================================================

export abstract class GameRoom extends BaseRoom {
  private config: Required<GameRoomConfig>
  private players: Map<string, Player> = new Map()
  private inputBuffer: GameInput[] = []
  private currentTick = 0
  private gameState: Record<string, unknown> = {}
  private running = false
  private initialized = false

  constructor(
    state: DurableObjectState,
    env: unknown,
    config: GameRoomConfig = {}
  ) {
    super(state, env)
    this.config = {
      tickRate: config.tickRate ?? 20,
      minPlayers: config.minPlayers ?? 1,
      maxPlayers: config.maxPlayers ?? Infinity,
    }
  }

  private ensureInitialized(): void {
    if (this.initialized) return
    this.initialized = true
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS game_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL,
        tick INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )
    `)
    // Load persisted state
    const rows = this.sql.exec('SELECT state, tick FROM game_state WHERE id = 1').toArray()
    if (rows.length > 0) {
      try {
        this.gameState = JSON.parse(rows[0].state as string)
        this.currentTick = rows[0].tick as number
      } catch { /* fresh state */ }
    }
  }

  private persistState(): void {
    const now = new Date().toISOString()
    this.sql.exec(
      `INSERT INTO game_state (id, state, tick, updated_at) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state = ?, tick = ?, updated_at = ?`,
      JSON.stringify(this.gameState), this.currentTick, now,
      JSON.stringify(this.gameState), this.currentTick, now,
    )
  }

  // ==========================================================================
  // BaseRoom Lifecycle
  // ==========================================================================

  protected onConnect(ws: WebSocket, user: UserAttachment): GameAttachment {
    this.ensureInitialized()

    const attachment: GameAttachment = {
      ...user,
      joinedAt: new Date().toISOString(),
    }

    const player: Player = {
      userId: user.userId,
      userName: user.userName,
      ready: false,
      connectedAt: attachment.joinedAt,
      data: {},
    }

    if (this.config.maxPlayers !== Infinity && this.players.size >= this.config.maxPlayers) {
      this.sendTo(ws, { type: MSG_ERROR, payload: { error: 'Game is full' } })
      return attachment
    }

    this.players.set(user.userId, player)

    // Send current state to new player
    this.sendTo(ws, {
      type: MSG_GAME_STATE,
      payload: {
        state: this.gameState,
        tick: this.currentTick,
        players: Array.from(this.players.values()),
        running: this.running,
      },
    })

    // Notify others
    this.broadcast({ type: MSG_GAME_PLAYER_JOIN, payload: { player } }, ws)

    this.onPlayerJoin(player)

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
      case MSG_GAME_INPUT: {
        this.inputBuffer.push({
          userId: user.userId,
          action: payload.action as string,
          data: (payload.data ?? {}) as Record<string, unknown>,
          tick: this.currentTick,
        })
        break
      }

      case MSG_GAME_PLAYER_READY: {
        const player = this.players.get(user.userId)
        if (player) {
          player.ready = true
          this.broadcast({ type: MSG_GAME_PLAYER_READY, payload: { userId: user.userId } })
          this.checkAutoStart()
        }
        break
      }

      case MSG_GAME_START: {
        if (!this.running) {
          this.startGame()
        }
        break
      }

      case MSG_GAME_END: {
        if (this.running) {
          this.stopGame()
        }
        break
      }

      default:
        this.sendTo(ws, { type: MSG_ERROR, payload: { error: `Unknown game message type: ${type}` } })
    }
  }

  protected onDisconnect(ws: WebSocket, user: UserAttachment): void {
    const player = this.players.get(user.userId)
    if (player) {
      this.players.delete(user.userId)
      this.broadcast({ type: MSG_GAME_PLAYER_LEAVE, payload: { userId: user.userId } })
      this.onPlayerLeave(player)

      if (this.running && this.players.size === 0) {
        this.stopGame()
      }
    }
  }

  protected async onAlarm(): Promise<void> {
    if (!this.running) return

    // Collect inputs for this tick
    const inputs = this.inputBuffer.splice(0)
    this.currentTick++

    // Let subclass compute new state
    const newState = await this.onTick(this.gameState, inputs, this.currentTick)
    if (newState !== undefined) {
      this.gameState = newState
    }

    // Persist every 10 ticks
    if (this.currentTick % 10 === 0) {
      this.persistState()
    }

    // Broadcast tick to all players
    this.broadcast({
      type: MSG_GAME_TICK,
      payload: {
        state: this.gameState,
        tick: this.currentTick,
      },
    })

    // Schedule next tick
    if (this.running) {
      const intervalMs = 1000 / this.config.tickRate
      this.state.storage.setAlarm(Date.now() + intervalMs)
    }
  }

  // ==========================================================================
  // Game Control
  // ==========================================================================

  private checkAutoStart(): void {
    if (this.running) return
    const readyCount = Array.from(this.players.values()).filter(p => p.ready).length
    if (readyCount >= this.config.minPlayers && readyCount === this.players.size) {
      this.startGame()
    }
  }

  private startGame(): void {
    this.running = true
    this.currentTick = 0
    this.inputBuffer = []
    this.onGameStart()
    this.broadcast({ type: MSG_GAME_START, payload: { state: this.gameState, tick: 0 } })

    // Start tick loop
    const intervalMs = 1000 / this.config.tickRate
    this.state.storage.setAlarm(Date.now() + intervalMs)
  }

  private stopGame(): void {
    this.running = false
    this.persistState()
    this.onGameEnd(this.gameState)
    this.broadcast({ type: MSG_GAME_END, payload: { state: this.gameState, tick: this.currentTick } })
  }

  // ==========================================================================
  // Protected Accessors (for subclasses)
  // ==========================================================================

  protected getGameState(): Record<string, unknown> {
    return this.gameState
  }

  protected setGameState(state: Record<string, unknown>): void {
    this.gameState = state
  }

  protected getPlayers(): Player[] {
    return Array.from(this.players.values())
  }

  protected isRunning(): boolean {
    return this.running
  }

  protected getCurrentTick(): number {
    return this.currentTick
  }

  // ==========================================================================
  // Lifecycle Hooks (subclasses override)
  // ==========================================================================

  /**
   * Called each tick with current state and collected inputs.
   * Return the new game state, or undefined to keep current state.
   */
  protected abstract onTick(
    state: Record<string, unknown>,
    inputs: GameInput[],
    tick: number
  ): Record<string, unknown> | undefined | Promise<Record<string, unknown> | undefined>

  /** Called when a player connects */
  protected onPlayerJoin(player: Player): void {}

  /** Called when a player disconnects */
  protected onPlayerLeave(player: Player): void {}

  /** Called when the game starts */
  protected onGameStart(): void {}

  /** Called when the game ends */
  protected onGameEnd(finalState: Record<string, unknown>): void {}
}
