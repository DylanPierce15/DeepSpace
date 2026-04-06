/**
 * Shared WebSocket connection logger with active connection count.
 */

let activeCount = 0

export function wsLog(event: 'connecting' | 'connected' | 'disconnected' | 'closing', label: string) {
  if (event === 'connected') activeCount++
  if (event === 'closing') activeCount--

  console.log(`[ds:ws] ${event} → ${label} (${activeCount} active)`)
}
