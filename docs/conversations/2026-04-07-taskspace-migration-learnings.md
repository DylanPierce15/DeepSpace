# 2026-04-07: Taskspace Migration — Porting a Miyagi3 App to DeepSpace SDK

## Context

Migrated the "taskspace" task manager from the old Miyagi3 / `@spaces/sdk` architecture to the new DeepSpace SDK. The app is a full-featured Things-like task manager with sidebar navigation, list/kanban views, projects, tags, user assignment, drag-and-drop, mobile responsive design, and inline editing.

Source: `old-code/` (Miyagi3) → `src/` (DeepSpace)

---

## Key Architectural Differences

### 1. Team scoping → Room scoping

**Old**: Tasks, projects, and tags lived in `workspace:default` (a shared multi-tenant connection). Each record had a `TeamId` field. The app used `useTeams()` to manage team membership, and client-side filtering by `TeamId` to show per-team data. There was a whole team onboarding flow (create/join team), team settings modal, and team selector in the sidebar.

**New**: The DeepSpace room IS the scope. Every user in the room sees the same data. No `TeamId` field needed. No team management UI needed. This eliminated ~5 components (`TeamOnboarding`, `TeamSelector`, `TeamSettings`, `UserManagement`, `UserIdentity`) and ~200 lines from the main page.

**Implication for SDK**: Apps that previously used teams-as-tenants within a shared workspace now get isolation for free from DeepSpace's room model. The migration path is: remove TeamId from schemas and records, remove team management UI, remove client-side team filtering. The data access patterns (useQuery/useMutations) stay identical.

### 2. Schema definition changes

**Old** (`@spaces/sdk/worker`):
```ts
const schema: CollectionSchema = {
  name: 'tasks',
  fields: { ...USERS_COLLECTION_FIELDS, Title: { type: 'text' }, ... },
  permissions: { ... }
}
```
Used `fields` with a `{ type }` shape. JSON columns used `type: 'json'`.

**New** (`deepspace/worker`):
```ts
const schema: CollectionSchema = {
  name: 'tasks',
  columns: [
    { name: 'Title', storage: 'text', interpretation: 'plain' },
    { name: 'AssignedUser', storage: 'text', interpretation: 'json' },
  ],
  permissions: { ... }
}
```
Uses `columns` array with explicit `storage` (only `'text'` or `'number'`) and `interpretation`. JSON data must use `storage: 'text', interpretation: 'json'` — there is no `storage: 'json'` type. TypeScript correctly catches this.

### 3. Auth flow

**Old**: Clerk JWT verification in the worker. `App.tsx` had a team gating flow: anonymous → sign-in prompt → no teams → team onboarding → app. The `@spaces/sdk` provided `AppSwitcherTrigger` for navigation between apps.

**New**: Better Auth via `DeepSpaceAuthProvider`. The scaffolded template provides `AuthOverlay` and a `Navigation` component with sign-in/sign-out buttons.

**Resolved**: When the app replaces the scaffolded `Navigation` with its own sidebar, the sign-in trigger disappears. The fix is straightforward — import `AuthOverlay` and `signOut` from `deepspace`, then wire them into your custom UI. In taskspace this meant: a "Sign in" button in the sidebar footer (anonymous users) that opens `<AuthOverlay />`, a "Sign in" button in the `ReadOnlyBanner`, and user avatar + sign-out button in the sidebar footer (authenticated users). The `ReadOnlyBanner` was also split into two modes (`anonymous` vs `viewer`) with different messaging. The pattern is: `const [showAuth, setShowAuth] = useState(false)` → button `onClick={() => setShowAuth(true)}` → `{showAuth && <AuthOverlay onClose={() => setShowAuth(false)} />}`.

### 4. Import paths

| Old | New |
|-----|-----|
| `@spaces/sdk/storage` | `deepspace` |
| `@spaces/sdk/worker` | `deepspace/worker` |
| `@spaces/sdk/app-switcher` | removed (no equivalent) |
| `@spaces/sdk/mobile` | custom `useIsMobile()` hook |
| `@miyagi/auth` | handled by SDK internally |
| `__APP_ID__` | `APP_NAME` constant |

### 5. User data hooks

**Old**: `useUser()` from `@spaces/sdk/storage` returns `{ user, isLoading }`. `useUserLookup()` for resolving user info by ID. Users came from team membership.

**New**: `useUser()` from `deepspace` returns `{ user, isLoading }` — same interface. `useUsers()` returns all room members. No `useUserLookup()` found in usage — `useUsers()` covers the same need.

### 6. Worker architecture

**Old**: Raw fetch handler with manual routing, Clerk JWT verification, platform worker proxy, R2 file handler, action handler, cron handler — all hand-wired.

