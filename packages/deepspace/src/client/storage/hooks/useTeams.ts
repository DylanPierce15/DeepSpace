/**
 * useTeams Hook
 *
 * Collection-based team management backed by workspace:default.
 * Teams and team_members are regular queryable collections with
 * real-time subscriptions — no built-in RecordRoom team infrastructure.
 *
 * Supports adding members by userId, email, or username.
 *
 * - By userId: adds directly as a team_member record
 * - By email: looks up user → adds if found, creates pending invite if not
 * - By username: looks up user → adds if found, creates pending invite (via resolved email) if not
 *
 * Pending invites are stored as team_member records with Status='invited'.
 */

import { useMemo, useCallback, useRef } from 'react'
import { useQuery } from './useQuery'
import { useMutations } from './useMutations'
import { useUser } from './useUser'
import { getAuthToken } from '../../auth'
import { getApiUrl } from '@/shared/env'
import type { Team, TeamMember, TeamMemberIdentifier, AddMemberResult } from '../types'

// ============================================================================
// Record shapes (PascalCase column names from workspace schemas)
// ============================================================================

interface TeamRecord {
  Name: string
  CreatedBy: string
  IsOpen: number
}

interface TeamMemberRecord {
  TeamId: string
  UserId: string
  RoleInTeam: string
  JoinedAt: string
  Email: string
  Status: string
}

// ============================================================================
// Options
// ============================================================================

/**
 * Options for addMember when using email/username identifiers.
 */
export interface AddMemberOptions {
  roleInTeam?: string
  /**
   * Send an email notification to the member.
   * - If the user exists: sends a "You've been added to {team}" notification.
   * - If the user doesn't exist: sends a "You've been invited to join {team}" invite.
   * Requires miniappId. Uses the platform email service (noreply@{miniappId}.app.space).
   */
  sendEmail?: boolean
  /**
   * Miniapp ID for sending emails (e.g., 'my-task-app').
   * Required when sendEmail is true.
   */
  miniappId?: string
  /**
   * Custom team name to include in the email.
   * Falls back to the team name from the teams list.
   */
  teamName?: string
}

// ============================================================================
// Lookup API response
// ============================================================================

