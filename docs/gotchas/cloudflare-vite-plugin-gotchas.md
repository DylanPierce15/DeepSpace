# Cloudflare Vite Plugin Gotchas
INCORRECT EXPLANATION

## Unhandled fetch errors in worker routes

The Cloudflare Vite plugin wraps the worker's request handler. If a `fetch()` call inside a route throws an unhandled error (e.g., network failure, DNS resolution failure), the plugin catches it before Hono's error handling and returns an HTML error overlay page instead of JSON.

This means **every `fetch()` to an external URL in a worker route must be wrapped in try/catch**. If the error escapes the route handler, the Vite plugin intercepts it and the client receives HTML instead of a JSON error response.

### Bad (error escapes to Vite plugin):
```ts
app.post('/api/proxy', async (c) => {
  const res = await fetch(externalUrl, { method: 'POST', body })  // throws → HTML error page
  return new Response(res.body)
})
```

### Good (error caught, JSON response):
```ts
app.post('/api/proxy', async (c) => {
  try {
    const res = await fetch(externalUrl, { method: 'POST', body })
    return new Response(res.body, { status: res.status, headers: res.headers })
  } catch (err) {
    return c.json({ success: false, error: 'Proxy request failed' }, 502)
  }
})
```

### Why this only affects the Vite plugin (not production)

In production (deployed to Cloudflare), unhandled errors in workers return a generic 500 response. The Vite plugin adds a development-only error overlay that renders the error as an HTML page. This overlay is useful for debugging but breaks API routes that clients expect to return JSON.

### The auth proxy isn't affected

The auth proxy (`/api/auth/*`) forwards to the auth worker which is almost always available. Integration proxy calls may hit external APIs that are slower or less reliable, making fetch failures more common. Both should have try/catch regardless.
