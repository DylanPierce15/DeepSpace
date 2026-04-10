import { createMiddleware } from 'hono/factory'
import { verifyJwt, safeJson } from 'deepspace/worker'
import type { Env } from '../worker'

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return safeJson(c, { error: 'Missing authorization token' }, 401)
  }

  const { result, error } = await verifyJwt(
    {
      publicKey: c.env.AUTH_JWT_PUBLIC_KEY,
      issuer: c.env.AUTH_JWT_ISSUER,
    },
    token,
  )

  if (!result) {
    console.error('JWT verification failed:', error)
    return safeJson(c, { error: 'Invalid or expired token' }, 401)
  }

  c.set('userId', result.userId)
  await next()
})
