# Backend Task: Durable Object Reorganization

## Objective

Reorganize the DeepSpace SDK's Durable Object architecture by extracting a `BaseRoom` class from the existing `RecordRoom`, then building new pre-built DO templates on top of it. Also implement a dynamic DO manifest system so the deploy pipeline supports arbitrary DO classes without hardcoded bindings.

## Current State

### Existing DO Classes

**RecordRoom** (`packages/deepspace/src/runtime/record-room.ts`)
- The primary DO. Handles: WebSocket upgrade + hibernation, connection tracking, JWT auth from URL params, message routing (JSON + binary), SQLite persistence with typed collection tables (`c_*`), RBAC permission system, query-based subscriptions, record CRUD with broadcast, Yjs collaborative fields (`yjs_docs` table), user registration + presence (`lastSeenAt`), team membership.
- Constructor: `(state: DurableObjectState, env, schemas: CollectionSchema[], config: RecordRoomConfig)`
- Exported from `deepspace/worker` via `packages/deepspace/src/runtime/index.ts`

**YjsRoom** (`packages/deepspace/src/runtime/yjs-room.ts`)
- Lightweight DO for standalone collaborative documents. One DO per document.
- Handles: WebSocket upgrade, binary Yjs sync protocol (MSG_SYNC, MSG_AWARENESS), single `yjs_state` SQLite table, role-based write access, awareness broadcast.
- Constructor: `(state: DurableObjectState, env)`
- No schemas, no RBAC, no queries.

### How DOs Are Wired Today (all hardcoded)

1. **Worker template** (`packages/create-deepspace/templates/starter/worker.ts`):
   - Thin subclasses: `export class AppRecordRoom extends RecordRoom { ... }` and `export class AppYjsRoom extends YjsRoom {}`
   - Hono routes: `/ws/:roomId` → RECORD_ROOMS DO, `/yjs/:docId` → YJS_ROOMS DO
   - Auth verified at edge, user info passed to DO via URL search params

2. **wrangler.toml** (`packages/create-deepspace/templates/starter/wrangler.toml`):
   - `[durable_objects] bindings` array with RECORD_ROOMS and YJS_ROOMS
   - `[[migrations]]` blocks with sequential tags (v1, v2), `new_sqlite_classes`

3. **Deploy worker** (`platform/deploy-worker/src/lib/cloudflare-deploy.ts`):
   - Lines 70-86: Hardcoded migration check for RECORD_ROOMS and YJS_ROOMS
   - Lines 159-189: Hardcoded metadata with `migrations.new_sqlite_classes: ['AppRecordRoom', 'AppYjsRoom']` and static binding list
   - Single migration tag `v2` bundling all classes

4. **CLI deploy** (`packages/deepspace/src/cli/commands/deploy.ts`):
   - Bundles worker.ts with esbuild, POSTs to deploy worker
   - Zero awareness of DO classes — just bundles and uploads

### Message Protocol (`packages/deepspace/src/runtime/constants.ts`)

```
MSG_SUBSCRIBE=1, MSG_UNSUBSCRIBE=2, MSG_QUERY_RESULT=3, MSG_RECORD_CHANGE=4,
MSG_PUT=5, MSG_DELETE=6, MSG_USER_INFO=8, MSG_USER_LIST=9, MSG_SET_ROLE=10,
MSG_YJS_JOIN=20, MSG_YJS_LEAVE=21, MSG_ACK=31, MSG_LIST_SCHEMAS=32, MSG_RESUBSCRIBE=33
```

### Handler Pattern (`packages/deepspace/src/runtime/handlers/`)

Handlers receive typed contexts with shared resources:
- `subscriptions.ts` — query execution with permission filtering
- `records.ts` — create/update/delete with validation and broadcast
- `yjs.ts` — Yjs doc lifecycle, persistence, sync protocol
- `users.ts` — user registration, profile updates, role assignments
- `debug-api.ts` — HTTP `/api/*` endpoints
- `tools-api.ts` — server actions

### Cron System (to be replaced)

