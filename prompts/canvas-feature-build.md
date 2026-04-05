# Task: Build and Test the Canvas Feature

## Objective

Build a working canvas collaboration feature using the `CanvasRoom` DO that already exists in the SDK, create a test app that uses it, and iteratively fix issues using HMR (hot module replacement) for fast feedback.

## Context

The DeepSpace SDK has been restructured:
- **SDK source**: `packages/deepspace/src/`
- **Client code**: `src/client/` (hooks, providers, auth, storage)
- **Server code**: `src/server/` (rooms, schemas, handlers, auth, utils)
- **Shared code**: `src/shared/` (types, env, protocol, roles)
- **Features**: `src/features/` (messaging, data, collaboration, admin, nav, layout, display, testing)
- **UI components**: `src/ui/` (Button, Modal, Badge, etc.)

Features are flat exports from `deepspace` (client) and `deepspace/worker` (server). Developers import by name:
```ts
import { ChatPage, messagingSchemas, useQuery, Button } from 'deepspace'
import { RecordRoom, CanvasRoom } from 'deepspace/worker'
```

## What Already Exists

### CanvasRoom DO
`packages/deepspace/src/server/rooms/canvas-room.ts` — a Durable Object for spatial canvas collaboration. Read this file to understand its API, message types, and state management.

### useCanvas Hook
`packages/deepspace/src/client/storage/hooks/useCanvas.ts` — the client-side React hook. Read this to understand what it provides (shapes, addShape, moveShape, deleteShape, viewports, etc.).

### Protocol Constants
`packages/deepspace/src/shared/protocol/constants.ts` — contains canvas-specific message type constants (MSG_CANVAS_*).

## What You Need to Build

### 1. Canvas Feature in SDK (`src/features/collaboration/canvas/`)

Create the feature directory and files:

```
src/features/collaboration/canvas/
  index.ts          # barrel: CanvasPage, useCanvas (re-export), CanvasToolbar, etc.
  worker.ts         # barrel: canvasSchema (if needed)
  schemas.ts        # canvas document schema (optional — canvas state lives in CanvasRoom DO, not RecordRoom)
  components/
    CanvasPage.tsx   # main page component
    CanvasView.tsx   # the actual canvas rendering (HTML5 Canvas or SVG)
    CanvasToolbar.tsx # shape tools (rectangle, circle, text, select, delete)
    ShapeRenderer.tsx # renders individual shapes
```

**CanvasPage** should:
- Accept optional props: `{ docId?: string, className?: string }`
- If no docId, show a document list (using RecordRoom for metadata) with create/delete
- If docId, show CanvasView with toolbar
- Use `useCanvas(docId)` hook to connect to the CanvasRoom DO

**CanvasView** should:
- Render shapes on an HTML5 Canvas element or SVG
- Handle mouse events: click to select, drag to move, click-drag to create new shapes
- Show other users' cursors/viewports via the canvas awareness system
- Support zoom/pan

**CanvasToolbar** should:
- Shape creation tools: rectangle, ellipse, text, line
- Selection tool
- Delete selected shape
- Color picker (simple preset colors)

### 2. Worker Route for CanvasRoom

The starter template's `worker.ts` needs a `/canvas/:docId` WebSocket route, similar to the `/yjs/:docId` route. But since this is a feature test, you can add it to the test app's worker directly.

Check how the existing `/yjs/:docId` route works in `packages/create-deepspace/templates/starter/worker.ts` and replicate the pattern for canvas.

### 3. Test App

Scaffold a test app and add the canvas feature:

```bash
bash scripts/lib/scaffold.sh test-canvas --full
```

Then in the test app:

**`worker.ts`** — Add CanvasRoom DO class and route:
```ts
import { CanvasRoom } from 'deepspace/worker'

export class AppCanvasRoom extends CanvasRoom {}

// Add to __DO_MANIFEST__:
{ binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },

// Add route:
app.get('/canvas/:docId', async (c) => {
  // Same pattern as /yjs/:docId but routes to CANVAS_ROOMS
})
```

