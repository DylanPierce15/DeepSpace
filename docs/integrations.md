# Integrations

## Platform Integrations (API Worker)

30+ integrations live in the API worker (`platform/api-worker/src/integrations/`). Each one is a self-contained module with a handler and billing config.

### Adding a new platform integration

Create one file:

```
platform/api-worker/src/integrations/<name>/index.ts
```

```ts
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const myHandler: IntegrationHandler = async (env, body) => {
  if (!env.MY_API_KEY) throw new Error('MY_API_KEY not configured')

  const res = await fetch('https://api.example.com/v1/endpoint', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: body.prompt }),
  })

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export const endpoints: Record<string, EndpointDefinition> = {
  '<name>/<endpoint>': {
    handler: myHandler,
    billing: {
      model: 'per_request',  // or per_token, per_second, per_pixel
      baseCost: 0.01,
      currency: 'USD',
    },
  },
}
```

Then regenerate the registry and deploy:

```bash
cd platform/api-worker
pnpm generate:registry
npx wrangler deploy
```

### Billing models

| Model | Description | Example |
|---|---|---|
| `per_request` | Fixed cost per call | Weather, search |
| `per_token` | Based on token count in response | OpenAI, Anthropic |
| `per_second` | Duration-based | Video generation |
| `per_pixel` | Width × height | Image generation |
| `per_participant_minute` | For real-time sessions | LiveKit |

All costs have a 1.3x markup applied automatically. Dollar costs convert to credits at 100 credits per dollar.

### Handler signature

```ts
type IntegrationHandler = (
  env: Env['Bindings'],               // Cloudflare worker env (API keys, etc.)
  body: Record<string, unknown>,       // Request body from the client
  context: { userId: string; db: DrizzleD1Database },  // Auth + database
) => Promise<unknown>
```

Throw on failure — the route handler catches errors, records billing status as `failed`, and returns the error message.

## Calling Integrations from Apps

### From client code (anywhere — components, event handlers, etc.)

```ts
import { integration } from 'deepspace'

const result = await integration.post('openai/chat-completion', {
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4o-mini',
  max_tokens: 100,
})

if (result.success) {
  console.log(result.data)
} else {
  console.error(result.error)
}
```

The `integration` client automatically attaches the user's JWT and routes through the app worker's proxy.

### From server actions

```ts
// src/actions/index.ts
export const actions = {
  summarize: async ({ params, tools }) => {
    return tools.integration('openai/chat-completion', {
      messages: [{ role: 'user', content: `Summarize: ${params.text}` }],
      model: 'gpt-4o-mini',
    })
  }
}
```

### Billing configuration per app

Configure who pays in `src/integrations.ts`:

```ts
export const integrations: Record<string, { billing: 'developer' | 'user' }> = {
  openai: { billing: 'developer' },   // app owner pays
  weather: { billing: 'user' },        // end user pays
}
```

Default is `'developer'` — the app owner pays for all their users' API calls.

## Custom API Calls (no platform billing)

For external APIs not in the platform, use server actions:

```ts
// src/actions/index.ts
export const actions = {
  callMyApi: async ({ params, tools }) => {
    const res = await fetch('https://my-api.com/endpoint', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MY_KEY}` },
      body: JSON.stringify(params),
    })
    return res.json()
  }
}
```

The developer manages their own API keys and costs. No platform billing involved.

## Request Flow

```
Client: integration.post('openai/chat-completion', data)
  → App worker: POST /api/integrations/openai/chat-completion
    → Adds X-Billing-User-Id (owner or user)
    → Forwards user's JWT
    → API worker (service binding in prod, HTTP in dev)
      → Auth verification
      → Credit check (against billing user)
      → Record pending usage
      → Call external API
      → Record completed usage
    ← { success: true, data: { ... } }
```

## Testing Integrations

Add the `integration-test` feature for a browser-based test page:

```bash
npx deepspace add integration-test
```

Navigate to `/integration-test`, enter an endpoint and body, and click Send. Works for both authenticated and anonymous users (developer billing).

To test against prod API worker (real API calls):

```bash
npx deepspace dev --prod
# Then open http://localhost:5173/integration-test
```

To test against dev API worker (mock/no API keys):

```bash
npx deepspace dev
# Uses dev workers by default
```