Currently `packages/create-deepspace/features/cron-schedule/` is a feature that copies `cron.json` + `cron.ts` into the app. It uses RecordRoom's alarm to trigger scheduled tasks. This should become a proper `CronRoom` DO.

### Client Hooks (`packages/deepspace/src/storage/hooks/`)

- `useQuery.ts` — query subscriptions via RecordRoom WebSocket
- `useMutations.ts` — record CRUD via RecordRoom WebSocket  
- `usePresence.ts` — connected users + awareness state
- `useUsers.ts` — user list from RecordRoom
- `useYjs.ts` — Yjs field collaboration within RecordRoom
- `useYjsRoom.ts` — standalone YjsRoom connection
- `useTeams.ts` — team membership management

## Target Architecture

### New Class Hierarchy

```
BaseRoom (WebSocket, connections, auth, presence, message dispatch, raw SQLite access)
  ├── RecordRoom    — structured data, RBAC, queries, subscriptions, Yjs fields
  ├── YjsRoom       — single collaborative document
  ├── CanvasRoom    — spatial canvas (tldraw-style objects, viewport awareness)
  ├── GameRoom      — authoritative tick loop, player input, state broadcast
  ├── MediaRoom     — WebRTC signaling relay (ephemeral, no persistence)
  └── CronRoom      — scheduled task execution (replaces cron.ts feature)
```

### BaseRoom Design

Extract from RecordRoom the functionality that every room needs:

**Must include:**
- WebSocket upgrade with hibernation API (`webSocketMessage`, `webSocketClose`, `webSocketError`)
- Connection tracking: map of WebSocket → user attachment (userId, userName, userEmail, userImageUrl)
- Auth: parse JWT-verified user info from URL search params (the edge worker verifies the JWT; the DO receives userId, userName, etc. as URL params)
- Presence: awareness broadcast when users connect/disconnect, `getConnectedUsers()`
- Message routing: JSON parse → dispatch by `type` field. Binary message hook for subclasses that need it.
- Raw SQLite access via `this.state.storage.sql`
- Broadcast helpers: `broadcast(message, exclude?)`, `sendTo(ws, message)`
- HTTP fetch handler with WebSocket upgrade detection

**Must NOT include (stays in RecordRoom):**
- Schema registry, collection tables, RBAC permissions
- Query subscriptions (MSG_SUBSCRIBE, MSG_QUERY_RESULT, MSG_RECORD_CHANGE)
- Record CRUD (MSG_PUT, MSG_DELETE)
- User collection management (registerUser, role assignment)
- Yjs field sync (MSG_YJS_JOIN/LEAVE, yjs_docs table)

**Lifecycle hooks for subclasses to override:**
```ts
abstract class BaseRoom {
  // Called when a new WebSocket connects (after auth)
  protected onConnect(ws: WebSocket, user: UserAttachment): void | Promise<void>
  
  // Called for each JSON message
  protected onMessage(ws: WebSocket, user: UserAttachment, message: { type: number; [key: string]: any }): void | Promise<void>
  
  // Called for binary messages (Yjs, custom binary protocols)
  protected onBinaryMessage?(ws: WebSocket, user: UserAttachment, data: ArrayBuffer): void | Promise<void>
  
  // Called when a WebSocket disconnects
  protected onDisconnect(ws: WebSocket, user: UserAttachment): void | Promise<void>
  
  // Called for HTTP requests that are NOT WebSocket upgrades
  protected onRequest?(request: Request): Response | Promise<Response>
  
  // Called on DO alarm
  protected onAlarm?(): void | Promise<void>
}
```

### RecordRoom Refactor

RecordRoom extends BaseRoom and implements `onConnect`, `onMessage`, `onBinaryMessage`, `onDisconnect` to wire up its existing handler system. All existing functionality is preserved. The refactor should be purely structural — zero behavioral changes.

Key constraint: RecordRoom's existing API (constructor signature, message protocol, handler system) must not change. Apps extending RecordRoom today must continue to work without modification.

### YjsRoom Refactor

