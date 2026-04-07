/**
 * Integration Test Page — browse and test all integration endpoints.
 *
 * Fetches the integration catalog from the API worker, lets you pick
 * an endpoint, edit the request body, and see the result.
 *
 * data-testid attributes for Playwright:
 *   integration-endpoint     — endpoint input
 *   integration-body         — request body textarea
 *   integration-submit       — submit button
 *   integration-result       — result display (JSON)
 *   integration-error        — error display
 *   integration-loading      — loading indicator
 *   integration-catalog      — catalog container
 */

import { useState, useEffect } from 'react'
import { integration } from 'deepspace'
import { useAuth } from 'deepspace'

interface CatalogEntry {
  endpoint: string
  billing: { model: string; baseCost: number; currency: string }
}

type Catalog = Record<string, CatalogEntry[]>

export default function IntegrationTestPage() {
  const { isSignedIn } = useAuth()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [endpoint, setEndpoint] = useState('openai/chat-completion')
  const [body, setBody] = useState(JSON.stringify({
    messages: [{ role: 'user', content: 'Say hello in exactly 3 words' }],
    model: 'gpt-4o-mini',
    max_tokens: 20,
  }, null, 2))
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch catalog on mount
  useEffect(() => {
    integration.get<{ integrations: Catalog }>('').then((res) => {
      if (res.success && res.data) {
        setCatalog((res.data as any).integrations ?? res.data)
      }
    })
  }, [])

  const selectEndpoint = (name: string, ep: string) => {
    setEndpoint(`${name}/${ep}`)
    setBody('{}')
    setResult(null)
    setError(null)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        setError('Invalid JSON body')
        setLoading(false)
        return
      }

      const res = await integration.post(endpoint, parsed)
      setResult(res)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground mb-2">Integration Tester</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isSignedIn ? 'Signed in — API calls will use your JWT.' : 'Not signed in — developer billing will be used.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Catalog */}
        <div data-testid="integration-catalog" className="md:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto">
          {catalog ? (
            Object.entries(catalog).sort(([a], [b]) => a.localeCompare(b)).map(([name, endpoints]) => (
              <div key={name}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{name}</div>
                <div className="space-y-0.5">
                  {endpoints.map((ep) => (
                    <button
                      key={ep.endpoint}
                      onClick={() => selectEndpoint(name, ep.endpoint)}
                      className={`block w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                        endpoint === `${name}/${ep.endpoint}`
                          ? 'bg-primary/20 text-primary'
                          : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      {ep.endpoint}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {ep.billing.model === 'per_request' ? `$${ep.billing.baseCost}` : ep.billing.model}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Loading catalog...</div>
          )}
        </div>

        {/* Request / Response */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Endpoint</label>
            <input
              data-testid="integration-endpoint"
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Request Body (JSON)</label>
            <textarea
              data-testid="integration-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground font-mono"
            />
          </div>

          <button
            data-testid="integration-submit"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Calling...' : 'Send Request'}
          </button>

          {loading && (
            <div data-testid="integration-loading" className="text-sm text-muted-foreground">
              Loading...
            </div>
          )}

          {error && (
            <div data-testid="integration-error" className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              <div data-testid="integration-status" className="text-sm font-medium text-foreground">
                {result.success ? '✓ Success' : '✗ Failed'}
              </div>
              <pre
                data-testid="integration-result"
                className="rounded-lg bg-card border border-border px-4 py-3 text-xs text-foreground font-mono overflow-auto max-h-96"
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
