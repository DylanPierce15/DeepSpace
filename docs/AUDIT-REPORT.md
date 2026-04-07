# Miyagi3 → DeepSpace SDK Audit Report

**Date**: 2026-04-01
**Scope**: Full comparison of `~/GitHub/Miyagi3` vs `~/GitHub/deepspace-sdk`

---

## Phase 1: Client SDK (`packages/spaces-sdk/src/` vs `packages/sdk/src/`)

### auth/core/config.ts
**Miyagi3 location**: `packages/spaces-sdk/src/auth/core/config.ts`
**DeepSpace location**: MISSING (replaced by `@deepspace/config`)
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: Clerk-specific config (`publishableKey`, `satelliteDomain`, `clerkSignInUrl`). DeepSpace uses Better Auth with cookie-based sessions — no publishable keys or satellite domains needed.

### auth/core/appearance.ts
**Miyagi3 location**: `packages/spaces-sdk/src/auth/core/appearance.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (partial)
**Notes**: `AuthAppearance` type, `AUTH_DARK_ACCENT` (`#818cf8`), `normalizeAuthAccent()`, `getAuthThemeVariables()` (~30 CSS custom properties). DeepSpace's `AuthOverlay.tsx` hardcodes `#7c87f5`. Port the constants and `normalizeAuthAccent()` helper.

### auth/core/routes.ts, origins.ts, allowedRedirectOrigins.ts, redirectState.ts
**Miyagi3 location**: `packages/spaces-sdk/src/auth/core/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: All Clerk redirect-based auth flow infrastructure (satellite domain redirects, URL normalization, sessionStorage state). DeepSpace uses inline email/password forms — no redirect paths needed.

### auth/platform/SpacesAuthProvider.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/auth/platform/SpacesAuthProvider.tsx`
**DeepSpace location**: `packages/sdk/src/auth/DeepSpaceAuthProvider.tsx`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Miyagi3's is a 206-line Clerk wrapper. DeepSpace's is a thin passthrough (`<>{children}</>`) because Better Auth uses cookie-based sessions. Correct.

### auth/platform/widgetAuth.ts, SatelliteSessionSync.tsx, electron.ts
**Miyagi3 location**: `packages/spaces-sdk/src/auth/platform/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: Widget iframe postMessage auth, Clerk satellite session sync, Electron desktop auth. None applicable to DeepSpace.

### auth/flow/ (AuthFlow.tsx, AuthPage.tsx, MiniAppAuthBoundary.tsx, navigation.ts, requestContext.ts, modal/, callbacks/)
**Miyagi3 location**: `packages/spaces-sdk/src/auth/flow/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED (except social auth)
**Action**: SKIP
**Notes**: 958-line `AuthFlow.tsx` with email/password, OTP verification, Google/Apple OAuth — all using Clerk hooks. DeepSpace's `AuthOverlay.tsx` handles email/password via Better Auth. **Gap**: If DeepSpace needs social OAuth, buttons would need to redirect to `/api/auth/sign-in/social?provider=google`. Email verification flow also not built.

### auth/ui/AuthOverlay.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/auth/ui/AuthOverlay.tsx`
**DeepSpace location**: `packages/sdk/src/auth/AuthOverlay.tsx`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Both implement frosted-glass auth overlay. DeepSpace's includes inline email/password form (more complete for its architecture). One gap: Miyagi3 accepts `onClose` prop for dismissibility; DeepSpace does not.

### auth/ui/authButtons.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/auth/ui/authButtons.tsx`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (adapted)
**Notes**: Port `AuthGate` (show children when signed in, fallback when signed out), `SignedIn`/`SignedOut` conditional renderers, `useDisplayName`, `UserIndicator`. Skip redirect functions and Clerk re-exports. Adapt to use DeepSpace's `useAuth()`.

### auth/ui/GuestBanner.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/auth/ui/GuestBanner.tsx`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (adapted)
**Notes**: Floating dismissible banner for unauthenticated users. ~100 lines. Remove `isWidgetContext()` check, remove `useMobileBlocked()` dependency, replace `useAuthLauncher()` with direct `signIn`/`signUp` calls.

### auth/ui/useAuthLauncher.ts, AuthGuestPanel.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/auth/ui/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: Auth launcher routes to best auth method per context (modal/redirect/Electron). DeepSpace always uses inline overlay. AuthGuestPanel depends on the pills system.

### storage/store.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/store.ts`
**DeepSpace location**: `packages/sdk/src/storage/store.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Byte-for-byte identical. `RecordStore` class with subscribe, getSnapshot, initQuery, releaseQuery, setQueryResult, applyChange, resetToLoading, setError, removeQuery.

### storage/context.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/storage/context.tsx`
**DeepSpace location**: `packages/sdk/src/storage/context.tsx`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Clean adaptation. Imports `@deepspace/types` and `@deepspace/config`. Removes widget-specific code (no `isWidgetContext()`, no `LoadingScreen`/`SignInScreen`/`ErrorOverlay`/`PermissionToastBridge`, no `MSG_REGISTER_SCHEMAS`, no iframe escape key handler). Removes `RecordProviderWithClerk` — replaced by top-level `RecordProvider` using Better Auth `useAuth()`. WebSocket connection logic, message handling, reconnect with exponential backoff, visibility change handler, sendConfirmed, binary message handling — all preserved faithfully.

