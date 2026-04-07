# Plan: Zod Schemas for Integration Endpoints

## Goal

Every integration endpoint gets a Zod schema for its request body. This gives us:
- **Runtime validation** — reject bad requests before calling external APIs
- **Auto-generated examples** — from Zod defaults, served in the catalog
- **Type safety** — handlers receive typed, validated data
- **Form generation** — the integration tester UI can render proper forms

## Current State

Each endpoint is an `EndpointDefinition`:
```ts
{
  handler: IntegrationHandler,    // (env, body, ctx) => Promise<unknown>
  billing: BillingConfig,
}
```

The handler manually validates: `if (!body.prompt) throw new Error('prompt is required')`.

## Target State

```ts
{
  handler: IntegrationHandler,
  billing: BillingConfig,
  schema: z.ZodObject<...>,       // request body schema with defaults
}
```

## Implementation

### Step 1: Add `schema` field to `EndpointDefinition`

```ts
// _types.ts
import { z } from 'zod'

export interface EndpointDefinition {
  handler: IntegrationHandler
  billing: BillingConfig
  schema?: z.ZodTypeAny
}
```

Optional so existing endpoints don't break. Can migrate incrementally.

### Step 2: Add schemas to endpoints (per integration)

Example for OpenAI:
```ts
const chatCompletionSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'system', 'assistant']),
    content: z.string(),
  })),
  model: z.string().default('gpt-4o-mini'),
  max_tokens: z.number().int().min(1).max(16384).default(100),
  temperature: z.number().min(0).max(2).optional(),
})

export const endpoints = {
  'openai/chat-completion': {
    handler: chatCompletion,
    schema: chatCompletionSchema,
    billing: { ... },
  },
}
```

### Step 3: Auto-validate in the route handler

```ts
// routes/integrations.ts
const rawBody = await c.req.json()
const schema = SCHEMAS.get(handlerKey)
const body = schema ? schema.parse(rawBody) : rawBody
```

Zod throws `ZodError` on validation failure — caught by `app.onError` and returned as a 400 with field-level errors.

### Step 4: Auto-generate catalog with examples

```ts
// routes/integrations.ts — catalog endpoint
import { zodToJsonSchema } from 'zod-to-json-schema'

for (const [key, config] of Object.entries(BILLING_CONFIGS)) {
  const schema = SCHEMAS.get(key)
  catalog[integrationName].push({
    endpoint,
    billing,
    inputSchema: schema ? zodToJsonSchema(schema) : null,
  })
}
```

The JSON Schema includes defaults, enums, min/max — everything the UI needs to render forms and pre-fill examples.

### Step 5: Update integration tester page

Read `inputSchema` from the catalog. Generate form fields from JSON Schema properties. Pre-fill from defaults.

## Migration Strategy

- Add `zod` as a dependency of the API worker (it's already in the monorepo via Better Auth)
- Add `zod-to-json-schema` for catalog generation
- Migrate endpoints one at a time — schema is optional
- Start with the most-used: openai, anthropic, websearch, freepik
- Dispatch an agent to migrate the rest in one pass

## Dependencies

- `zod` — already in the monorepo
- `zod-to-json-schema` — small, zero-dep

## Effort

- Step 1-3: 30 minutes (infrastructure)
- Step 4: 30 minutes (catalog)
- Step 5: 1 hour (form generation)
- Per-endpoint migration: 5 minutes each, ~30 endpoints = 2-3 hours total (agent task)
