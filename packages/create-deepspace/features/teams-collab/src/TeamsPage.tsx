/**
 * Teams Page
 *
 * Demonstrates:
 * - useTeams for team management
 * - useYjsText for real-time collaborative editing
 * - Team-based document sharing
 *
 * To use: Copy to starter/src/pages/ and add route in App.tsx
 */

import { useState, useMemo, useCallback } from 'react'
import { useUser, useUsers, useTeams, useQuery, useMutations, useYjsText, RecordScope } from 'deepspace'
import { Button, Modal, Badge, Avatar, EmptyState } from '../components/ui'
import { ROLES, type Role } from '../constants'
import { schemas } from '../schemas'
import { APP_NAME } from '../constants'

// ============================================================================
// Types
// ============================================================================

interface TeamDocument {
  teamId: string
  title: string
}

// ============================================================================
// Create Team Modal
// ============================================================================

interface CreateTeamModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

function CreateTeamModal({ isOpen, onClose, onCreate }: CreateTeamModalProps) {
  const [name, setName] = useState('')

  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name.trim())
      setName('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Team" maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Team Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Project Alpha"
            className="w-full px-3 py-2 bg-transparent border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-ring"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Create Team</Button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================================================
// Collaborative Document Editor
// ============================================================================

interface DocumentEditorProps {
  documentId: string
  title: string
}

function DocumentEditor({ documentId, title }: DocumentEditorProps) {
  // useYjsText provides real-time collaborative text editing
  const { text, setText, synced, canWrite } = useYjsText('team-docs', documentId, 'content')

  return (
    <div className="bg-muted/40 rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {synced ? (
            <span className="text-xs text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              Synced
            </span>
          ) : (
            <span className="text-xs text-warning flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
              Syncing...
            </span>
          )}
          {canWrite ? (
            <Badge variant="success" size="sm">Edit</Badge>
          ) : (
            <Badge variant="secondary" size="sm">View</Badge>
          )}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!synced || !canWrite}
        placeholder={canWrite ? "Start typing... (changes sync in real-time)" : "View only"}
        className="w-full h-48 px-4 py-3 bg-transparent text-foreground placeholder-muted-foreground resize-none focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}

// ============================================================================
// Team Detail View
// ============================================================================

interface TeamDetailProps {
  teamId: string
  onBack: () => void
}

function TeamDetail({ teamId, onBack }: TeamDetailProps) {
  const { user } = useUser()
  const { teams, addMember, removeMember, deleteTeam } = useTeams()
  const { users } = useUsers()
  const [newDocTitle, setNewDocTitle] = useState('')

  const team = teams.find(t => t.id === teamId)

  // Query team documents
  const { records: documents } = useQuery<TeamDocument>('team-docs', {
    where: { teamId }
  })
  const { create: createDocument, remove: removeDocument } = useMutations<TeamDocument>('team-docs')

  // Get member details
  const memberDetails = useMemo(() => {
    if (!team?.members) return []
    return team.members.map(m => {
      const userInfo = users.find(u => u.id === m.userId)
      return {
        ...m,
        name: userInfo?.name ?? 'Unknown',
        email: userInfo?.email ?? '',
      }
    })
  }, [team?.members, users])

  const isCreator = team?.createdBy === user?.id
  const isAdmin = user?.role === 'admin'
  const canManage = isCreator || isAdmin

  const handleCreateDocument = () => {
    if (newDocTitle.trim()) {
      createDocument({
        teamId,
        title: newDocTitle.trim(),
      })
      setNewDocTitle('')
    }
  }

  const handleDeleteTeam = () => {
    if (confirm('Are you sure you want to delete this team?')) {
      deleteTeam(teamId)
      onBack()
    }
  }

  if (!team) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Team not found</p>
        <Button variant="secondary" onClick={onBack} className="mt-4">Back to Teams</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-muted/60 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{team.name}</h2>
            <p className="text-sm text-muted-foreground">{memberDetails.length} member{memberDetails.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="secondary" onClick={handleDeleteTeam}>Delete Team</Button>
        )}
      </div>

      {/* Members */}
      <div className="bg-card/60 rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Members</h3>
        </div>
        <div className="divide-y divide-border/30">
          {memberDetails.map(member => (
            <div key={member.userId} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.roleInTeam === 'lead' ? 'warning' : 'secondary'} size="sm">
                  {member.roleInTeam}
                </Badge>
                {canManage && member.userId !== team.createdBy && (
                  <button
                    onClick={() => removeMember(teamId, member.userId)}
                    className="p-1 hover:bg-muted/60 rounded transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-card/60 rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-muted-foreground">Shared Documents</h3>
          <p className="text-xs text-muted-foreground mt-1">Real-time collaborative editing with Yjs</p>
        </div>

        {/* Create Document */}
        <div className="px-4 py-3 border-b border-border/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="New document title..."
              className="flex-1 px-3 py-2 bg-transparent border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-ring"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
            />
            <Button onClick={handleCreateDocument} disabled={!newDocTitle.trim()}>
              Create
            </Button>
          </div>
        </div>

        {/* Document List */}
        <div className="p-4 space-y-4">
          {documents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No documents yet. Create one above!</p>
          ) : (
            documents.map(doc => (
              <RecordScope
                key={doc.recordId}
                roomId={`doc:${doc.recordId}`}
                schemas={schemas}
                appId={APP_NAME}
              >
                <DocumentEditor
                  documentId={doc.recordId}
                  title={doc.data.title}
                />
              </RecordScope>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export default function TeamsPage() {
  const { user } = useUser()
  const { teams, create: createTeam } = useTeams()
  const { users } = useUsers()
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  // Filter teams to only show teams user is a member of
  const myTeams = useMemo(() => {
    if (!user?.id) return []
    return teams.filter(team =>
      team.members?.some(m => m.userId === user.id)
    )
  }, [teams, user?.id])

  // Get creator name for each team
  const getCreatorName = useCallback((createdBy: string) => {
    const creator = users.find(u => u.id === createdBy)
    return creator?.name ?? 'Unknown'
  }, [users])

  const handleCreateTeam = useCallback((name: string) => {
    createTeam(name)
  }, [createTeam])

  // Show team detail if selected
  if (selectedTeamId) {
    return (
      <div className="h-full bg-background overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TeamDetail teamId={selectedTeamId} onBack={() => setSelectedTeamId(null)} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      {/* Header */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Teams</h1>
              <p className="text-muted-foreground mt-1">Collaborate with shared documents</p>
            </div>
            <Button onClick={() => setShowCreateTeam(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Team
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {myTeams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Create a team to start collaborating with others on shared documents"
            icon={
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {myTeams.map(team => {
              const memberCount = team.members?.length ?? 0
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className="text-left p-4 bg-card/60 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{team.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>Created by {getCreatorName(team.createdBy)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={showCreateTeam}
        onClose={() => setShowCreateTeam(false)}
        onCreate={handleCreateTeam}
      />
    </div>
  )
}