### storage/hooks/useQuery.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/useQuery.ts`
**DeepSpace location**: `packages/sdk/src/storage/hooks/useQuery.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Byte-for-byte identical.

### storage/hooks/useMutations.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/useMutations.ts`
**DeepSpace location**: `packages/sdk/src/storage/hooks/useMutations.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Byte-for-byte identical.

### storage/hooks/usePresence.ts, useUser.ts, useUsers.ts, useTeams.ts, useUserLookup.ts, useYjs.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/`
**DeepSpace location**: `packages/sdk/src/storage/hooks/`
**Status**: COMPLETE
**Action**: NONE
**Notes**: All present in both codebases.

### storage/hooks/useConversations.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/useConversations.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: 340-line hook for conversation directory operations: `createChannel`, `createDM`, `createGroupDM`, `createEmailThread`, `createOutboundEmail`, `lookupByName`, `updateLastMessage`, `markRead`, `toggleStar`, `setArchived`, `setTrashed`, `setLabels`, `setFolder`. Operates on `conversations` and `conversation_state` collections in `dir:{appId}` scope. Essential for messaging apps. Import dependency on `../../worker/directory-schemas` needs to change to `@deepspace/types`.

### storage/hooks/useCommunities.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/useCommunities.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: 137-line hook for community CRUD: `createCommunity`, `updateCommunity`, `joinCommunity`, `leaveCommunity`, `getMembersOf`, `lookupByName`. Operates on `communities` and `memberships` collections in `dir:{appId}` scope.

### storage/hooks/usePosts.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/usePosts.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: 87-line hook for post CRUD: `createPost`, `updatePost`, `deletePost`, `setConversationId`. Operates on `posts` collection in `dir:{appId}` scope.

### storage/hooks/index.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/hooks/index.ts`
**DeepSpace location**: `packages/sdk/src/storage/hooks/index.ts`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Missing exports for `useConversations`, `useCommunities`, `usePosts`. Add after porting.

### storage/components/ (LoadingScreen, SignInScreen, ErrorOverlay, PermissionToastBridge)
**Miyagi3 location**: `packages/spaces-sdk/src/storage/components/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: DeepSpace deliberately removed built-in loading/error UI from the SDK. `RecordProvider` renders `null` while loading; apps handle their own UI. `ErrorOverlay` is widget/iframe-specific. `PermissionToastBridge` depends on built-in toast — DeepSpace uses callback refs instead.

### storage/legacyStorage.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/storage/legacyStorage.tsx`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: `useStorage`, `useGlobalStorage`, `useUserStorage`, `useFiles` — pre-esbuild widget storage API via Yjs Y.Maps. Legacy backward compatibility for old Miyagi3 canvas widgets.

### storage/RecordScope.tsx, ScopeRegistry.tsx, MultiplexProvider.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/storage/`
**DeepSpace location**: `packages/sdk/src/storage/`
**Status**: COMPLETE
**Action**: NONE

### storage/types.ts, connection-status.ts, conversation-utils.ts, file-attachment-utils.ts, message-utils.ts, useR2Files.ts, useRecords.tsx, user-color.ts, yjs-protocol.ts, serverErrors.ts, constants.ts
**Status**: COMPLETE
**Action**: NONE

### storage/messaging/index.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/messaging/index.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Re-exports `useConversation`, `groupReactionsForMessage`, and all conversation message types. Actual implementation is in the `messaging/` module (see below).

### storage/index.ts
**Miyagi3 location**: `packages/spaces-sdk/src/storage/index.ts`
**DeepSpace location**: `packages/sdk/src/storage/index.ts`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Missing directory hooks (conversations, communities, posts), messaging hook (useConversation). Add after porting. Legacy storage hooks should NOT be added.

### mux-binary.ts
**Miyagi3 location**: `packages/spaces-sdk/src/mux-binary.ts`
**DeepSpace location**: `packages/sdk/src/mux-binary.ts`
**Status**: COMPLETE
**Action**: NONE

### config/environment.ts
**Miyagi3 location**: `packages/spaces-sdk/src/config/environment.ts`
**DeepSpace location**: `packages/sdk/src/config/index.ts` (re-exports from `@deepspace/config`)
**Status**: COMPLETE
**Action**: NONE
**Notes**: Miyagi3's 332-line monolith correctly replaced by the `@deepspace/config` package.

