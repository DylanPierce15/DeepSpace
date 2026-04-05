/**
 * RBAC Test Page
 *
 * Interactive test harness for every RBAC permission pattern.
 * Each section has buttons that deliberately trigger permission errors
 * so you can verify the built-in toast notifications work.
 *
 * To use: Copy to starter/src/pages/ and add route in App.tsx
 */

import { useState } from 'react'
import { useUser, useQuery, useMutations, useTeams } from 'deepspace'
import { useToast, Button, Badge } from '../components/ui'
import { ROLES, ROLE_CONFIG, type Role } from '../constants'

// ============================================================================
// Types
// ============================================================================

interface RbacNote {
  title: string
  body: string
  category: string
  ownerId: string
}

interface RbacBounty {
  title: string
  reward: number
  claimedById: string
  status: string
  submission: string
  createdById: string
}

interface RbacTeamPost {
  teamId: string
  title: string
  content: string
  authorId: string
}

interface RbacSecret {
  key: string
  value: string
}

// ============================================================================
// Main Page
// ============================================================================

export default function RbacTestPage() {
  const { user } = useUser()
  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  const roleConfig = ROLE_CONFIG[userRole] ?? ROLE_CONFIG[ROLES.VIEWER]

  return (
    <div className="h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">RBAC Test Harness</h1>
              <p className="text-muted-foreground mt-1">
                Test every permission pattern — denied actions show toast notifications
              </p>
            </div>
            <Badge variant={roleConfig.badgeVariant} size="sm">
              {roleConfig.title}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <RoleInfo userRole={userRole} />
        <NotesSection userId={user?.id} userRole={userRole} />
        <BountiesSection userId={user?.id} userRole={userRole} />
        <TeamPostsSection userId={user?.id} userRole={userRole} />
        <SecretsSection userRole={userRole} />
        <ErrorTestSection userId={user?.id} userRole={userRole} />
      </div>
    </div>
  )
}

// ============================================================================
// Role Info Banner
// ============================================================================

function RoleInfo({ userRole }: { userRole: Role }) {
  return (
    <div className="bg-muted/40 rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold text-muted-foreground mb-2">Your Permissions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <PermBox label="Notes" role={userRole} perms={{
          viewer: 'Read only',
          member: 'CRUD own, fields restricted',
          admin: 'Full access',
        }} />
        <PermBox label="Bounties" role={userRole} perms={{
          viewer: 'Read only',
          member: 'Create, claim unclaimed',
          admin: 'Full access',
        }} />
        <PermBox label="Team Posts" role={userRole} perms={{
          viewer: 'Read own team',
          member: 'Read + write own team',
          admin: 'Full access',
        }} />
        <PermBox label="Secrets" role={userRole} perms={{
          viewer: 'No access',
          member: 'No access',
          admin: 'Full access',
        }} />
      </div>
    </div>
  )
}

function PermBox({ label, role, perms }: { label: string; role: Role; perms: Record<Role, string> }) {
  return (
    <div className="bg-card/60 rounded-lg border border-border p-3">
      <div className="font-medium text-foreground text-xs mb-1">{label}</div>
      <div className="text-muted-foreground text-xs">{perms[role]}</div>
    </div>
  )
}

// ============================================================================
// Section Wrapper
// ============================================================================

function Section({ title, description, children }: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-muted/40 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  )
}

