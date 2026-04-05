# Messaging

Channel-based messaging with reactions and membership

Real-time channels with messages, emoji reactions, and member tracking. Each channel runs in its own Durable Object for isolation and lazy loading.

## Files

Copy from `src/` in this directory to the app:

- `messaging-schemas.ts` → `src/schemas/messaging-schemas.ts`
- `MessagingPage.tsx` → `src/pages/MessagingPage.tsx`

## Wiring

1. Add to schemas.ts:
   ```ts
   import { messagingSchemas } from './schemas/messaging-schemas'
   ```
2. Spread into schemas array:
   ```ts
   export const schemas = [...existingSchemas, ...messagingSchemas]
   ```
3. Add to App.tsx:
   ```ts
   import { MessagingPage } from './pages/MessagingPage'
   ```
4. Add route:
   ```tsx
   <Route path="/messaging" element={<MessagingPage />} />
   ```
5. Add navigation link for '/messaging'

## Architecture

- Channel list lives in the app's main DO (`app:{appId}`)
- Each channel's messages live in a separate DO (`chat:{channelId}`), loaded lazily when opened
- All DOs share the same schemas — unused tables cost nothing