### platform/PlatformProvider.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/platform/PlatformProvider.tsx`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (adapted)
**Notes**: Provides `platformFetch()` (authenticated fetch to `/platform/*`) and `useInbox()` (WebSocket subscription for cross-app inbox: `inbox_init`/`inbox_added`/`inbox_removed`/`inbox_updated`). Replace `getAuthToken()` import path, remove widget concerns.

### platform/usePlatformWS.ts
**Miyagi3 location**: `packages/spaces-sdk/src/platform/usePlatformWS.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Generic WebSocket hook for platform DO connections. Auth token fetch, wss:// detection, exponential backoff reconnect (500ms → 10s), 30s ping interval. Takes `{path, scopeId, initialState, onMessage}`, returns `{state, send}`. Solid, reusable abstraction.

### platform/useToolsApi.ts
**Miyagi3 location**: `packages/spaces-sdk/src/platform/useToolsApi.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: SDK hook for generic tools/CRUD REST API: `create`, `update`, `remove`, `get`, `query` via `/api/tools/execute?scopeId=...`. Used for cross-scope imperative operations.

### platform/types.ts
**Miyagi3 location**: `packages/spaces-sdk/src/platform/types.ts`
**DeepSpace location**: Already exists as `storage/connection-status.ts`
**Status**: COMPLETE
**Action**: SKIP

### theme/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/theme/`
**DeepSpace location**: `packages/sdk/src/theme/index.ts` (placeholder: `// Theme module -- placeholder`)
**Status**: MISSING
**Action**: PORT
**Notes**: 5 files: `DeepSpaceThemeProvider.tsx` (React context applying CSS custom properties), `applyTheme.ts` (`applyDeepSpaceTheme`, `applyUIThemeTokens`, `clearDeepSpaceTheme`, `readThemeFromDOM`, `DEEPSPACE_THEME_PROPERTIES`), `types.ts` (`DeepSpaceThemeConfig`), `useIsDarkTheme.ts`, `index.ts`. Framework-agnostic (just CSS custom properties). Auth UI references `--theme-*` variables.

### messaging/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/messaging/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Core conversation messaging module: `useConversation.ts` (send, edit, delete, reactions, read cursors, members), `types.ts` (MessageRecord, ReactionRecord, MemberRecord, ReadCursorRecord, GroupedReaction, ConversationObject), `utils.ts` (groupReactionsForMessage). UI components: `MessageContent.tsx`, `MessageAttachments.tsx`, `ReactionPicker.tsx`, `ReactionRow.tsx`, `DateSeparator.tsx`, `LinkPreviewCard.tsx`, `PendingFilePreviews.tsx`. Plus `parse-message-content.ts`, `emoji-shortcodes.ts`, `link-preview-preferences.ts`, `useFileDragDrop.ts`, `useMessageScroll.ts`. Port `useConversation.ts`, `types.ts`, `utils.ts` at minimum.

### profile/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/profile/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: SKIP (for now)
**Notes**: ~20 files including `profileService.ts`, `stardustService.ts` (karma), `stripeService.ts`, `useMyProfile.ts`, `useCredits.ts`, `ProfileModalProvider.tsx`, `UserProfileModal.tsx`, `CreditBar.tsx`, `UpgradeModal.tsx`. All depends on McAPI, Clerk, Stripe, karma system. DeepSpace has its own billing (`api-worker`). Would need full rebuild, not a port.

### mobile/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/mobile/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (low priority)
**Notes**: `MobileBlocker.tsx` (full-screen mobile warning, dismissible), `MobileBlockerContext.tsx`, `MobileHeader.tsx` (sticky header), `useIsMobile.ts` (reactive 768px breakpoint). Framework-agnostic, could be useful. Remove `isWidgetContext()` checks.

### connectors/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/connectors/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (when needed)
**Notes**: `useGoogleConnector`, `useGoogleCalendar`, `useGmail`, `useMiniappEmail`, `useBookingCalendar`. All use McAPI. Hook patterns are reusable but API calls need to point to DeepSpace's API worker.

### notifications/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/notifications/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT (when needed)
**Notes**: `useNotifications`, `NotificationBell` (badge + dropdown), `browserNotifications.ts`, `pushTokens.ts`, `teamsNotify.ts`. All depend on McAPI and Miyagi3 notification tables. Needs a DeepSpace notification backend first.

### screenshot/widgetScreenshot.ts
**Miyagi3 location**: `packages/spaces-sdk/src/screenshot/widgetScreenshot.ts`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: iframe screenshot capture via html2canvas + postMessage. DeepSpace apps are standalone.

### toast/ToastProvider.tsx
**Miyagi3 location**: `packages/spaces-sdk/src/toast/ToastProvider.tsx`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: DeepSpace deliberately removed built-in toast UI. Apps bring their own.

### calling/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/calling/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: SKIP (for now)
**Notes**: LiveKit video/audio integration. Feature module — port when needed.

### chat/ (entire directory)
**Miyagi3 location**: `packages/spaces-sdk/src/chat/`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: AI chat dock connecting to Miyagi3 AgentAPI. DeepSpace apps don't embed a chat dock.

