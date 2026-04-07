# Frontend Reorganization Plan (Full — saved for reference)

This is the full frontend plan saved before narrowing scope to the folder restructuring phase.

See `backend-do-reorganization.md` for the backend DO refactoring prompt.

---

## Context

The DeepSpace SDK currently delivers "features" (chat, leaderboard, collaborative docs, etc.) by copying source files into apps via a scaffolder script (`add-feature.cjs`). This approach disconnects features from the SDK (no updates), uses fragile regex to wire schemas, requires manual route wiring, and cannot handle backend code (DOs, worker routes). LLMs can't easily add features because the process involves multiple manual steps.

**Goal:** Features become importable SDK modules with three usage tiers: Import (zero config), Configure (props/overrides), Eject (copy source, full ownership). Both frontend (React components + hooks) and backend (DO classes + handlers) are covered.

## Package Structure Decision

Everything in one package: `deepspace`. Two entry points:
- `deepspace` — all client exports (hooks, components, pages, UI primitives)
- `deepspace/worker` — all server exports (rooms, schemas, handlers, auth)

Flat exports, tree-shakeable. No subpaths needed. Developers import by name.

```ts
import { useQuery, ChatPage, KanbanBoard, Button, AppSidebar } from 'deepspace'
import { RecordRoom, GameRoom, messagingSchemas } from 'deepspace/worker'
```

## Internal Folder Structure

```
src/
  index.ts                      # client barrel
  worker.ts                     # server barrel

  # Shared
  types/
  env/

  # Core client
  auth/
  storage/
  platform/
  theme/
  app-context.tsx

  # Core server
  rooms/
  schemas/
  handlers/
  server-auth/
  protocol/

  # UI primitives
  ui/

  # Features (client + server colocated per domain)
  features/
    messaging/
    collaboration/
    game/
    media/
    data/
    admin/
    nav/
    layout/
    cron/

  # CLI
  cli/
```

## DeepSpaceAppProvider

Context provider for app-specific values that features need.
- `DeepSpaceAppProvider` — provides `appName`, `schemas`, `roles`, `roleConfig`
- `useAppConfig()` — consumes the context
- Standard role constants: `ROLES`, `ROLE_CONFIG`, `Role` type

## Features

Delete `packages/create-deepspace/features/` entirely (last step). Rebuild each feature from scratch in the SDK with consistent patterns. Old code is reference only.

### Consistent feature pattern

Every feature follows the same structure:
```
features/<domain>/
  index.ts              # client barrel
  worker.ts             # server barrel (if has schemas)
  schemas.ts
  components/
  hooks/
  types.ts
```

Every page component follows the same prop convention:
```tsx
interface FooPageProps {
  showHeader?: boolean
  pageTitle?: string
  renderItem?: (item: FooItem) => ReactNode
  renderEmptyState?: () => ReactNode
  className?: string
}
```

### Feature domains

- messaging — human chat, multi-channel
- collaboration — yjs-doc, teams, canvas
- game — game state, lobby
- media — WebRTC signaling
- data — items-crud, leaderboard, tasks
- admin — admin-page, permissions
- nav — sidebar, topbar, tree
- layout — app-shell, landing-page
- cron — scheduled tasks

## Eject System

`npx deepspace eject <feature>` — copies source, rewrites imports, full ownership.
`npx deepspace add <feature>` — wires schema imports, prints route instructions.

Ship raw source in npm package: `"files": ["dist", "src/features"]`

## Dynamic DO Registration

`__DO_MANIFEST__` export in worker.ts. CLI extracts at build time. Deploy worker creates bindings/migrations dynamically. See backend-do-reorganization.md.
