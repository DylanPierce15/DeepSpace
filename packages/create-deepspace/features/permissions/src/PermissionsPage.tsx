/**
 * Permissions Page
 *
 * Displays the auto-generated RBAC permission matrix from schemas.
 * Accessible to all authenticated users — schema definitions are not secret.
 *
 * Features:
 * - Per-collection CRUD permission matrix (role x operation)
 * - Current user's role row highlighted with "You" badge
 * - Team context for collections with teamField (user's own teams only)
 * - Expandable field details per collection
 * - Wildcard / default-deny indicators
 *
 * To use: Copy to starter/src/pages/ and add route in App.tsx
 */

import { useState, useMemo } from 'react'
import { useUser, useTeams, type Team } from 'deepspace'
import { analyzePermissions, type ResolvedPermission, type CollectionPermissionSummary, type ColumnDefinition } from 'deepspace/worker'
import { Badge, type BadgeProps } from '../components/ui'
import { ROLES, ROLE_CONFIG, type Role } from '../constants'
import { schemas } from '../schemas'

// ============================================================================
// Constants
// ============================================================================

type BadgeVariant = NonNullable<BadgeProps['variant']>

const LEVEL_DISPLAY: Record<string, { label: string; variant: BadgeVariant }> = {
  'true': { label: 'all', variant: 'success' },
  'false': { label: 'none', variant: 'destructive' },
  'own': { label: 'own', variant: 'default' },
  'unclaimed-or-own': { label: 'unclaimed/own', variant: 'info' },
  'collaborator': { label: 'collaborator', variant: 'warning' },
  'team': { label: 'team', variant: 'warning' },
  'access': { label: 'access', variant: 'warning' },
}

// ============================================================================
// Main Page
// ============================================================================

