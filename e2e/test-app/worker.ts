/**
 * E2E test app — minimal Cloudflare Worker deployed via WfP REST API.
 *
 * Verifies:
 *   - WfP dispatch routes deepspace-sdk-test.app.space here
 *   - Worker can serve HTML
 *   - Worker can handle API routes
 *   - Worker can read request metadata
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // ── API routes ────────────────────────────────────────────────
    if (url.pathname === '/api/health') {
      return Response.json({
        status: 'ok',
        app: 'deepspace-sdk-test',
        timestamp: new Date().toISOString(),
      })
    }

    if (url.pathname === '/api/echo') {
      const body = request.method === 'POST' ? await request.json() : null
      return Response.json({
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers),
        body,
      })
    }

    if (url.pathname === '/api/meta') {
      return Response.json({
        hostname: url.hostname,
        pathname: url.pathname,
        origin: url.origin,
        cf: (request as any).cf ?? null,
      })
    }

    // ── HTML page ─────────────────────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DeepSpace SDK Test</title>
</head>
<body>
  <h1 id="heading">DeepSpace SDK Test App</h1>
  <p id="status">Loading...</p>
  <script>
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        document.getElementById('status').textContent =
          'App: ' + data.app + ' | Status: ' + data.status;
      })
      .catch(err => {
        document.getElementById('status').textContent = 'Error: ' + err.message;
      });
  </script>
</body>
</html>`