### pills/, app-switcher/, karma/, ui/ (DeepSpacePill, LowCreditsWarning)
**Miyagi3 location**: Various
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: Miyagi3-platform-specific UI systems (floating pill badges, app switcher, karma/gamification).

### mcapi/, user/useUser.ts, icons/, css-modules.d.ts, styles/base.css
**Miyagi3 location**: Various
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: McAPI client replaced by standard fetch + `getAuthToken()`. User hook replaced by DeepSpace auth and storage hooks. Icons/styles are Miyagi3-specific.

---

## Phase 2: Starter Template (`widget-starter-template/` vs `templates/starter/`)

### AppShell.tsx
**Miyagi3 location**: `packages/widget-starter-template/template/src/AppShell.tsx`
**DeepSpace location**: Inlined in `templates/starter/src/App.tsx`
**Status**: PARTIAL
**Action**: PORT
**Notes**: Miyagi3's `DeployedShell` wraps: `MiniAppAuthBoundary` > `ProfileModalProvider` > `DeepSpacePill` + `LowCreditsWarning` + `AuthOverlay`/`GuestBanner` + `MobileHeader` > `RecordProvider` > `MultiplexProvider` > `RecordScope` > `SharedScopes` > `PlatformProvider` > `App`. DeepSpace has: `DeepSpaceAuthProvider` > auth gate + `AuthOverlay` + `RecordProvider` > Routes. **Key gap**: DeepSpace's `App.tsx` puts `RecordProvider` with `schemas` directly (no roomId, no scopeId). Miyagi3 uses `RecordProvider` > `MultiplexProvider` > `RecordScope roomId={SCOPE_ID}`. DeepSpace needs the multi-scope pattern for apps needing shared data from `workspace:default` or `conv:{id}` scopes. Skip: `WidgetShell`, `PreviewRouteReporter`, `PillCoordinator`, `MobileBlocker`, window globals.

### App.tsx
**Miyagi3 location**: `packages/widget-starter-template/template/src/App.tsx`
**DeepSpace location**: `templates/starter/src/App.tsx`
**Status**: PARTIAL
**Action**: PORT
**Notes**: Miyagi3's App.tsx (345 lines) has: `Navigation` with role-based items, responsive desktop/mobile menu, user avatar, role badge, `ProtectedRoute` with role-based guards, `RootRedirect`, landing page awareness. DeepSpace's (45 lines) has: auth provider + auth gate, minimal routing (just `HomePage` + catch-all). Missing: `Navigation`, `ProtectedRoute`, `RootRedirect`, role-based routing, mobile menu, user display.

### main.tsx
**Miyagi3 location**: `packages/widget-starter-template/template/src/main.tsx`
**DeepSpace location**: `templates/starter/src/main.tsx`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Miyagi3 (47 lines): `BrowserRouter` > `DeepSpaceThemeProvider` > `MobileBlockerProvider` > `PillCoordinatorProvider` > shell + `ChatMount`. DeepSpace (13 lines): `createRoot` + `BrowserRouter` > `App`. Missing providers are all Miyagi3-specific. NOT_NEEDED: theme provider (Tailwind handles it), mobile blocker, pill coordinator, chat mount, widget branching, HMR root reuse.

### constants.ts
**Miyagi3 location**: `packages/widget-starter-template/template/src/constants.ts`
**DeepSpace location**: `templates/starter/src/constants.ts`
**Status**: PARTIAL
**Action**: PORT
**Notes**: Miyagi3 (70 lines): `APP_ID`, `SCOPE_ID = "app:${APP_ID}"`, `SHARED_CONNECTIONS = [{ type: 'workspace', instanceId: 'default' }]`, `ROLES = { VIEWER, MEMBER, ADMIN }`, `ROLE_CONFIG` with title/badge/description per role. DeepSpace (2 lines): `APP_NAME = '__APP_NAME__'`. Missing: `SCOPE_ID`, `SHARED_CONNECTIONS`, `ROLES`, `ROLE_CONFIG`.

### schemas.ts
**Miyagi3 location**: `packages/widget-starter-template/template/src/schemas.ts`
**DeepSpace location**: `templates/starter/src/schemas.ts`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Miyagi3 uses `USERS_COLLECTION_FIELDS` spread from `@spaces/sdk/worker`, includes `settingsSchema` from `./schemas/admin-schema`. Each schema has full RBAC with `'own'` support. DeepSpace manually defines user fields, no admin schema, simpler permissions.

### schemas/admin-schema.ts
**Miyagi3 location**: `packages/widget-starter-template/template/src/schemas/admin-schema.ts`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Admin-only settings collection (key/value store). `@deepspace/sdk-worker` has `ADMIN_SETTINGS_SCHEMA` equivalent but template doesn't use it.

