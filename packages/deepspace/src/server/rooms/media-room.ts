/**
 * MediaRoom — WebRTC signaling relay Durable Object.
 *
 * Extends BaseRoom. Purely ephemeral — no SQLite persistence.
 * Relays SDP offers/answers and ICE candidates between peers.
 * Tracks room membership (who's in the call).
 *
 * Message types: 80-99 (MSG_MEDIA_*)
 */

/// <reference types="@cloudflare/workers-types" />

import { BaseRoom, type UserAttachment } from './base-room'
import {
  MSG_MEDIA_JOIN,
  MSG_MEDIA_LEAVE,
  MSG_MEDIA_OFFER,
  MSG_MEDIA_ANSWER,
  MSG_MEDIA_ICE_CANDIDATE,
  MSG_MEDIA_PEERS,
  MSG_ERROR,
} from '../../shared/protocol/constants'

// ============================================================================
// Types
// ============================================================================

export interface MediaPeer {
  userId: string
  userName: string
  joinedAt: string
}

interface MediaAttachment extends UserAttachment {
  joinedAt: string
}

// ============================================================================
// MediaRoom
// ============================================================================

export class MediaRoom extends BaseRoom {
  private peers: Map<string, MediaPeer> = new Map()
  /** Map userId -> WebSocket for targeted signaling */
  private peerSockets: Map<string, WebSocket> = new Map()

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env)
  }

  // --------------------------------------------------------------------------
  // BaseRoom Lifecycle
  // --------------------------------------------------------------------------

  protected onConnect(ws: WebSocket, user: UserAttachment): MediaAttachment {
    const now = new Date().toISOString()

    const peer: MediaPeer = {
      userId: user.userId,
      userName: user.userName,
      joinedAt: now,
    }

    this.peers.set(user.userId, peer)
    this.peerSockets.set(user.userId, ws)

    const attachment: MediaAttachment = {
      ...user,
      joinedAt: now,
    }

    // Send current peer list to new participant
    this.sendTo(ws, {
      type: MSG_MEDIA_PEERS,
      payload: { peers: Array.from(this.peers.values()) },
    })

    // Notify existing peers
    this.broadcast({ type: MSG_MEDIA_JOIN, payload: { peer } }, ws)

    return attachment
  }

  protected async onMessage(
    ws: WebSocket,
    user: UserAttachment,
    message: { type: number; [key: string]: unknown }
  ): Promise<void> {
    const { type, payload } = message as { type: number; payload: Record<string, unknown> }

    switch (type) {
      case MSG_MEDIA_OFFER: {
        const { targetUserId, sdp } = payload as { targetUserId: string; sdp: unknown }
        const targetWs = this.peerSockets.get(targetUserId)
        if (targetWs) {
          this.sendTo(targetWs, {
            type: MSG_MEDIA_OFFER,
            payload: { fromUserId: user.userId, sdp },
          })
        }
        break
      }

      case MSG_MEDIA_ANSWER: {
        const { targetUserId, sdp } = payload as { targetUserId: string; sdp: unknown }
        const targetWs = this.peerSockets.get(targetUserId)
        if (targetWs) {
          this.sendTo(targetWs, {
            type: MSG_MEDIA_ANSWER,
            payload: { fromUserId: user.userId, sdp },
          })
        }
        break
      }

      case MSG_MEDIA_ICE_CANDIDATE: {
        const { targetUserId, candidate } = payload as { targetUserId: string; candidate: unknown }
        const targetWs = this.peerSockets.get(targetUserId)
        if (targetWs) {
          this.sendTo(targetWs, {
            type: MSG_MEDIA_ICE_CANDIDATE,
            payload: { fromUserId: user.userId, candidate },
          })
        }
        break
      }

      case MSG_MEDIA_LEAVE: {
        this.removePeer(user.userId, ws)
        break
      }

      default:
        this.sendTo(ws, { type: MSG_ERROR, payload: { error: `Unknown media message type: ${type}` } })
    }
  }

  protected onDisconnect(ws: WebSocket, user: UserAttachment): void {
    this.removePeer(user.userId, ws)
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private removePeer(userId: string, ws: WebSocket): void {
    this.peers.delete(userId)
    this.peerSockets.delete(userId)
    this.broadcast({ type: MSG_MEDIA_LEAVE, payload: { userId } }, ws)
  }
}