interface LookupUserResponse {
  success: boolean
  data?: {
    found: boolean
    userId?: string
    name?: string
    email?: string
    publicUsername?: string
  }
  error?: string
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Team management hook backed by workspace:default collections.
 *
 * Teams and team_members are stored as regular queryable collections
 * with real-time WebSocket subscriptions. Create teams, add/remove
 * members, delete teams.
 *
 * @example
 * ```tsx
 * const { teams, create, addMember } = useTeams()
 *
 * // Create a team
 * create('Engineering')
 *
 * // Add member by userId (direct)
 * addMember(teamId, 'user_abc123', 'member')
 *
 * // Add member by email (resolves or creates pending invite)
 * const result = await addMember(teamId, { email: 'jane@example.com' })
 * if (result.status === 'invited') console.log('Invite sent!')
 *
 * // Add member by username
 * await addMember(teamId, { username: 'janedoe' })
 *
 * // Add with email notification (works for both existing & new users)
 * await addMember(teamId, { email: 'jane@example.com' }, {
 *   sendEmail: true,
 *   miniappId: 'my-task-app',
 *   teamName: 'Engineering',
 * })
 * ```
 */
export function useTeams(): {
  teams: Team[]
  /**
   * True while teams/team_members queries are still loading from the server.
   * Use this to distinguish "loading" from "user has no teams."
   */
  loading: boolean
  create: (name: string, options?: { isOpen?: boolean }) => string
  /**
   * Add a member to a team.
   *
   * @param teamId - The team to add the member to
   * @param member - userId string (direct add) or { email } / { username } identifier
   * @param roleOrOptions - Role string or AddMemberOptions object
   * @returns Promise<AddMemberResult> with the outcome
   */
  addMember: (
    teamId: string,
    member: string | TeamMemberIdentifier,
    roleOrOptions?: string | AddMemberOptions,
  ) => Promise<AddMemberResult>
  removeMember: (teamId: string, userId: string) => void
  /**
   * Cancel a pending invite.
   * @param teamId - The team the invite belongs to
   * @param inviteId - The invite record ID
   */
  cancelInvite: (teamId: string, inviteId: string) => void
  deleteTeam: (teamId: string) => void
  refresh: () => void
} {
  const { user } = useUser()
  const { records: teamRecords, status: teamStatus } = useQuery<TeamRecord>('teams')
  const { records: memberRecords, status: memberStatus } = useQuery<TeamMemberRecord>('team_members')

  const loading = teamStatus === 'loading' || memberStatus === 'loading'

  const { put: putTeam, remove: removeTeamRecord } = useMutations<TeamRecord>('teams')
  const { create: createMemberRecord, remove: removeMemberRecord } = useMutations<TeamMemberRecord>('team_members')

  const memberRecordsRef = useRef(memberRecords)
  memberRecordsRef.current = memberRecords

  // Build Team[] with embedded members — same shape consumers expect
  const teams: Team[] = useMemo(() => {
    return (teamRecords || []).map(r => {
      const members: TeamMember[] = (memberRecords || [])
        .filter(m => m.data.TeamId === r.recordId)
        .map(m => {
          const isPending = m.data.Status === 'invited'
          return {
            // For pending invites, use the record ID as userId so cancelInvite(teamId, member.userId) works
            userId: isPending ? m.recordId : (m.data.UserId || ''),
            roleInTeam: m.data.RoleInTeam || 'member',
            joinedAt: m.data.JoinedAt || m.createdAt,
            status: (isPending ? 'pending' : 'active') as 'active' | 'pending',
            email: m.data.Email || undefined,
          }
        })

      return {
        id: r.recordId,
        name: r.data.Name || '',
        createdBy: r.data.CreatedBy || r.createdBy,
        createdAt: r.createdAt,
        isOpen: !!r.data.IsOpen,
        members,
      }
    })
  }, [teamRecords, memberRecords])

  const teamsRef = useRef(teams)
  teamsRef.current = teams

  // ── Create team ──────────────────────────────────────────────────────

  const create = useCallback((name: string, options?: { isOpen?: boolean }): string => {
    const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    void putTeam(teamId, {
      Name: name,
      CreatedBy: user?.id || '',
      IsOpen: options?.isOpen ? 1 : 0,
    })
    void createMemberRecord({
      TeamId: teamId,
      UserId: user?.id || '',
      RoleInTeam: 'owner',
      JoinedAt: new Date().toISOString(),
      Email: user?.email || '',
      Status: 'active',
    })
    return teamId
  }, [putTeam, createMemberRecord, user])

  // ── Add member (supports userId, email, username) ────────────────────

  const addMember = useCallback(async (
    teamId: string,
    member: string | TeamMemberIdentifier,
    roleOrOptions?: string | AddMemberOptions,
  ): Promise<AddMemberResult> => {
    const options: AddMemberOptions = typeof roleOrOptions === 'string'
      ? { roleInTeam: roleOrOptions }
      : (roleOrOptions ?? {})
    const roleInTeam = options.roleInTeam ?? 'member'

    // Case 1: Direct userId string
    if (typeof member === 'string') {
      void createMemberRecord({
        TeamId: teamId,
        UserId: member,
        RoleInTeam: roleInTeam,
        JoinedAt: new Date().toISOString(),
        Email: '',
        Status: 'active',
      })
      return { status: 'added', userId: member }
    }

    // Case 2a: { userId } — direct add
    if ('userId' in member) {
      void createMemberRecord({
        TeamId: teamId,
        UserId: member.userId,
        RoleInTeam: roleInTeam,
        JoinedAt: new Date().toISOString(),
        Email: '',
        Status: 'active',
      })
      return { status: 'added', userId: member.userId }
    }

    // Case 2b: { email } — look up, then add or invite
    if ('email' in member) {
      return resolveAndAdd(teamId, { email: member.email }, roleInTeam, options)
    }

    // Case 2c: { username } — look up, then add or invite
    if ('username' in member) {
      return resolveAndAdd(teamId, { username: member.username }, roleInTeam, options)
    }

    return { status: 'error', error: 'Invalid member identifier' }
  }, [createMemberRecord])

  /**
   * Look up a user by email or username via the central API,
   * then either add them directly or create a pending invite.
   * Sends an email notification in both cases when sendEmail is true.
   */
  async function resolveAndAdd(
    teamId: string,
    lookup: { email: string } | { username: string },
    roleInTeam: string,
    options: AddMemberOptions,
  ): Promise<AddMemberResult> {
    try {
      const lookupPayload = 'email' in lookup
        ? { email: lookup.email }
        : { username: lookup.username }

      const token = await getAuthToken()
      const lookupRes = await fetch(`${getApiUrl()}/api/lookup-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(lookupPayload),
      })
      const response = await lookupRes.json() as LookupUserResponse

      if (response.success && response.data?.found && response.data.userId) {
        const recipientEmail = response.data.email ?? ('email' in lookup ? lookup.email : undefined)
        void createMemberRecord({
          TeamId: teamId,
          UserId: response.data.userId,
          RoleInTeam: roleInTeam,
          JoinedAt: new Date().toISOString(),
          Email: recipientEmail || '',
          Status: 'active',
        })

        if (options.sendEmail && options.miniappId && recipientEmail) {
          await sendTeamEmail(recipientEmail, teamId, 'added', options)
        }
        return { status: 'added', userId: response.data.userId }
      }

      // User not found — create pending invite
      const inviteEmail = 'email' in lookup
        ? lookup.email
        : response.data?.email

      if (!inviteEmail) {
        return {
          status: 'error',
          error: 'username' in lookup
            ? `User @${lookup.username} not found. Cannot create invite without email.`
            : 'Could not determine email for invite.',
        }
      }

      void createMemberRecord({
        TeamId: teamId,
        UserId: '',
        RoleInTeam: roleInTeam,
        JoinedAt: new Date().toISOString(),
        Email: inviteEmail,
        Status: 'invited',
      })

      if (options.sendEmail && options.miniappId) {
        await sendTeamEmail(inviteEmail, teamId, 'invited', options)
      }

      return { status: 'invited', email: inviteEmail }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to look up user'
      console.error('[useTeams] resolveAndAdd error:', message)
      return { status: 'error', error: message }
    }
  }

  /**
   * Send a team email notification using the miniapp email service.
   *
   * @param emailType - 'added' for existing users, 'invited' for pending invites
   */
  async function sendTeamEmail(
    email: string,
    teamId: string,
    emailType: 'added' | 'invited',
    options: AddMemberOptions,
  ): Promise<void> {
    if (!options.miniappId) return

    const teamName = options.teamName ?? teamsRef.current.find(t => t.id === teamId)?.name ?? 'a team'
    const subject = emailType === 'added'
      ? `You've been added to ${teamName}`
      : `You've been invited to join ${teamName}`
    const html = emailType === 'added'
      ? buildAddedEmailHtml(teamName, options.miniappId)
      : buildInviteEmailHtml(teamName, options.miniappId)

    try {
      const token = await getAuthToken()
      const res = await fetch(`${getApiUrl()}/api/miniapp-send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          miniappId: options.miniappId,
          to: email,
          subject,
          html,
        }),
      })
      if (!res.ok) {
        console.error('[useTeams] Email send failed:', res.status, await res.text())
      }
    } catch (err) {
      console.error('[useTeams] Email send failed:', err instanceof Error ? err.message : err)
    }
  }

  // ── Remove member ────────────────────────────────────────────────────

  const removeMember = useCallback((teamId: string, userId: string) => {
    const record = (memberRecordsRef.current || []).find(
      m => m.data.TeamId === teamId && m.data.UserId === userId,
    )
    if (record) {
      void removeMemberRecord(record.recordId)
    }
  }, [removeMemberRecord])

  // ── Cancel invite ────────────────────────────────────────────────────

  const cancelInvite = useCallback((teamId: string, inviteId: string) => {
    // inviteId is the recordId of the pending team_member record
    // (we expose it as `userId` on pending TeamMembers for backward compat)
    const record = (memberRecordsRef.current || []).find(
      m => m.data.TeamId === teamId
        && m.data.Status === 'invited'
        && (m.recordId === inviteId || m.data.Email === inviteId),
    )
    if (record) {
      void removeMemberRecord(record.recordId)
    }
  }, [removeMemberRecord])

  // ── Delete team ──────────────────────────────────────────────────────

  const deleteTeam = useCallback((teamId: string) => {
    void removeTeamRecord(teamId)
    const members = (memberRecordsRef.current || []).filter(m => m.data.TeamId === teamId)
    for (const m of members) {
      void removeMemberRecord(m.recordId)
    }
  }, [removeTeamRecord, removeMemberRecord])

  // ── Refresh (no-op — useQuery provides real-time updates) ────────────

  const refresh = useCallback(() => {
    // Collection-based teams update in real-time via WebSocket subscriptions.
  }, [])

  return { teams, loading, create, addMember, removeMember, cancelInvite, deleteTeam, refresh }
}

// ============================================================================
// Email templates
// ============================================================================

/**
 * Build HTML email for when an existing user is added to a team.
 * They already have an account — just need to open the app.
 */
function buildAddedEmailHtml(teamName: string, miniappId: string): string {
  const appUrl = `https://${miniappId}.app.space`
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">You've been added to a team!</h2>
      <p style="color: #444; line-height: 1.6;">
        You've been added to <strong>${teamName}</strong>. You can start collaborating right away.
      </p>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
        Open App
      </a>
      <p style="color: #888; font-size: 13px; margin-top: 24px;">
        If you didn't expect this, you can safely ignore this email.
      </p>
    </div>
  `.trim()
}

/**
 * Build HTML email for inviting a user who doesn't have an account yet.
 * They need to sign up first.
 */
function buildInviteEmailHtml(teamName: string, miniappId: string): string {
  const appUrl = `https://${miniappId}.app.space`
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #1a1a1a; margin-bottom: 16px;">You've been invited!</h2>
      <p style="color: #444; line-height: 1.6;">
        You've been invited to join <strong>${teamName}</strong>.
      </p>
      <p style="color: #444; line-height: 1.6;">
        Sign up and visit the app to accept your invitation and start collaborating:
      </p>
      <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
        Get Started
      </a>
      <p style="color: #888; font-size: 13px; margin-top: 24px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `.trim()
}