### styles.css
**Miyagi3 location**: `packages/widget-starter-template/template/src/styles.css`
**DeepSpace location**: `templates/starter/src/styles.css`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Miyagi3 (192 lines): `@import "tailwindcss" source(none)` + `@import "@spaces/sdk/styles/base.css"` + full shadcn/ui theme tokens (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, radius) + status colors + shadow tokens + animation keyframes + scrollbar/selection/focus styling. DeepSpace (13 lines): `@import "tailwindcss"` + minimal 8 color tokens. Missing: animations (used by Dialog/Popover), scrollbar styling, base layer resets, complete shadcn token set.

### themes.css
**Miyagi3 location**: `packages/widget-starter-template/template/src/themes.css`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: SKIP
**Notes**: Read-only reference file with WCAG AA theme palettes. Not imported anywhere. Nice-to-have.

### components/ui/ (40+ files)
**Miyagi3 location**: `packages/widget-starter-template/template/src/components/ui/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Full shadcn/ui-style library with Radix UI primitives. Includes:
- **Layout**: Card, CardGrid, Separator, Table, Tabs
- **Form**: Button (loading, asChild via Slot), Input, Textarea, Select, Checkbox, Switch, Label
- **Data**: Badge (7 variants), Avatar, Progress, Skeleton (6 variants + LoadingSpinner/LoadingOverlay)
- **Feedback**: Alert, Toast, EmptyState (6 presets)
- **Overlay**: Popover, Dialog, DropdownMenu, Tooltip, Modal, ConfirmModal
- **Date/Time**: Calendar, DatePicker, TimePicker, DateTimePicker, date-utils
- **Custom**: SearchInput, MobileSidebar, ContextMenu, ReactionPicker, UserPicker
- **Utils**: `cn()` (clsx + tailwind-merge)

Dependencies needed: `@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `emoji-picker-react`

### pages/HomePage.tsx
**Miyagi3 location**: `packages/widget-starter-template/template/src/pages/HomePage.tsx`
**DeepSpace location**: `templates/starter/src/pages/HomePage.tsx`
**Status**: COMPLETE
**Action**: UPDATE (optional polish)
**Notes**: Both functional welcome pages. Miyagi3 uses storage-level `useUser` (with role), more polished styling. DeepSpace uses auth-level `useUser`. Both work.

### vite.config.ts
**Miyagi3 location**: NOT in template (external build-env)
**DeepSpace location**: `templates/starter/vite.config.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: May need `define` block for `__APP_NAME__` injection and `resolve.dedupe: ['react', 'react-dom']` to prevent duplicate React in production.

### postcss.config.js, tsconfig.json
**Status**: COMPLETE
**Action**: NONE

### worker.ts
**Miyagi3 location**: NOT in template (external)
**DeepSpace location**: `templates/starter/worker.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Entirely new for DeepSpace. Full Hono app with auth proxy, WebSocket proxy, server actions, R2 storage, McAPI proxy, HMAC cron, platform proxy, SPA fallback. No Miyagi3 equivalent.

### wrangler.toml, package.json, index.html
**DeepSpace location**: `templates/starter/`
**Status**: COMPLETE / PARTIAL
**Action**: NONE / UPDATE (package.json needs Radix deps if UI components ported)

### features/ directory (15+ opt-in features)
**Miyagi3 location**: `packages/widget-starter-template/features/`
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: SKIP (for now)
**Notes**: Scaffolding/code-gen features: teams-collab, topbar-nav, admin-page, items-crud, leaderboard, permissions, tasks-claimable, display-kanban, cron-schedule, layout-sidebar, sidebar-tree, landing-page, yjs-doc, sidebar-nav, rbac-test. Should be ported eventually but not blocking.

---

## Phase 3: Deploy Worker (`miniapp-deployer/` vs `platform/deploy-worker/`)

### site-worker.ts → worker.ts
**Miyagi3 location**: `packages/miniapp-deployer/site-worker.ts`
**DeepSpace location**: `templates/starter/worker.ts`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: DeepSpace is a Hono-based rewrite of Miyagi3's vanilla-fetch handler. Properly ported differences:
- Auth: Clerk → Better Auth (correct)
- Auth proxy: New `/api/auth/*` route for Better Auth same-origin cookies (correct)
- Action tools: HMAC internal signing instead of forwarding user JWT (security improvement)

Missing/different:
1. **OG image handler** (`/og-image.png` serving from R2) — MISSING
2. **WebSocket path rewriting**: Miyagi3 rewrites `/ws/:roomId` → `/ws/records/:roomId`. DeepSpace passes through. Verify intentional.
3. **Health check** (`/api/health`): Returns auth config status — MISSING from starter (low priority)
4. **Dev-only bypass** (`X-Dev-User-Id` header): Intentionally removed in DeepSpace (more secure)
5. **Cron ownerUserId validation**: Miyagi3 validates against `env.OWNER_USER_ID` — DeepSpace does not