YjsRoom extends BaseRoom instead of implementing its own WebSocket handling. The binary Yjs protocol moves into `onBinaryMessage`. Connection attachment becomes BaseRoom's user attachment.

### New Room Templates

**GameRoom:**
- Extends BaseRoom
- SQLite table for game state
- Alarm-based tick loop with configurable interval
- Player management (join, leave, ready state)
- Input collection per tick, authoritative state computation
- State broadcast to all connected players
- Lifecycle: `onTick(state, inputs)`, `onPlayerJoin(player)`, `onPlayerLeave(player)`, `onGameStart()`, `onGameEnd()`
- Exported from `deepspace/worker`
- Client hook: `useGameRoom(roomId)` → `{ state, sendInput, players, connected }`

**CanvasRoom:**
- Extends BaseRoom with Yjs backing (Y.Map of shape objects)
- Spatial operations: add/move/resize/delete shapes
- Viewport awareness (each user's visible region)
- Shape-level collaboration (multiple users editing different shapes)
- Undo/redo stack per user
- Exported from `deepspace/worker`
- Client hook: `useCanvas(roomId)` → `{ shapes, addShape, moveShape, deleteShape, viewports }`

**MediaRoom:**
- Extends BaseRoom
- NO SQLite persistence (purely ephemeral signaling)
- WebRTC signaling: relay SDP offers/answers, ICE candidates
- Room membership tracking (who's in the call)
- Simple message types: OFFER, ANSWER, ICE_CANDIDATE, JOIN, LEAVE
- Exported from `deepspace/worker`
- Client hook: `useMediaRoom(roomId)` → `{ peers, localStream, connect, disconnect }`

**CronRoom:**
- Extends BaseRoom
- Replaces the current `cron-schedule` feature
- Reads cron configuration (intervals, schedules) from SQLite or constructor config
- Uses DO alarm for scheduling
- Executes tasks via user-defined handler functions
- Tracks execution history (last run, success/failure, duration)
- Admin WebSocket connection for monitoring scheduled tasks
- Exported from `deepspace/worker`
- Client hook: `useCronMonitor(roomId)` → `{ tasks, history, trigger, pause, resume }`

## Dynamic DO Manifest System

### DO Manifest Type

Create `packages/deepspace/src/runtime/do-manifest.ts`:

```ts
export interface DOManifestEntry {
  binding: string       // e.g. 'RECORD_ROOMS'
  className: string     // e.g. 'AppRecordRoom'  
  sqlite: boolean       // whether this DO uses SQLite storage
}

export type DOManifest = DOManifestEntry[]

// Utility type: auto-generates Env type from manifest
export type DOBindings<T extends readonly DOManifestEntry[]> = {
  [K in T[number]['binding']]: DurableObjectNamespace
}
```

Export from `packages/deepspace/src/runtime/index.ts`.

### Worker Template Changes

Update `packages/create-deepspace/templates/starter/worker.ts` to include:

```ts
export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
] as const satisfies DOManifest

type Env = BaseEnv & DOBindings<typeof __DO_MANIFEST__>
```

When a developer adds a GameRoom:
```ts
export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'GAME_ROOMS', className: 'AppGameRoom', sqlite: true },
] as const satisfies DOManifest

export class AppGameRoom extends GameRoom {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tickRate: 20 }) // 20 ticks/sec
  }
  onTick(state, inputs) { /* game logic */ }
}
```

### CLI Deploy Changes

Modify `packages/deepspace/src/cli/commands/deploy.ts`:
- After reading worker.ts source (before esbuild bundling), extract `__DO_MANIFEST__` via regex
- Send as `doManifest` JSON field in the deploy form data
- Fall back to default manifest `[{RECORD_ROOMS, AppRecordRoom, true}, {YJS_ROOMS, AppYjsRoom, true}]` if not found

### Deploy Worker Changes

Modify `platform/deploy-worker/src/lib/cloudflare-deploy.ts`:

1. Add `doManifest: DOManifestEntry[]` to `WorkerBindings` interface

2. Replace hardcoded migration detection (lines 70-86) with:
   - Fetch existing bindings from CF API (already done)
   - Diff against manifest to find new SQLite classes
   - `needsMigration = newSqliteClasses.length > 0`

3. Replace hardcoded bindings/migrations (lines 159-189) with:
   - Dynamic DO bindings from manifest
   - Incremental migration tag (bump version, stored in app registry)
   - Static bindings (R2, service, secrets) unchanged

4. Modify `platform/deploy-worker/src/routes/deploy.ts`:
   - Parse `doManifest` from form data
   - Fall back to default if not present (backward compat)
   - Pass to `deployToWfP`

### wrangler.toml

Keep manual for local dev. Template ships with correct defaults. Developers manually add new DO bindings + migration blocks for `wrangler dev`. Future: `npx deepspace sync` command to auto-update.

## Implementation Order

1. **BaseRoom extraction** — create BaseRoom, refactor RecordRoom and YjsRoom to extend it. Zero behavioral changes to existing functionality.
2. **DO manifest types** — create DOManifest, DOBindings, export from runtime
3. **Deploy pipeline** — CLI extraction, deploy worker dynamic bindings/migrations
4. **Worker template** — add __DO_MANIFEST__, DOBindings Env type
5. **GameRoom** — first new DO template
6. **CronRoom** — replace cron-schedule feature
7. **CanvasRoom** — spatial collaboration
8. **MediaRoom** — WebRTC signaling
9. **Client hooks** — useGameRoom, useCronMonitor, useCanvas, useMediaRoom

## Key Files

| File | Action |
|------|--------|
| `packages/deepspace/src/runtime/base-room.ts` | NEW — BaseRoom class |
| `packages/deepspace/src/runtime/record-room.ts` | REFACTOR — extend BaseRoom |
| `packages/deepspace/src/runtime/yjs-room.ts` | REFACTOR — extend BaseRoom |
| `packages/deepspace/src/runtime/game-room.ts` | NEW — GameRoom class |
| `packages/deepspace/src/runtime/canvas-room.ts` | NEW — CanvasRoom class |
| `packages/deepspace/src/runtime/media-room.ts` | NEW — MediaRoom class |
| `packages/deepspace/src/runtime/cron-room.ts` | NEW — CronRoom class |
| `packages/deepspace/src/runtime/do-manifest.ts` | NEW — manifest types |
| `packages/deepspace/src/runtime/index.ts` | MODIFY — export new classes + types |
| `packages/deepspace/src/runtime/constants.ts` | MODIFY — add message types for new rooms |
| `packages/deepspace/src/runtime/handlers/` | REFACTOR — handlers use BaseRoom context |
| `packages/deepspace/src/storage/hooks/useGameRoom.ts` | NEW — client hook |
| `packages/deepspace/src/storage/hooks/useCanvas.ts` | NEW — client hook |
| `packages/deepspace/src/storage/hooks/useMediaRoom.ts` | NEW — client hook |
| `packages/deepspace/src/storage/hooks/useCronMonitor.ts` | NEW — client hook |
| `packages/deepspace/src/cli/commands/deploy.ts` | MODIFY — manifest extraction |
| `platform/deploy-worker/src/lib/cloudflare-deploy.ts` | MODIFY — dynamic bindings |
| `platform/deploy-worker/src/routes/deploy.ts` | MODIFY — parse manifest |
| `packages/create-deepspace/templates/starter/worker.ts` | MODIFY — add manifest + DOBindings |
| `packages/create-deepspace/templates/starter/wrangler.toml` | MODIFY — if new default DOs added |

## Constraints

- RecordRoom's public API must not change. Existing apps must work without modification.
- YjsRoom's protocol must not change. Existing collaborative docs must keep working.
- The deploy pipeline must be backward compatible — apps without `__DO_MANIFEST__` get default bindings.
- BaseRoom must use Cloudflare's hibernation WebSocket API (not standard WebSocket events).
- All new DOs must support hibernation (state survives DO sleep/wake cycles).
- Message types for new rooms should use ranges to avoid conflicts: GameRoom 40-59, CanvasRoom 60-79, MediaRoom 80-99, CronRoom 100-119.
