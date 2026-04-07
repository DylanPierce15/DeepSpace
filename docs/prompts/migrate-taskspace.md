# Migrate Taskspace to DeepSpace SDK Architecture

You are working in the `taskspace` repo at `~/GitHub/taskspace`. This is a task manager app being migrated from the old Miyagi3 architecture to the new DeepSpace SDK.

## CRITICAL: 100% UI/UX Fidelity

The migrated app must look and behave identically to the original. The UI, layout, interactions, and visual design should match. Changes are expected for:

- Import paths (`@spaces/sdk` → `deepspace`)
- Auth flow (old Clerk → new Better Auth via DeepSpace SDK)
- Routing structure (old manual routes → generouted file-based)
- App shell/providers (`AppShell.tsx` → `_app.tsx`)
- Any improvements you identify, as long as the user-facing experience stays the same

**Prefer copying over rewriting.** Use `cp` to copy files from `old-code/`, then make targeted edits for import paths and auth hooks. Only rewrite a component if the architectural differences make a copy-and-edit impossible (e.g., the old `App.tsx` routing logic needs to become generouted pages). For pure UI components (TaskList, KanbanBoard, Sidebar, etc.), always copy — never rewrite from scratch.

## Repo Structure

- `src/` — freshly scaffolded DeepSpace app (generouted routing, `_app.tsx`, `nav.ts`)
- `old-code/` — the original Miyagi3 task manager source (reference only, do not modify)
- `worker.ts` — scaffolded worker template
- `tests/` — Playwright smoke tests (4 passing)

## Step 1: Understand the DeepSpace SDK

Before writing any code, send an Explore agent to `~/GitHub/deepspace-sdk` to understand:

1. **How the template app is structured** — read:
   - `packages/create-deepspace/templates/starter/src/pages/_app.tsx` (providers + nav)
   - `packages/create-deepspace/templates/starter/src/nav.ts` (navigation config)
   - `packages/create-deepspace/templates/starter/src/pages/home.tsx` (example page)
   - `packages/create-deepspace/templates/starter/worker.ts` (worker routes)
   - `packages/create-deepspace/templates/starter/src/schemas.ts` (schema registry)

2. **SDK imports** — what's available from `deepspace` and `deepspace/worker`:
   - `packages/deepspace/src/client/auth/index.ts` (useAuth, signOut, AuthOverlay)
   - `packages/deepspace/src/client/storage/index.ts` (useQuery, useMutations, RecordProvider, RecordScope)
   - `packages/deepspace/src/client/storage/hooks/useUser.ts` (useUser)
   - `packages/deepspace/src/shared/env/index.ts` (ROLES, ROLE_CONFIG)

3. **Routing convention** — generouted file-based routing:
   - `src/pages/*.tsx` → automatic routes (default exports required)
   - `src/pages/_app.tsx` → global wrapper (NOT `_layout.tsx` at root)
   - `src/pages/[...all].tsx` → 404 catch-all
   - `src/pages/<feature>/index.tsx` + `src/pages/<feature>/[id].tsx` → nested routes
   - `src/nav.ts` → nav items (separate from routing)

4. **UI components** — the SDK exports UI components. Read:
   - `packages/deepspace/src/ui/index.ts` to see what's available (Button, Modal, Badge, EmptyState, etc.)
   - The scaffolded app already has `src/components/ui/` with additional components

## Step 2: Understand the Old App

Read the old code in `old-code/` to understand:

1. **`old-code/src/constants.ts`** — app constants, views, task status, priorities, kanban status
2. **`old-code/src/schemas.ts`** — data schemas (users only — tasks/projects/tags use workspace scope)
3. **`old-code/src/App.tsx`** — the main app component (views, navigation, routing)
4. **`old-code/src/hooks/`** — custom hooks (useTaskData, useTaskSelection, useDragDrop, etc.)
5. **`old-code/src/components/`** — all UI components (TaskList, TaskDetail, KanbanBoard, Sidebar, etc.)
6. **`old-code/src/utils/`** — utility functions
7. **`old-code/src/styles.css`** — custom CSS