export default function PermissionsPage() {
  const { user } = useUser()
  const { teams } = useTeams()
  const currentRole = user?.role ?? ROLES.VIEWER
  const roleConfig = ROLE_CONFIG[currentRole as Role] ?? ROLE_CONFIG[ROLES.VIEWER]

  const analysis = useMemo(() => analyzePermissions(schemas), [])

  // Sort roles: use ROLE_CONFIG key order first, then any extras alphabetically
  const roleOrder = Object.keys(ROLE_CONFIG)
  const sortedRoles = useMemo(() => {
    const known = analysis.roles.filter(r => roleOrder.includes(r))
    const unknown = analysis.roles.filter(r => !roleOrder.includes(r)).sort()
    known.sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b))
    return [...known, ...unknown]
  }, [analysis.roles])

  // Filter to only teams the current user is a member of
  const userTeams = useMemo(() => {
    if (!user?.id) return []
    return teams.filter(t =>
      t.createdBy === user.id || t.members?.some(m => m.userId === user.id)
    )
  }, [teams, user?.id])

  return (
    <div className="h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Permissions</h1>
              <p className="text-muted-foreground mt-1">RBAC permission matrix for all collections</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your role:</span>
              <Badge variant={roleConfig.badgeVariant}>{roleConfig.title}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PermissionLegend />
        {analysis.collections.map(collection => (
          <CollectionCard
            key={collection.collection}
            collection={collection}
            roles={sortedRoles}
            currentRole={currentRole}
            userTeams={userTeams}
          />
        ))}
        {analysis.collections.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No collections defined in schemas</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Permission Legend
// ============================================================================

function PermissionLegend() {
  return (
    <div className="bg-muted/40 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">Permission Levels</h3>
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <Badge variant="success">all</Badge>
          <span className="text-muted-foreground">Everyone with role</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="destructive">none</Badge>
          <span className="text-muted-foreground">Denied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="default">own</Badge>
          <span className="text-muted-foreground">Record owner only</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="info">unclaimed/own</Badge>
          <span className="text-muted-foreground">Unclaimed or owner</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="warning">collaborator</Badge>
          <span className="text-muted-foreground">Owner or collaborator</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="warning">team</Badge>
          <span className="text-muted-foreground">Owner / collaborator / team member</span>
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
        <span>
          <span className="border-b border-dashed border-muted-foreground">dashed border</span> = resolved via * wildcard
        </span>
        <span>
          <span className="italic opacity-50">italic + muted</span> = no permission defined (default deny)
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Collection Card
// ============================================================================

function CollectionCard({ collection, roles, currentRole, userTeams }: {
  collection: CollectionPermissionSummary
  roles: string[]
  currentRole: string
  userTeams: Team[]
}) {
  const [expanded, setExpanded] = useState(false)

  const metaBadges: Array<{ label: string; value: string }> = []
  if (collection.ownerField) metaBadges.push({ label: 'owner', value: collection.ownerField })
  if (collection.collaboratorsField) metaBadges.push({ label: 'collaborators', value: collection.collaboratorsField })
  if (collection.teamField) metaBadges.push({ label: 'team', value: collection.teamField })

  return (
    <div className="bg-muted/40 rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <code className="text-sm font-semibold text-primary bg-muted px-2 py-1 rounded">
            {collection.collection}
          </code>
          {metaBadges.map(mb => (
            <span key={mb.label} className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              {mb.label}: <span className="text-muted-foreground">{mb.value}</span>
            </span>
          ))}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
        >
          {expanded ? 'Hide fields' : 'Show fields'}
        </button>
      </div>

      {/* Permission matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Read</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Create</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Update</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Delete</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => {
              const perms = collection.permissions[role]
              if (!perms) return null
              const roleConfig = ROLE_CONFIG[role as Role]
              const isCurrentRole = role === currentRole
              return (
                <tr
                  key={role}
                  className={`border-b border-border/20 last:border-0 ${
                    isCurrentRole ? 'bg-primary/10' : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-foreground">{role}</span>
                    {roleConfig && (
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        {roleConfig.description}
                      </span>
                    )}
                    {isCurrentRole && (
                      <span className="ml-2"><Badge variant="default">You</Badge></span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <PermissionBadge resolved={perms.read} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <PermissionBadge resolved={perms.create} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div>
                      <PermissionBadge resolved={perms.update} />
                      {perms.writableFields && (
                        <div
                          className="mt-1 text-[10px] text-muted-foreground cursor-help"
                          title={`Writable fields: ${perms.writableFields.join(', ')}`}
                        >
                          {perms.writableFields.length} field{perms.writableFields.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <PermissionBadge resolved={perms.delete} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Team context for collections with teamField */}
      {collection.teamField && (
        <TeamContextInfo userTeams={userTeams} teamField={collection.teamField} />
      )}

      {/* Expandable field details */}
      {expanded && (
        <div className="border-t border-border/50">
          <FieldDetailsTable columns={collection.columns} />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Team Context Info
// ============================================================================

function TeamContextInfo({ userTeams, teamField }: { userTeams: Team[]; teamField: string }) {
  return (
    <div className="px-4 py-3 border-t border-border/30 bg-muted/20">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <div className="text-xs">
          <p className="text-muted-foreground mb-1">
            Records in this collection are team-scoped via the <code className="bg-muted px-1 py-0.5 rounded text-primary">{teamField}</code> field.
            The <Badge variant="warning">team</Badge> permission level applies only to records tagged with one of your teams.
          </p>
          {userTeams.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-muted-foreground">Your teams:</span>
              {userTeams.map(t => (
                <span key={t.id} className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {t.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1">You are not a member of any team. Team-scoped permissions will not grant you access to any records.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Permission Badge
// ============================================================================

function PermissionBadge({ resolved }: { resolved: ResolvedPermission }) {
  const key = String(resolved.level)
  const display = LEVEL_DISPLAY[key] ?? { label: key, variant: 'secondary' as BadgeVariant }

  const isWildcard = resolved.source === 'wildcard'
  const isDefaultDeny = resolved.source === 'default-deny'

  const title = isWildcard
    ? `${display.label} (via * wildcard)`
    : isDefaultDeny
    ? 'No permission defined — defaults to deny'
    : display.label

  return (
    <span
      title={title}
      className={`inline-flex ${isDefaultDeny ? 'opacity-50 italic' : ''} ${isWildcard ? '[&>div]:border-dashed' : ''}`}
    >
      <Badge variant={isDefaultDeny ? 'secondary' : display.variant}>
        {display.label}
        {isWildcard && <span className="ml-0.5 opacity-60">*</span>}
      </Badge>
    </span>
  )
}

// ============================================================================
// Field Details Table
// ============================================================================

function FieldDetailsTable({ columns }: { columns: ColumnDefinition[] }) {
  if (columns.length === 0) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">No columns defined</p>
  }

  const interpretationLabel = (col: ColumnDefinition): string => {
    if (typeof col.interpretation === 'string') return col.interpretation
    return col.interpretation.kind
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30 bg-muted/20">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Column</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Storage</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Interpretation</th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">Required</th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">userBound</th>
            <th className="px-4 py-2 text-center font-medium text-muted-foreground">Immutable</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Default</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col.name} className="border-b border-border/10 last:border-0">
              <td className="px-4 py-1.5">
                <code className="text-foreground font-medium">{col.name}</code>
              </td>
              <td className="px-4 py-1.5 text-muted-foreground">{col.storage}</td>
              <td className="px-4 py-1.5 text-muted-foreground">{interpretationLabel(col)}</td>
              <td className="px-4 py-1.5 text-center">
                {col.required && <CheckIcon />}
              </td>
              <td className="px-4 py-1.5 text-center">
                {col.userBound && <CheckIcon />}
              </td>
              <td className="px-4 py-1.5 text-center">
                {col.immutable && <CheckIcon />}
              </td>
              <td className="px-4 py-1.5 text-muted-foreground">
                {col.default !== undefined ? JSON.stringify(col.default) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-success inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
