import { describe, it, expect } from 'vitest'
import { endpoints } from '.'

// Network-dependent NASA endpoint tests removed — they were chronically flaky
// against api.nasa.gov. Real coverage belongs in tests/e2e against the
// deployed api-worker.

describe('NASA', () => {
  it('billing: all endpoints at $0.01', () => {
    for (const key of Object.keys(endpoints)) {
      expect(endpoints[key].billing.baseCost).toBe(0.01)
    }
  })
})