Key differences to note:
- Old app imports from `@spaces/sdk` → new app imports from `deepspace`
- Old app uses `__APP_ID__` → new app uses `APP_NAME` from constants
- Old app has `App.tsx` + `AppShell.tsx` + manual routes → new app uses generouted `_app.tsx` + file-based pages
- Old app has custom UI components in `src/components/ui/` → new app can use SDK components from `deepspace`

## Step 3: Migration Strategy

Migrate iteratively — one piece at a time, testing after each step:

### Phase 1: Foundation
1. Copy `old-code/src/constants.ts` → `src/constants.ts` (merge with scaffolded constants, fix imports)
2. Copy `old-code/src/schemas.ts` → `src/schemas.ts` (update imports from `@spaces/sdk/worker` to `deepspace/worker`)
3. Copy styles: merge `old-code/src/styles.css` into `src/styles.css`
4. Run `npx deepspace test smoke` — all 4 must pass

### Phase 2: Hooks and Utils
5. Copy `old-code/src/hooks/` → `src/hooks/` (update all `@spaces/sdk` imports to `deepspace`)
6. Copy `old-code/src/utils/` → `src/utils/`
7. Run `npx deepspace test smoke` — must pass

### Phase 3: Components
8. Copy `old-code/src/components/` → `src/components/` (EXCEPT `ui/` — use scaffolded UI components)
9. Update all imports in copied components:
   - `@spaces/sdk` → `deepspace`
   - `@spaces/sdk/worker` → `deepspace/worker`
   - Relative paths from old structure → new structure
10. For any old `ui/` components not available in the SDK, copy those specific ones
11. Run `npx deepspace test smoke` — must pass

### Phase 4: Pages
12. Create the main task page at `src/pages/home.tsx` (replace scaffolded home with the task manager UI)
13. If the app has sub-pages, create them under `src/pages/`
14. Update `src/nav.ts` with task-specific navigation
15. Run `npx deepspace test smoke` — must pass

### Phase 5: Worker
16. Compare `old-code/worker.ts` with scaffolded `worker.ts`
17. If the old worker has custom routes (actions, cron), merge them into the scaffolded worker
18. Do NOT change DO bindings, asset config, or auth — the scaffolded worker handles those correctly

### Phase 6: Tests
19. Write Playwright tests that verify the task manager works:
    - Create a test user, sign in
    - Create a task
    - Verify it appears in the list
    - Mark it complete
    - Delete it
20. Run the full test suite: `npx deepspace test e2e`

## Important Rules

1. **Never deploy.** Do not run `deepspace deploy`, `wrangler deploy`, or any command that touches Cloudflare.
2. **Never modify `old-code/`.** It's read-only reference.
3. **Test after every phase.** Run `npx deepspace test smoke` after each phase. If tests fail, fix before proceeding.
4. **Use SDK imports.** Import from `deepspace` and `deepspace/worker`, not from the old `@spaces/sdk`.
5. **Default exports for pages.** All page components in `src/pages/` must use `export default function`.
6. **Don't duplicate UI components.** Use `Button`, `Modal`, `Badge`, `EmptyState` etc. from `deepspace`. Only copy old UI components if there's no SDK equivalent.
7. **Keep the scaffolded `_app.tsx`.** Don't replace it with the old `AppShell.tsx` — adapt the old app's content to work within the new provider structure.
8. **Keep the scaffolded `worker.ts`.** Don't replace it — only add custom routes if the old worker had them.

## Testing

Run tests with:
```bash
npx deepspace test smoke     # quick check (4 tests)
npx deepspace test e2e       # all Playwright tests
npx deepspace test            # default (smoke + api)
```

The Playwright tests auto-start a Vite dev server. Tests create real accounts on the dev auth worker — no mock auth needed.

Test helpers are in `tests/helpers/auth.ts`:
```ts
import { signUp, createTestUsers } from './helpers/auth'
```

## Dev Server

To manually test in the browser:
```bash
npx deepspace dev
```
Opens at `http://localhost:5173`. Uses dev auth workers (free accounts).

## What Success Looks Like

1. The task manager UI renders with all views (All, Today, Upcoming, Logbook, Trash)
2. Users can sign in, create/edit/delete tasks
3. Kanban board works with drag-and-drop
4. Projects and tags work
5. All smoke tests pass
6. Custom Playwright tests verify core task CRUD
7. `old-code/` can be deleted
