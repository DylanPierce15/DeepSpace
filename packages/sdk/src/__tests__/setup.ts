import '@testing-library/jest-dom/vitest'

// Mock WebSocket for storage/platform tests
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.OPEN
  url: string
  onopen: ((ev: Event) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send(_data: string | ArrayBuffer) {}
  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED
  }

  addEventListener(_type: string, _listener: EventListener) {}
  removeEventListener(_type: string, _listener: EventListener) {}
}

Object.defineProperty(globalThis, 'WebSocket', { value: MockWebSocket, writable: true })
