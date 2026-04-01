/**
 * SharedRecordRoom Durable Object stub
 *
 * This will be replaced by the full RecordRoom implementation
 * from @deepspace/sdk-worker once that package is built.
 * For now, this provides the class export that wrangler needs.
 */

export class SharedRecordRoom implements DurableObject {
  private state: DurableObjectState

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      this.state.acceptWebSocket(pair[1])
      return new Response(null, { status: 101, webSocket: pair[0] })
    }

    return Response.json(
      { error: 'RecordRoom stub — full implementation pending' },
      { status: 501 },
    )
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Stub — will be implemented in @deepspace/sdk-worker
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    // Stub
  }
}
