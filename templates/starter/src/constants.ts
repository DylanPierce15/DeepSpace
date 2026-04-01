/** App name — replaced by the CLI during scaffolding */
export const APP_NAME = '__APP_NAME__'

/** Primary scope ID for the app's RecordRoom DO */
export const SCOPE_ID = `app:${APP_NAME}`

/** Shared scopes that mount as headless RecordScopes alongside the app scope */
export const SHARED_CONNECTIONS: { type: string; instanceId?: string }[] = [
  { type: 'workspace', instanceId: 'default' },
  // Uncomment for conversation/community/post features:
  // { type: 'dir', instanceId: APP_NAME },
]

/** Available roles in the app */
export const ROLES = {
  VIEWER: 'viewer',
  MEMBER: 'member',
  ADMIN: 'admin',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/** Role display configuration */
export const ROLE_CONFIG: Record<Role, { title: string; badgeVariant: string; description: string }> = {
  viewer: { title: 'Viewer', badgeVariant: 'secondary', description: 'Read-only access' },
  member: { title: 'Member', badgeVariant: 'default', description: 'Can create and edit own content' },
  admin: { title: 'Admin', badgeVariant: 'warning', description: 'Full access to all features' },
}