**New**: Hono-based worker with declarative routes. Auth, WebSocket, actions, files, cron all handled by SDK functions. DO manifest declares rooms. The scaffolded worker is complete and correct — no old worker code needed to be merged (the old app's actions and cron handlers were empty).

---

## Migration Mechanics

### What transferred cleanly (copy + search-replace)

- **All hooks** except `useTaskData` — `useTaskSelection`, `useDragDrop`, `useMouseDragResize`, `useTaskHotkeys`, `useBodyBackground` had zero SDK imports, just React + app constants.
- **All utils** — `computeDisplayedTasks`, `icons`, `toggleNullableMultiSelect`, `styles` (inline CSS-in-JS).
- **Most components** — `TaskList`, `TaskItem`, `TaskDetail`, `QuickAdd`, `BulkActionBar`, `KanbanBoard`, `KanbanCardModal`, `ViewHeader`, `Toolbar`, `CustomDropdown`, `ConfirmModal`, `ReadOnlyBanner`. These used app-level imports only, no SDK imports.
- **UI components** — `Calendar`, `DatePicker`, `TimePicker`, `DateTimePicker`, `Popover` from the old `ui/` directory (not available in the scaffolded SDK UI library).

### What needed rewriting

- **`useTaskData`** — Removed `teamId` parameter and `TeamId` field from all record operations. Changed `useQuery`/`useMutations` import from `@spaces/sdk/storage` to `deepspace`. Otherwise the hook logic (PascalCase ↔ camelCase mapping, refs for stable callbacks, derived data) stayed identical.
- **`Sidebar`** — Removed `AppSwitcherTrigger` import, `TeamSelector` component, team-related props, and team type definitions. Replaced `AppSwitcherTrigger` with a plain `<span>` for the app title.
- **`HomePage`** — Major rewrite. Removed: team gating logic, `useTeams()`, team member management, `TeamSettings` modal, `onAddMember`/`onRemoveMember` callbacks, team selector props passed to Sidebar. Added: `useUsers()` for room member list. The core task management logic (CRUD, views, filters, sort, drag-drop, keyboard shortcuts) transferred verbatim.
- **`_app.tsx`** — Removed `Navigation` component. Task manager fills the entire viewport with its own layout.

### What was dropped entirely

- `App.tsx` (team gating shell) — replaced by `_app.tsx` auth gate
- `TeamOnboarding.tsx` — no teams concept
- `TeamSelector.tsx` — no teams
- `TeamSettings.tsx` — no teams
- `UserManagement.tsx` — user management is now at the DeepSpace platform level
- `UserIdentity.tsx` — replaced by sidebar header
- `chat-mount.tsx` — chat integration not ported
- `AppShell.tsx` — replaced by `_app.tsx`

---

## TypeScript Issues Encountered

1. **`storage: 'json'` not valid** — DeepSpace `CollectionSchema` only allows `'text'` or `'number'` for storage. JSON columns must use `storage: 'text', interpretation: 'json'`.

2. **`@radix-ui/react-popover` not installed** — The old app's `Popover.tsx` component depends on this. The scaffolded app didn't include it. Fix: `npm install @radix-ui/react-popover`.

3. **`process.env.NODE_ENV`** — Not available in Vite. Replace with `import.meta.env?.DEV`.

4. **Optional drag handler callbacks** — The `dragHandlers` object has optional callbacks (`onDragStart?`, etc.) but the old code invoked them without `?.`. TypeScript strict mode caught this.

---

## Testing Observations

- The scaffolded smoke tests check for `[data-testid="app-navigation"]` — any app that replaces the Navigation component will break these tests. Tests should be updated to check for app-specific elements.
- Vite's "Outdated Optimize Dep" 504 errors appear transiently after installing new npm packages. The error filter in `tests/helpers/errors.ts` should include this pattern.
- Task CRUD tests need unique task names (timestamps) because the RecordRoom persists data across test runs within the same worker instance.
- Auto-selection after task creation means the detail panel opens immediately — tests shouldn't click the task again to "select" it.

---

## Recommendations for the SDK / Migration Guide

1. **Document the custom-nav auth pattern**: When apps replace `Navigation` with custom UI, they need to wire up `AuthOverlay` and `signOut` themselves. The taskspace fix is a good reference pattern — sidebar footer with sign-in/sign-out, `ReadOnlyBanner` with contextual sign-in. The migration guide should show this pattern.

2. **Document schema storage types**: Make it explicit that `storage` only accepts `'text'` or `'number'`, and that JSON must use `interpretation: 'json'`.

3. **Provide `useIsMobile()`**: The old SDK exported `useIsMobile` from `@spaces/sdk/mobile`. DeepSpace doesn't have an equivalent. Consider adding it to the SDK or documenting the one-liner replacement.

4. **`getUserColor()` helper**: The old SDK exported `getUserColor(userId, palette)` from `@spaces/sdk/storage`. This is a pure function that deterministically assigns colors to user IDs. Consider re-exporting it from `deepspace`.

5. **Update scaffolded test selectors**: The smoke tests should use more generic selectors (e.g., `#root`, `body`) rather than `app-navigation` which breaks when apps customize the layout.

6. **Add `allowAnonymous` to RecordScope docs**: The task manager needs anonymous read access. The scaffolded template has `allowAnonymous` on `RecordProvider` but not `RecordScope`. Document when each is needed.
