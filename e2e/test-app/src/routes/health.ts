export function handleHealth(): Response {
  return Response.json({
    status: 'ok',
    app: 'deepspace-sdk-test',
    timestamp: new Date().toISOString(),
  })
}

export async function handleEcho(request: Request): Promise<Response> {
  const body = request.method === 'POST' ? await request.json() : null
  return Response.json({
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    body,
  })
}

export function handleMeta(url: URL): Response {
  return Response.json({
    hostname: url.hostname,
    pathname: url.pathname,
    origin: url.origin,
  })
}