**`wrangler.toml`** — Add CANVAS_ROOMS binding and migration.

**`src/schemas.ts`** — Add canvas schemas if any.

**`src/pages.ts`** — Add canvas page route.

### 4. Playwright Tests

Create `tests/local/tests/canvas.spec.ts` with tests for:

1. **Page load**: Canvas page renders, shows create button
2. **Create document**: Click create, canvas view appears
3. **Add shape**: Select rectangle tool, click-drag on canvas, shape appears
4. **Move shape**: Click shape to select, drag to move
5. **Delete shape**: Select shape, click delete, shape removed
6. **Persistence**: Create shape, reload page, shape still there
7. **Two users**: User 1 creates shape, User 2 sees it in real time
8. **Viewport**: Other user's cursor position visible

## Development Workflow

### HMR for Fast Iteration

The key workflow is:

1. Start the test app servers:
   ```bash
   # In one terminal — backend
   cd .test-apps/test-canvas && npx wrangler dev --port 8780
   
   # In another — frontend with HMR
   cd .test-apps/test-canvas && npx vite --port 5173
   ```

2. Edit the **test app's local files** first (not the SDK). The test app imports from `node_modules/deepspace`, but for UI components you're iterating on, create local wrapper files:
   ```tsx
   // .test-apps/test-canvas/src/pages/CanvasPage.tsx
   // Start here, iterate with HMR, then move to SDK when working
   ```

3. Once the component works locally with HMR, move it to the SDK:
   - Copy to `packages/deepspace/src/features/collaboration/canvas/`
   - Update imports from `'deepspace'` to internal SDK paths (`../../client/storage/hooks/useCanvas`)
   - Rebuild SDK: `cd packages/deepspace && npx tsup`
   - Re-scaffold: `bash scripts/lib/scaffold.sh test-canvas --full`
   - Verify tests pass

4. Run targeted Playwright tests:
   ```bash
   scripts/test-local.sh test-canvas --no-scaffold --no-reset -- --grep "canvas" --reporter=list
   ```

### Important Notes

- **Always test locally before deploying** (see memory: feedback_test_before_deploy.md)
- **Tailwind scanning**: The template's `styles.css` has `@source "../node_modules/deepspace/dist/**/*.js"` so SDK Tailwind classes are scanned. If iterating locally in the test app, classes work automatically.
- **React gotchas**: Never use `{number && <JSX>}` — always use `{number > 0 ? <JSX> : null}`. The number `0` renders as visible text in React.
- **No mocks**: All tests must use real auth/services, never mock internal hooks (see memory: feedback_no_mocks.md)
- **Internal SDK imports**: Features inside the SDK use relative paths (`../../../client/storage/hooks/useCanvas`), NOT `'deepspace'`
- **Barrel exports**: After building the feature, add exports to `src/features/collaboration/index.ts` and `src/features/worker.ts`

## Files to Read First

Before starting, read these files to understand the existing patterns:

1. `packages/deepspace/src/server/rooms/canvas-room.ts` — CanvasRoom DO
2. `packages/deepspace/src/client/storage/hooks/useCanvas.ts` — useCanvas hook
3. `packages/deepspace/src/shared/protocol/constants.ts` — MSG_CANVAS_* constants
4. `packages/deepspace/src/features/collaboration/docs/DocsPage.tsx` — similar feature (Yjs docs) for reference
5. `packages/deepspace/src/features/messaging/components/ChatPage.tsx` — another feature for reference on props pattern
6. `packages/create-deepspace/templates/starter/worker.ts` — how DO routes are wired
7. `tests/local/tests/messaging.spec.ts` — reference for test patterns

## Success Criteria

1. Canvas page renders and is navigable
2. Users can create, move, resize, and delete shapes
3. Shapes persist across page reloads
4. Two users see each other's changes in real time
5. All Playwright tests pass
6. Feature is properly exported from the SDK (`import { CanvasPage } from 'deepspace'`)
7. No React rendering gotchas, no stale bundles, clean code
