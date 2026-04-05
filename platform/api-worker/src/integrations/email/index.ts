/**
 * Email integration — send transactional emails via Resend.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const send: IntegrationHandler = async (env, body) => {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')

  const { from, to, subject, html, text, reply_to, cc, bcc } = body as {
    from: string
    to: string | string[]
    subject: string
    html?: string
    text?: string
    reply_to?: string
    cc?: string | string[]
    bcc?: string | string[]
  }

  if (!from) throw new Error('from is required')
  if (!to) throw new Error('to is required')
  if (!subject) throw new Error('subject is required')
  if (!html && !text) throw new Error('html or text content is required')

  const payload: Record<string, unknown> = { from, to, subject }
  if (html) payload.html = html
  if (text) payload.text = text
  if (reply_to) payload.reply_to = reply_to
  if (cc) payload.cc = cc
  if (bcc) payload.bcc = bcc

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Resend API error ${response.status}: ${errorBody}`)
  }

  return response.json()
}

export const endpoints: Record<string, EndpointDefinition> = {
  'email/send': {
    handler: send,
    billing: { model: 'per_request', baseCost: 0.01, currency: 'USD' },
  },
}
