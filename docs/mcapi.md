# Integration API (mcapi)

## Overview

The integration API lets DeepSpace apps call third-party services (OpenAI, weather, search, etc.) through the platform's API worker. The API worker handles auth, billing, credit checks, and rate limiting.

## Client

Plain function, not a React hook. Works anywhere.

```ts
import { integration } from 'deepspace'

// POST
const result = await integration.post('openai/chat-completion', {
  messages: [{ role: 'user', content: 'Hello' }]
})

// GET
const voices = await integration.get('elevenlabs-voices')
```

- Resolves endpoints to `/api/integrations/{endpoint}` on the current origin
- Sends the user's JWT automatically
- Returns `{ success: true, data: {...} }` or `{ success: false, error: "..." }`
- 120s default timeout
- No pre-flight credit check — the API worker enforces credits server-side

## Billing

Configured per-integration in `src/integrations.ts`:

```ts
export const integrations = {
  openai: { billing: 'developer' },
  weather: { billing: 'user' },
}
```

- `'developer'` (default) — app owner pays. Works for anonymous users.
- `'user'` — the calling user pays. Requires sign-in (returns 401 if anonymous).

## Request Flow

```
Client: integration.post('openai/chat-completion', data)
  → App worker: POST /api/integrations/openai/chat-completion
    → Adds X-Billing-User-Id header (owner or user based on config)
    → Forwards user's JWT as Authorization header
    → API worker (service binding in prod, HTTP in dev)
      → Credit check → external API call → usage tracking
  ← { success, data }
```

## Server Actions

From worker actions, use `tools.integration`:

```ts
export const actions = {
  summarize: async ({ params, tools }) => {
    return tools.integration('openai/chat-completion', {
      messages: [{ role: 'user', content: params.text }]
    })
  }
}
```

## API Worker Changes

- Reads `X-Billing-User-Id` header to determine who to charge
- JWT subject is always tracked as the caller (`user_id`)
- Billing user tracked separately (`billing_user_id`)
- If no `X-Billing-User-Id` header, charges the JWT subject (backward compat)