function TestRow({ label, description, expected, children }: {
  label: string
  description: string
  expected: 'allow' | 'deny'
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            expected === 'allow'
              ? 'bg-success/20 text-success border border-success/40'
              : 'bg-destructive/20 text-destructive border border-destructive/40'
          }`}>
            {expected === 'allow' ? 'SHOULD SUCCEED' : 'SHOULD DENY'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// 1. Notes — ownership + writableFields
// ============================================================================

function NotesSection({ userId, userRole }: { userId?: string; userRole: Role }) {
  const { records: notes } = useQuery<RbacNote>('rbac-notes')
  const { create, put, remove } = useMutations<Partial<RbacNote>>('rbac-notes')
  const toast = useToast()

  const myNote = notes.find(n => n.data.ownerId === userId)
  const otherNote = notes.find(n => n.data.ownerId !== userId)

  const isViewer = userRole === 'viewer'
  const isAdmin = userRole === 'admin'

  return (
    <Section title="1. Notes — Ownership + WritableFields" description="ownerField, 'own' permission, writableFields restriction">
      {/* Create */}
      <TestRow
        label="Create note"
        description="Viewers cannot create. Members and admins can."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button size="sm" onClick={() => { create({ title: `Test note ${Date.now()}`, body: 'Hello', category: 'general' }); toast.success('Note created') }}>
          Create
        </Button>
      </TestRow>

      {/* Update own — allowed field */}
      <TestRow
        label="Update own note (title)"
        description="Members can update title on own notes. Viewers cannot."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!myNote}
          onClick={() => {
            if (myNote) { put(myNote.recordId, { title: `Edited ${Date.now()}` }); toast.success('Title updated') }
            else toast.warning('No note', 'Create a note first')
          }}
        >
          Edit Title
        </Button>
      </TestRow>

      {/* Update own — restricted field */}
      <TestRow
        label="Update own note (category)"
        description="Members cannot update category (not in writableFields). Admins can."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!myNote}
          onClick={() => {
            if (myNote) { put(myNote.recordId, { category: 'restricted' }); toast.success('Category updated') }
            else toast.warning('No note', 'Create a note first')
          }}
        >
          Edit Category
        </Button>
      </TestRow>

      {/* Update someone else's note */}
      <TestRow
        label="Update another user's note"
        description="Members can only edit 'own'. Admins can edit any."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!otherNote}
          onClick={() => {
            if (otherNote) { put(otherNote.recordId, { title: `Hijacked ${Date.now()}` }); toast.success('Other\'s note updated') }
            else toast.info('No other notes', 'Need another user to create a note')
          }}
        >
          Edit Other's
        </Button>
      </TestRow>

      {/* Delete own */}
      <TestRow
        label="Delete own note"
        description="Members can delete own. Viewers cannot."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!myNote}
          onClick={() => {
            if (myNote) { remove(myNote.recordId); toast.success('Note deleted') }
            else toast.warning('No note', 'Create a note first')
          }}
        >
          Delete Own
        </Button>
      </TestRow>

      {/* Delete other's */}
      <TestRow
        label="Delete another user's note"
        description="Only admins can delete others' notes."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!otherNote}
          onClick={() => {
            if (otherNote) { remove(otherNote.recordId); toast.success('Other\'s note deleted') }
            else toast.info('No other notes', 'Need another user to create a note')
          }}
        >
          Delete Other's
        </Button>
      </TestRow>

      {/* Current notes */}
      <div className="mt-2 text-xs text-muted-foreground">
        {notes.length} note(s) loaded — {myNote ? '1 yours' : 'none yours'}, {otherNote ? '1+ others' : 'none from others'}
      </div>
    </Section>
  )
}

// ============================================================================
// 2. Bounties — unclaimed-or-own claiming
// ============================================================================

function BountiesSection({ userId, userRole }: { userId?: string; userRole: Role }) {
  const { records: bounties } = useQuery<RbacBounty>('rbac-bounties')
  const { create, put, remove } = useMutations<Partial<RbacBounty>>('rbac-bounties')
  const toast = useToast()

  const unclaimedBounty = bounties.find(b => !b.data.claimedById)
  const myBounty = bounties.find(b => b.data.claimedById === userId)
  const otherClaimedBounty = bounties.find(b => b.data.claimedById && b.data.claimedById !== userId)

  const isViewer = userRole === 'viewer'
  const isAdmin = userRole === 'admin'

  return (
    <Section title="2. Bounties — Unclaimed-or-Own" description="unclaimed-or-own permission, claiming pattern">
      {/* Create bounty */}
      <TestRow
        label="Create bounty"
        description="Viewers cannot create. Members and admins can."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button size="sm" onClick={() => { create({ title: `Bounty ${Date.now()}`, reward: 25 }); toast.success('Bounty created') }}>
          Create
        </Button>
      </TestRow>

      {/* Claim unclaimed */}
      <TestRow
        label="Claim unclaimed bounty"
        description="Members can claim unclaimed bounties. Viewers cannot."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!unclaimedBounty}
          onClick={() => {
            if (unclaimedBounty) { put(unclaimedBounty.recordId, { claimedById: userId, status: 'claimed' }); toast.success('Bounty claimed') }
            else toast.info('No unclaimed bounties', 'Create one first')
          }}
        >
          Claim
        </Button>
      </TestRow>

      {/* Update own claimed */}
      <TestRow
        label="Submit on own claimed bounty"
        description="Members can update their own claimed bounty."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!myBounty}
          onClick={() => {
            if (myBounty) { put(myBounty.recordId, { submission: 'My submission', status: 'submitted' }); toast.success('Submission sent') }
            else toast.warning('No claimed bounty', 'Claim a bounty first')
          }}
        >
          Submit
        </Button>
      </TestRow>

      {/* Steal someone else's claim */}
      <TestRow
        label="Update another user's claimed bounty"
        description="Members cannot update bounties claimed by others. Admins can."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!otherClaimedBounty}
          onClick={() => {
            if (otherClaimedBounty) { put(otherClaimedBounty.recordId, { status: 'stolen' }); toast.success('Claim stolen') }
            else toast.info('No other claimed bounties', 'Need another user to claim one')
          }}
        >
          Steal Claim
        </Button>
      </TestRow>

      {/* Try to change reward (restricted field for members) */}
      <TestRow
        label="Change bounty reward (restricted field)"
        description="Members cannot change reward (not in writableFields). Admins can."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!myBounty && !unclaimedBounty}
          onClick={() => {
            const target = myBounty ?? unclaimedBounty
            if (target) { put(target.recordId, { reward: 9999 }); toast.success('Reward changed') }
            else toast.warning('No bounty', 'Create a bounty first')
          }}
        >
          Change Reward
        </Button>
      </TestRow>

      <div className="mt-2 text-xs text-muted-foreground">
        {bounties.length} bounty(s) — {unclaimedBounty ? '1+ unclaimed' : 'none unclaimed'}, {myBounty ? '1 yours' : 'none yours'}
      </div>
    </Section>
  )
}

// ============================================================================
// 3. Team Posts — team-scoped permissions
// ============================================================================

function TeamPostsSection({ userId, userRole }: { userId?: string; userRole: Role }) {
  const { teams, create: createTeam, addMember } = useTeams()
  const { records: posts } = useQuery<RbacTeamPost>('rbac-team-posts')
  const { create: createPost, put: updatePost } = useMutations<Partial<RbacTeamPost>>('rbac-team-posts')
  const toast = useToast()

  const myTeam = teams.find(t => t.members?.some(m => m.userId === userId))
  const otherTeam = teams.find(t => !t.members?.some(m => m.userId === userId))
  const myTeamPost = posts.find(p => myTeam && p.data.teamId === myTeam.id)

  const isViewer = userRole === 'viewer'
  const isMember = userRole === 'member'
  const isAdmin = userRole === 'admin'

  return (
    <Section title="3. Team Posts — Team-Scoped Access" description="teamField, 'team' permission level, useTeams">
      {/* Create team */}
      <TestRow
        label="Create a team"
        description="Creates a team and adds you as owner"
        expected="allow"
      >
        <Button
          size="sm"
          onClick={() => {
            const teamId = createTeam(`Team ${Date.now()}`, { isOpen: true })
            toast.success('Team created', `ID: ${teamId.slice(0, 12)}...`)
          }}
        >
          Create Team
        </Button>
      </TestRow>

      {/* Join a team */}
      <TestRow
        label="Join another team"
        description="Join an open team you're not a member of"
        expected={otherTeam ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          disabled={!otherTeam || !userId}
          onClick={() => {
            if (otherTeam && userId) {
              addMember(otherTeam.id, userId)
              toast.info('Joining team', otherTeam.name)
            }
          }}
        >
          Join Team
        </Button>
      </TestRow>

      {/* Create post in own team */}
      <TestRow
        label="Create post in own team"
        description="Viewers cannot create. Members can create in their team."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!myTeam}
          onClick={() => {
            if (myTeam) { createPost({ teamId: myTeam.id, title: `Post ${Date.now()}`, content: 'Hello team!' }); toast.success('Post created') }
            else toast.warning('No team', 'Join or create a team first')
          }}
        >
          Post in Team
        </Button>
      </TestRow>

      {/* Update own team's post */}
      <TestRow
        label="Update own team's post"
        description="Members can update posts in their team. Viewers cannot."
        expected={isViewer ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          disabled={!myTeamPost}
          onClick={() => {
            if (myTeamPost) { updatePost(myTeamPost.recordId, { content: `Updated ${Date.now()}` }); toast.success('Post updated') }
            else toast.warning('No post', 'Create a team post first')
          }}
        >
          Edit Team Post
        </Button>
      </TestRow>

      {/* Create post in other team */}
      <TestRow
        label="Create post in another team"
        description="Members can create posts but team-scoped update will be checked. Viewer denied entirely."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!otherTeam}
          onClick={() => {
            if (otherTeam) { createPost({ teamId: otherTeam.id, title: `Intruder ${Date.now()}`, content: 'I shouldn\'t be here' }); toast.success('Post created in other team') }
            else toast.info('No other team', 'Need another team to exist')
          }}
        >
          Post in Other Team
        </Button>
      </TestRow>

      <div className="mt-2 text-xs text-muted-foreground">
        {teams.length} team(s) — {myTeam ? `in "${myTeam.name}"` : 'not in any team'} — {posts.length} post(s)
      </div>
    </Section>
  )
}

// ============================================================================
// 4. Secrets — admin-only collection
// ============================================================================

function SecretsSection({ userRole }: { userRole: Role }) {
  const { records: secrets } = useQuery<RbacSecret>('rbac-secrets')
  const { create, put, remove } = useMutations<RbacSecret>('rbac-secrets')
  const toast = useToast()

  const isAdmin = userRole === 'admin'

  return (
    <Section title="4. Secrets — Admin-Only Collection" description="All viewer/member operations should be denied">
      {/* Create */}
      <TestRow
        label="Create secret"
        description="Only admins can create. Viewer/member denied."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant={isAdmin ? 'primary' : 'danger'}
          onClick={() => { create({ key: `secret-${Date.now()}`, value: 'classified' }); toast.success('Secret created') }}
        >
          Create Secret
        </Button>
      </TestRow>

      {/* Update */}
      <TestRow
        label="Update secret"
        description="Only admins can update. Viewer/member denied."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={secrets.length === 0}
          onClick={() => {
            if (secrets[0]) { put(secrets[0].recordId, { key: secrets[0].data.key, value: 'hacked' }); toast.success('Secret updated') }
            else toast.info('No secrets', 'Create one first (as admin)')
          }}
        >
          Update Secret
        </Button>
      </TestRow>

      {/* Delete */}
      <TestRow
        label="Delete secret"
        description="Only admins can delete. Viewer/member denied."
        expected={isAdmin ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={secrets.length === 0}
          onClick={() => {
            if (secrets[0]) { remove(secrets[0].recordId); toast.success('Secret deleted') }
            else toast.info('No secrets', 'Create one first (as admin)')
          }}
        >
          Delete Secret
        </Button>
      </TestRow>

      <div className="mt-2 text-xs text-muted-foreground">
        {secrets.length} secret(s) loaded (may be 0 if not admin — read also denied)
      </div>
    </Section>
  )
}

// ============================================================================
// 5. Error Types — test different error categories
// ============================================================================

function ErrorTestSection({ userId, userRole }: { userId?: string; userRole: Role }) {
  const { records: notes } = useQuery<RbacNote>('rbac-notes')
  const { records: posts } = useQuery<RbacTeamPost>('rbac-team-posts')
  const { create: createNote, put: updateNote } = useMutations<Partial<RbacNote>>('rbac-notes')
  const { create: createBounty } = useMutations<Partial<RbacBounty>>('rbac-bounties')
  const { put: updatePost } = useMutations<Partial<RbacTeamPost>>('rbac-team-posts')
  const toast = useToast()

  const myNote = notes.find(n => n.data.ownerId === userId)

  return (
    <Section title="5. Error Types" description="RBAC errors show as toasts, validation/other errors go to the error overlay (widget context only)">
      {/* -- RBAC Errors (-> toast) -- */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 pt-2">
        RBAC Errors — should show toast
      </div>

      <TestRow
        label="Collection-level deny"
        description="Viewers can't create notes. Members and admins can."
        expected={userRole === 'viewer' ? 'deny' : 'allow'}
      >
        <Button
          size="sm"
          variant={userRole === 'viewer' ? 'danger' : 'primary'}
          onClick={() => createNote({ title: 'Nope', body: 'Should fail', category: 'general' })}
        >
          Create as {userRole}
        </Button>
      </TestRow>

      <TestRow
        label="Field restriction"
        description="Update a restricted field (category) on own note — denied for members"
        expected={userRole === 'admin' ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!myNote}
          onClick={() => {
            if (myNote) updateNote(myNote.recordId, { category: 'hacked' })
            else toast.warning('Create a note first')
          }}
        >
          Edit Category
        </Button>
      </TestRow>

      <TestRow
        label="Ownership violation"
        description="Try to update another user's note — denied for members"
        expected={userRole === 'admin' ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant="danger"
          disabled={notes.filter(n => n.data.ownerId !== userId).length === 0}
          onClick={() => {
            const other = notes.find(n => n.data.ownerId !== userId)
            if (other) updateNote(other.recordId, { title: 'Stolen' })
            else toast.info('Need another user\'s note')
          }}
        >
          Edit Other's Note
        </Button>
      </TestRow>

      {/* -- Validation Errors (-> error overlay) -- */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 pt-4">
        Validation Errors — should show in error overlay (widget) or console (standalone)
      </div>

      <TestRow
        label="Missing required field"
        description="Create a note without the required 'title' field"
        expected="deny"
      >
        <Button
          size="sm"
          variant="danger"
          onClick={() => createNote({ body: 'No title provided', category: 'test' } as Partial<RbacNote>)}
        >
          Create Without Title
        </Button>
      </TestRow>

      <TestRow
        label="Immutable field change"
        description="Try to change ownerId on an existing note (marked immutable)"
        expected="deny"
      >
        <Button
          size="sm"
          variant="danger"
          disabled={!myNote}
          onClick={() => {
            if (myNote) updateNote(myNote.recordId, { ownerId: 'fake-user-id' })
            else toast.warning('Create a note first')
          }}
        >
          Change Owner
        </Button>
      </TestRow>

      <TestRow
        label="userBound violation"
        description="Create a bounty with someone else's ID. Admins can override, others denied."
        expected={userRole === 'admin' ? 'allow' : 'deny'}
      >
        <Button
          size="sm"
          variant={userRole === 'admin' ? 'primary' : 'danger'}
          onClick={() => createBounty({ title: 'Spoofed', reward: 999, createdById: 'not-me' } as Partial<RbacBounty>)}
        >
          Spoof Creator
        </Button>
      </TestRow>

      <TestRow
        label="Immutable field change (teamId)"
        description="Try to move a team post to a different team (teamId is immutable)"
        expected="deny"
      >
        <Button
          size="sm"
          variant="danger"
          disabled={posts.length === 0}
          onClick={() => {
            if (posts[0]) updatePost(posts[0].recordId, { teamId: 'different-team' })
            else toast.info('Need a team post to test against')
          }}
        >
          Change Team
        </Button>
      </TestRow>
    </Section>
  )
}