### src/metadata.ts
**Miyagi3 location**: `packages/miniapp-deployer/src/metadata.ts`
**DeepSpace location**: `platform/deploy-worker/src/lib/cloudflare-deploy.ts` (inlined, lines 141-165)
**Status**: COMPLETE
**Action**: NONE
**Notes**: Correctly inlined. Bindings updated (`miyagi-user-files` → `deepspace-user-files`, `platform-worker` → `deepspace-platform-worker`, Clerk keys → Better Auth keys). Missing: `owner:{userId}` tag (low priority, CF management convenience).

### src/deploy.ts (Cloudflare deploy flow)
**Miyagi3 location**: `packages/miniapp-deployer/src/deploy.ts`
**DeepSpace location**: `platform/deploy-worker/src/lib/cloudflare-deploy.ts` + `src/routes/deploy.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Same 3-step WfP flow (create session, upload buckets, deploy worker). DeepSpace correctly uses Web Crypto API (`crypto.subtle`) instead of Node's `createHash`. New additions: R2-backed app registry with ownership checks, DELETE endpoint, status check endpoint.

### src/deploy.ts (Cron registration)
**Miyagi3 location**: `packages/miniapp-deployer/src/deploy.ts` (lines 650-704)
**DeepSpace location**: MISSING
**Status**: MISSING
**Action**: PORT
**Notes**: Miyagi3 validates `cron.json` with Zod, writes config to Cloudflare KV (`CRON_TASKS_KV_NAMESPACE_ID`) so dispatch worker can poll and trigger. DeepSpace has the cron handler endpoint in the starter worker but **no deploy-time cron registration**. Without this, dispatch worker can't know which apps have cron tasks.

### src/deploy.ts (Build pipeline)
**Miyagi3 location**: `packages/miniapp-deployer/src/deploy.ts` (setupBuildEnvironment, writeWidgetSources, replacePlaceholders)
**DeepSpace location**: N/A (building moved to CLI)
**Status**: NOT_NEEDED
**Action**: SKIP

### build-env/index.html
**Miyagi3 location**: `packages/miniapp-deployer/build-env/index.html`
**DeepSpace location**: `templates/starter/index.html`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Miyagi3 has OG/Twitter meta tags, favicon link, `__WIDGET_NAME__` placeholder, flash-prevention inline CSS. DeepSpace is bare-bones. Missing if deployed apps need social sharing meta tags.

### build-env/vite.config.ts
**Miyagi3 location**: `packages/miniapp-deployer/build-env/vite.config.ts`
**DeepSpace location**: `templates/starter/vite.config.ts`
**Status**: PARTIAL
**Action**: UPDATE
**Notes**: Missing: `resolve.dedupe: ['react', 'react-dom']` (prevents duplicate React), `buildMarker()` plugin (forces unique CF asset hashes per deployer version). `templatePlaceholders()` safety net not needed if CLI handles replacements.

### build-env/postcss.config.js, tsconfig.json
**Status**: COMPLETE
**Action**: NONE

### build-env/src/chat-mount.tsx
**Miyagi3 location**: `packages/miniapp-deployer/build-env/src/chat-mount.tsx`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP

### Placeholder system
**Miyagi3 location**: `packages/miniapp-deployer/src/deploy.ts` (replacePlaceholders, buildFaviconLink, convertToIconifyUrl)
**DeepSpace location**: MISSING (only `__APP_NAME__` in a few files)
**Status**: PARTIAL
**Action**: PORT (to CLI)
**Notes**: Favicon/icon system and OG meta tag templating. Belongs in `create-deepspace-app` or CLI, not deploy-worker.

### Agent context files (`_agent/`)
**Miyagi3 location**: `packages/miniapp-deployer/src/deploy.ts` (lines 97-115)
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP

---

## Phase 4: Worker SDK (`spaces-sdk/src/worker/` vs `sdk-worker/src/`)

### Executive Summary

The port is **clean and complete**. No logic bugs or missing features. All handler logic, RBAC, schema validation, Yjs sync, tools API, backup, and gateway multiplexing are byte-for-byte identical where they should be.

### record-room.ts
**Miyagi3 location**: `packages/spaces-sdk/src/worker/record-room.ts`
**DeepSpace location**: `packages/sdk-worker/src/record-room.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Intentional removals: `USER_CONTENT_SCHEMAS` import, `SCHEMA_REGISTRY?: R2Bucket`, `userSchemasLoaded` flag, `fetchUserSchemasFromR2()` (~25 lines). All correct per no-user-DO design. "Clerk user ID" → "User ID" comment change.

### handlers/records.ts, subscriptions.ts, users.ts, yjs.ts, tools-api.ts, debug-api.ts, index.ts
**Miyagi3 location**: `packages/spaces-sdk/src/worker/handlers/`
**DeepSpace location**: `packages/sdk-worker/src/handlers/`
**Status**: COMPLETE
**Action**: NONE
**Notes**: All byte-for-byte identical.

