/**
 * GatewaySession Durable Object stub
 *
 * Manages multiplexed WebSocket connections (one per user+app).
 * Will be replaced by the full implementation from @deepspace/sdk-worker.
 */

export class GatewaySession implements DurableObject {
  private state: DurableObjectState

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      this.state.acceptWebSocket(pair[1])
      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    return Response.json(
      { error: 'GatewaySession stub — full implementation pending' },
      { status: 501 },
    )
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Stub
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Stub
  }
}
