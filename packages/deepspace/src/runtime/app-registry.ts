/**
 * App Registry Types
 *
 * Per-app metadata stored in R2 at `app-meta/{appId}.json`.
 * Used by the platform worker for app identification and display.
 *
 * Trust enforcement is handled entirely by server actions — see action-types.ts.
 */

// ============================================================================
// Types
// ============================================================================

export interface AppMeta {
  appId: string
  /** Null for monorepo internal apps */
  ownerUserId: string | null
  displayName: string
  registeredAt: string
}
