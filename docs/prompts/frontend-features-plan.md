# Plan: Frontend Reorganization — Importable Features

## Context

This is the frontend half of the SDK reorganization. The backend half (BaseRoom extraction, new DO templates, deploy manifest system) is defined in `prompts/backend-do-reorganization.md` and will be handled separately.

**Problem:** Features are copied as source files into apps via `add-feature.cjs`. This disconnects them from the SDK, uses fragile regex to wire schemas, requires manual route wiring, and makes it hard for LLMs to add features.

**Goal:** Features become importable SDK modules with three usage tiers: Import (zero config), Configure (props/overrides), Eject (copy source, full ownership). Both frontend (React components + hooks) and backend (DO classes + handlers) are covered.

---

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

---

## Part 1: Ship UI primitives in SDK (`src/ui/`)

Move the 26 UI components from the starter template into the SDK.

**Source:** `packages/create-deepspace/templates/starter/src/components/ui/`
**Destination:** `packages/deepspace/src/ui/`

**Files to create:**
- `packages/deepspace/src/ui/index.ts` — barrel export
- Copy all 26 components: Alert, Avatar, Badge, Button, Card, CardGrid, Checkbox, Dialog, DropdownMenu, EmptyState, Input, Label, Modal, Progress, SearchInput, Select, Separator, Skeleton, Switch, Table, Tabs, Textarea, Toast, Tooltip, utils (cn)

**Package** (`packages/deepspace/package.json`):
- Add peer deps for Radix, CVA, clsx, tailwind-merge

**Template update:**
- `templates/starter/src/components/ui/index.ts` → `export * from 'deepspace'` (UI re-exported from main barrel)
- Remove 25 individual component files from template

---

## Part 2: `DeepSpaceAppProvider`

Context provider for app-specific values that features need.

**New file:** `packages/deepspace/src/app-context.tsx`
- `DeepSpaceAppProvider` — provides `appName`, `schemas`, `roles`, `roleConfig`
- `useAppConfig()` — consumes the context
- Standard role constants: `ROLES`, `ROLE_CONFIG`, `Role` type

Export from `packages/deepspace/src/index.ts`.

**Template update:**
- `templates/starter/src/AppShell.tsx` — wrap in `<DeepSpaceAppProvider>`
- `templates/starter/src/constants.ts` — re-export `ROLES`, `ROLE_CONFIG` from `deepspace`

---

## Part 3: Rebuild Features in SDK

Delete `packages/create-deepspace/features/` entirely (as last step). Rebuild each feature from scratch in the SDK with consistent, SDK-quality patterns. The old feature code is reference material only.

### 3A. Consistent feature pattern

Every feature follows the same structure:
```
features/<domain>/<feature-name>/
  index.ts              # client barrel: components, hooks, types
  worker.ts             # server barrel: schemas, constants (only if feature has schemas)
  schemas.ts            # CollectionSchema definitions
  components/           # React components
  hooks/                # Custom hooks specific to this feature
  types.ts              # Feature-specific TypeScript types
```

Every feature's `index.ts` exports in consistent layers:
```ts
export { fooSchemas } from './schemas'
export { useFoo } from './hooks/useFoo'
export { FooPage } from './components/FooPage'
export { FooList } from './components/FooList'
export type { FooConfig, FooItem } from './types'
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

### 3B. Features to rebuild (by domain)

**messaging/** — human chat, AI assistant
- messaging — real-time chat with threads, reactions, presence
- multi-channel — multi-channel groups, DMs, member management
- assistant — AI chat (new)

**collaboration/** — real-time collaborative editing
- yjs-doc — collaborative document editing
- teams — team collaboration with Yjs docs
- canvas — spatial canvas (new, with CanvasRoom DO)

**game/** — gaming
- game — lobby, state, tick loop (new, with GameRoom DO)

**media/** — WebRTC
- media — signaling, video/audio (new, with MediaRoom DO)

**data/** — CRUD patterns
- items-crud — basic CRUD with ownership and RBAC
- leaderboard — score-based ranking
- tasks-claimable — claimable task assignment

**admin/** — administration tools
- admin-page — user management and app settings
- permissions — auto-generated RBAC permission matrix viewer

**nav/** — navigation components
- sidebar-nav — collapsible sidebar navigation
- sidebar-tree — tree-based navigation with drag-and-drop
- topbar-nav — horizontal top navigation

**layout/** — app shells and landing pages
- layout-sidebar — app shell compound component
- landing-page — landing page kit with section components

**cron/** — scheduled tasks (new, with CronRoom DO)
- cron — scheduled task execution and monitoring

### 3C. Quality standards

- All components use SDK UI primitives — no inline UI reimplementation
- All app-specific values via `useAppConfig()` — no hardcoded roles, app names, or schema imports
- Proper TypeScript: exported types for all props, generic hooks where applicable
- No dead code, no commented-out code
- Consistent naming: `use<Feature><Thing>` for hooks, `<Feature>Page` for pages
- Each feature's schemas exported as both individual constants and a spread-ready array

### 3D. CSS strategy

- Most features: pure Tailwind classes, no changes needed
- Small CSS (chat, multi-channel): convert to injected `<style>` tags in components
- Large CSS (sidebar-nav, landing-page): ship as importable CSS files

---

## Part 4: Eject System

### 4A. Ship raw source for ejection

**`package.json`:**
```json
"files": ["dist", "src/features", "src/ui"]
```

### 4B. CLI `eject` command

**New file:** `packages/deepspace/src/cli/commands/eject.ts`

```bash
npx deepspace eject <feature-id> [--deep] [--client] [--worker]
```

Algorithm:
1. Locate source in `node_modules/deepspace/src/features/<domain>/<id>/`
2. Copy to `src/features/<id>/` in the app
3. Rewrite imports (SDK → local, keep core SDK imports)
4. Scan app source for SDK imports of this feature → rewrite to local
5. Print summary

### 4C. CLI `add` command

**New file:** `packages/deepspace/src/cli/commands/add.ts`

```bash
npx deepspace add <feature-id>
```

Algorithm:
1. Add schema import to `src/schemas.ts`
2. Print route/nav wiring instructions
3. No file copying — just wires imports to SDK modules

---

## Part 5: Scaffold/Template Updates

- Remove `src/components/ui/*.tsx` — replaced by re-export from SDK
- `src/constants.ts` imports roles from `deepspace`
- `src/AppShell.tsx` wraps in `<DeepSpaceAppProvider>`
- Scaffolder stops copying `.deepspace/features/`
- Delete `packages/create-deepspace/features/` entirely (last step)
- Delete `packages/create-deepspace/scripts/add-feature.cjs`

---

## Implementation Order

1. Folder restructure of `packages/deepspace/src/` (separate task — see current plan)
2. `deepspace` UI primitives — copy components into `src/ui/`
3. `DeepSpaceAppProvider` — context + role constants
4. Rebuild pure UI features — kanban, nav, layout
5. Rebuild data features — items-crud, leaderboard, tasks
6. Rebuild complex features — messaging, collaboration, admin
7. CLI `add` + `eject` commands
8. Template updates
9. Delete old feature system (last)

---

## Verification

1. `pnpm build` — all entry points compile
2. Flat imports resolve: `import { Button, ChatPage, useQuery } from 'deepspace'`
3. Worker imports resolve: `import { RecordRoom, messagingSchemas } from 'deepspace/worker'`
4. `npm create deepspace test-app` works
5. `npx deepspace add items-crud` wires schema correctly
6. `npx deepspace eject messaging` copies source, app compiles
7. `./scripts/test-local.sh` passes