### gateway-session.ts
**Miyagi3 location**: `packages/spaces-sdk/src/worker/gateway-session.ts`
**DeepSpace location**: `packages/sdk-worker/src/gateway-session.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: Only difference is import path for mux-binary (`../mux-binary` → `./mux-binary`). All multiplexing logic identical.

### mux-binary.ts
**Miyagi3 location**: `packages/spaces-sdk/src/mux-binary.ts` (outside worker dir, shared with client)
**DeepSpace location**: `packages/sdk-worker/src/mux-binary.ts` (inside worker dir)
**Status**: PARTIAL
**Action**: UPDATE (low priority)
**Notes**: Same wire format (varint-length-prefixed UTF-8 scope ID + payload), different implementations:
1. **Return types**: Miyagi3 accepts `Uint8Array | ArrayBuffer`, returns `Uint8Array`. DeepSpace accepts only `ArrayBuffer`, returns `ArrayBuffer`.
2. **Varint**: Miyagi3 uses mutating `writeVarUint`/`readVarUint`. DeepSpace uses allocating `encodeVarint`/`decodeVarint`.
3. **Memory**: Miyagi3 uses `subarray()` (zero-copy). DeepSpace uses `slice()` (copies).

Not a bug — both produce identical wire format. Miyagi3's version is more flexible and memory-efficient.

### schemas.ts
**Miyagi3 location**: `packages/spaces-sdk/src/worker/schemas.ts`
**DeepSpace location**: `packages/sdk-worker/src/schemas.ts`
**Status**: COMPLETE
**Action**: NONE
**Notes**: All 1084 lines byte-for-byte identical.

### tools.ts, backup.ts, protocol.ts, constants.ts, types.ts, cron.ts, mcapi.ts, index.ts
**Status**: COMPLETE
**Action**: NONE
**Notes**: All byte-for-byte identical (or differ only in auth package imports: `@miyagi/auth` → `@deepspace/auth`, `clerkUserId` → `userId`).

### user-content-schemas.ts
**Miyagi3 location**: `packages/spaces-sdk/src/worker/user-content-schemas.ts`
**DeepSpace location**: MISSING
**Status**: NOT_NEEDED
**Action**: SKIP
**Notes**: Defines `USER_DOCUMENTS_SCHEMA` and `USER_SCOPE_USERS_SCHEMA` for `user:{userId}` scope. No user scope in DeepSpace.

### All other worker files (shared-do-schemas.ts, conversation-schemas.ts, directory-schemas.ts, workspace-schemas.ts, messaging-schemas.ts, app-registry.ts, action-types.ts, app-presets.ts, linked-ref.ts, scoped-r2-files.ts)
**Status**: COMPLETE
**Action**: NONE
**Notes**: Byte-for-byte identical.

---

## Prioritized Changes

### 1. Critical — App won't work without these

| # | Item | Location | Why |
|---|------|----------|-----|
| 1.1 | **Multi-scope wiring in starter template** | `templates/starter/src/App.tsx` | Template uses `RecordProvider` without `MultiplexProvider` + `RecordScope`. Apps needing multiple scopes (`app:{appId}` + `workspace:default` + `conv:{convId}`) will fail. |
| 1.2 | **`SCOPE_ID` and `SHARED_CONNECTIONS` in constants** | `templates/starter/src/constants.ts` | Template has no scope configuration. Apps can't connect to the right RecordRoom DO. |
| 1.3 | **Theme module** | `packages/sdk/src/theme/` | Placeholder is empty. Auth UI references `--theme-*` CSS variables. Port `DeepSpaceThemeProvider`, `applyTheme`, `types`, `useIsDarkTheme`. |

### 2. Important — Significantly impacts developer experience

| # | Item | Location | Why |
|---|------|----------|-----|
| 2.1 | **UI component library** | `templates/starter/src/components/ui/` | 40+ shadcn/ui components (Button, Dialog, Badge, etc.) missing. Template has no reusable components for developers. |
| 2.2 | **styles.css expansion** | `templates/starter/src/styles.css` | Only 8 color tokens. Need full shadcn token set, animations (Dialog/Popover), scrollbar styling, base layer resets. |
| 2.3 | **Navigation + ProtectedRoute** | `templates/starter/src/App.tsx` | Template has no navigation bar, no role-based route protection, no mobile menu. |
| 2.4 | **ROLES / ROLE_CONFIG** | `templates/starter/src/constants.ts` | No role definitions for RBAC. Navigation and route guards depend on these. |
| 2.5 | **schemas.ts with USERS_COLLECTION_FIELDS** | `templates/starter/src/schemas.ts` | Template manually defines user fields instead of using the standard spread. Missing admin-schema. |
| 2.6 | **`useConversations` hook** | `packages/sdk/src/storage/hooks/` | Missing hook for conversation directory operations (create channel/DM, mark read, archive, etc.). Needed for messaging apps. |
| 2.7 | **`useCommunities` hook** | `packages/sdk/src/storage/hooks/` | Missing hook for community CRUD. Needed for forum/group apps. |
| 2.8 | **`usePosts` hook** | `packages/sdk/src/storage/hooks/` | Missing hook for post CRUD. Needed for feed apps. |
| 2.9 | **`useConversation` hook (messaging)** | `packages/sdk/src/messaging/` | Full conversation messaging hook (send, edit, delete, reactions, read cursors). Essential for chat. |
| 2.10 | **`platformFetch` + `useToolsApi`** | `packages/sdk/src/platform/` | SDK has no authenticated fetch for platform worker or REST CRUD for cross-scope operations. |
| 2.11 | **`usePlatformWS`** | `packages/sdk/src/platform/` | No generic WebSocket hook for platform DO connections. Needed for app-specific real-time features. |
| 2.12 | **Auth helper components** | `packages/sdk/src/auth/` | Missing `AuthGate`, `SignedIn`/`SignedOut`, `useDisplayName`, `GuestBanner`. |
| 2.13 | **Cron registration at deploy time** | `platform/deploy-worker/` | Dispatch worker has no way to know which apps have cron tasks. Missing KV registration. |
| 2.14 | **`resolve.dedupe` in vite.config.ts** | `templates/starter/vite.config.ts` | Can cause duplicate React instances in production builds. |

### 3. Nice to Have — Polish, can be added later

| # | Item | Location | Why |
|---|------|----------|-----|
| 3.1 | **OG meta tags in index.html** | `templates/starter/index.html` | No social sharing meta tags. Needed for apps that care about link previews. |
| 3.2 | **OG image handler** | `templates/starter/worker.ts` | Missing `/og-image.png` R2 route for screenshot-based OG cards. |
| 3.3 | **Placeholder system** (favicon, OG) | `packages/cli/` or `create-deepspace-app/` | Only `__APP_NAME__` exists. No favicon/icon templating. |
| 3.4 | **`mux-binary.ts` optimization** | `packages/sdk-worker/src/mux-binary.ts` | DeepSpace version uses `slice()` (copies) vs Miyagi3's `subarray()` (zero-copy). Same wire format, less efficient. |
| 3.5 | **Mobile utilities** | `packages/sdk/src/mobile/` | `useIsMobile` hook, `MobileBlocker`, `MobileHeader`. |
| 3.6 | **Auth appearance constants** | `packages/sdk/src/auth/` | `AUTH_DARK_ACCENT`, `normalizeAuthAccent()`. Currently hardcoded in AuthOverlay. |
| 3.7 | **AuthOverlay `onClose` prop** | `packages/sdk/src/auth/AuthOverlay.tsx` | No dismissibility for apps allowing anonymous access. |
| 3.8 | **themes.css palette reference** | `templates/starter/src/themes.css` | Pre-validated WCAG AA theme palettes. Developer convenience. |
| 3.9 | **Messaging UI components** | `packages/sdk/src/messaging/` | MessageContent, ReactionPicker, DateSeparator, LinkPreviewCard, etc. |
| 3.10 | **Feature scaffolding system** | `templates/starter/features/` | 15+ opt-in features (teams, admin, items CRUD, kanban, landing page, etc.). |
| 3.11 | **Owner tags on deployed workers** | `platform/deploy-worker/` | `owner:{userId}` tag missing from worker metadata. CF management convenience. |
| 3.12 | **Connectors** (Google, Gmail) | `packages/sdk/src/connectors/` | OAuth integration hooks. Port when specific apps need them. |
| 3.13 | **Notifications** | `packages/sdk/src/notifications/` | Cross-app notification system. Needs backend first. |
| 3.14 | **Social OAuth in AuthOverlay** | `packages/sdk/src/auth/AuthOverlay.tsx` | Google/Apple OAuth buttons. Need Better Auth server-side config + redirect buttons. |

### Not Needed — Skip permanently

| Item | Why |
|------|-----|
| Clerk auth infrastructure (satellite domains, redirect flow, session sync) | Replaced by Better Auth |
| Widget/iframe code (widgetAuth, WidgetShell, screenshot, ErrorOverlay, postMessage) | DeepSpace apps are standalone Workers |
| Legacy storage (`useStorage`, `useGlobalStorage`, `useUserStorage`) | Pre-esbuild compat layer |
| `user:{userId}` scope and `user-content-schemas.ts` | No user scope in DeepSpace |
| AI chat dock (`chat/`, `ChatMount`, `_agent/`) | Miyagi3-specific feature |
| Pills system, app-switcher, karma | Miyagi3-platform-specific UI |
| McAPI client | Replaced by standard fetch + `getAuthToken()` |
| Profile module (Stripe/karma/McAPI dependent) | Needs rebuild, not port |
| Toast provider | Apps bring their own notification system |
| Electron desktop auth | No Electron client |
| Build pipeline in deploy-worker | Building moved to CLI |
