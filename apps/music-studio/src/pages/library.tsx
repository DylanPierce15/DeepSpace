/**
 * Library — Instagram-style personal music profile.
 *
 * Layout:
 *   Profile header  (avatar, name, stats: tracks · followers · following)
 *   Tab bar         (Published · Drafts · Remixed)
 *   3-col grid      (Published / Remixed) or list (Drafts)
 */

import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Music2, Heart, Play, GitFork, Clock,
  Plus, Edit3, Users, Radio, Trash2, AlertTriangle,
} from 'lucide-react'
import { useQuery, useMutations, useUser } from 'deepspace'
import { useProjects } from '../hooks/useProjects'
import { useFollowingIds } from '../hooks/useSocial'
import { cn } from '../components/ui'

// ── Confirm-delete modal ──────────────────────────────────────────────────────
function ConfirmDelete({ title, desc, onConfirm, onCancel }: {
  title: string; desc: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-card border border-border rounded-2xl p-6 w-80 shadow-card" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm font-medium bg-muted/40 text-foreground hover:bg-muted/60 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-medium bg-destructive text-white hover:bg-destructive/80 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function seedGradient(seed: string): string {
  let h = 0
  for (const c of seed) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff
  const h1 = h % 360
  const h2 = (h1 + 130) % 360
  return `linear-gradient(160deg, hsl(${h1},55%,10%) 0%, hsl(${h2},65%,18%) 60%, hsl(${(h2+40)%360},50%,8%) 100%)`
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Published track grid cell ─────────────────────────────────────────────────

function TrackGridCell({ project, reactions, onClick, onDelete }: {
  project:   any
  reactions: any[]
  onClick:   () => void
  onDelete?: () => void
}) {
  const likes = useMemo(
    () => reactions.filter((r: any) => r.data.projectId === project.recordId && r.data.reactionType === 'like').length,
    [reactions, project.recordId]
  )
  const plays = useMemo(
    () => reactions.filter((r: any) => r.data.projectId === project.recordId && r.data.reactionType === 'play').length,
    [reactions, project.recordId]
  )

  const hasCover = !!project.data.coverImageUrl

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden group hover:scale-[1.02] transition-transform"
    >
      {/* Background */}
      {hasCover ? (
        <img src={project.data.coverImageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full" style={{ background: seedGradient(project.recordId) }} />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Mini waveform decoration */}
      <div className="absolute bottom-6 inset-x-2 flex items-end gap-px h-5 opacity-60">
        {Array.from({ length: 20 }, (_, i) => {
          let s = project.recordId.charCodeAt(i % project.recordId.length) * (i + 1)
          s = (s * 1664525 + 1013904223) & 0xffffffff
          const h = 20 + ((s >>> 0) / 0xffffffff) * 80
          return (
            <div key={i} className="flex-1 rounded-sm bg-white" style={{ height: `${h}%` }} />
          )
        })}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 p-2">
        <p className="text-xs font-bold text-white truncate leading-tight">{project.data.name}</p>
      </div>

      {/* Hover overlay with stats + delete */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-white">
            <Play className="w-4 h-4 fill-current" />
            <span className="text-sm font-bold">{plays}</span>
          </div>
          <div className="flex items-center gap-1 text-white">
            <Heart className="w-4 h-4 fill-current" />
            <span className="text-sm font-bold">{likes}</span>
          </div>
        </div>
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/80 text-white text-xs font-semibold hover:bg-destructive transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Delete
          </button>
        )}
      </div>

      {/* Remix badge */}
      {project.data.remixedFrom && (
        <div className="absolute top-2 right-2 p-1 rounded-full bg-primary/40 backdrop-blur-sm">
          <GitFork className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  )
}

// ── Draft list row ────────────────────────────────────────────────────────────

function DraftRow({ project, onOpen, onDelete }: {
  project:  any
  onOpen:   () => void
  onDelete: () => void
}) {
  const tracks = useMemo(() => {
    try { return JSON.parse(project.data.tracks || '[]') } catch { return [] }
  }, [project.data.tracks])

  const hasContent = tracks.some((t: any) => {
    if (t.type === 'synth') return (t.clips?.some((c: any) => c.notes?.length > 0)) || (t.notes?.length > 0)
    if (t.type === 'drums') return t.pattern?.some((row: boolean[]) => row.some(Boolean))
    return false
  })

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors group">
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center"
        style={{ background: seedGradient(project.recordId) }}
      >
        <Music2 className="w-5 h-5 text-white/60" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{project.data.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{project.data.bpm} BPM</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">{timeAgo(project.data.updatedAt)}</span>
          {!hasContent && (
            <span className="px-1.5 py-0.5 rounded-full bg-warning/10 border border-warning/30 text-warning text-xs font-medium">
              Empty
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onOpen}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Edit3 className="w-3 h-3" /> Continue
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete draft"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-black text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type LibTab = 'published' | 'drafts' | 'remixed'

export default function LibraryPage() {
  const navigate   = useNavigate()
  const { user }   = useUser()
  const [tab, setTab] = useState<LibTab>('published')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'draft' | 'published'; name: string } | null>(null)
  const { load }   = useProjects()
  const { remove: removeDraft }     = useMutations('projects')
  const { remove: removePublished } = useMutations('published-projects')

  // My published tracks
  const { records: rawPublished } = useQuery('published-projects', {
    where:    { authorId: user?.id ?? '__none__' },
    orderBy:  'publishedAt',
    orderDir: 'desc',
  })

  // My private projects (drafts)
  const { records: rawProjects } = useQuery('projects', {
    orderBy:  'updatedAt',
    orderDir: 'desc',
  })

  // All reactions for like/play counts
  const { records: allReactions } = useQuery('track-reactions')

  // Follower/following counts
  const { records: myFollowers } = useQuery('producer-follows', {
    where: { followingId: user?.id ?? '__none__' },
  })
  const followingIds = useFollowingIds()

  const published = rawPublished as any[]
  const projects  = rawProjects  as any[]

  // Drafts = my saved projects that are not published (visibility = 'private')
  const drafts = useMemo(
    () => projects.filter((p: any) => p.data.visibility === 'private'),
    [projects]
  )

  // Remixed = published tracks I made by remixing someone else's
  const remixed = useMemo(
    () => published.filter((p: any) => !!p.data.remixedFrom),
    [published]
  )

  const tabs: { id: LibTab; label: string; count: number }[] = [
    { id: 'published', label: 'Published', count: published.length },
    { id: 'drafts',    label: 'Drafts',    count: drafts.length },
    { id: 'remixed',   label: 'Remixed',   count: remixed.length },
  ]

  const gridItems = tab === 'remixed' ? remixed : published

  const totalLikes = useMemo(() => {
    const myIds = new Set(published.map(p => p.recordId))
    return (allReactions as any[]).filter(r => myIds.has(r.data.projectId) && r.data.reactionType === 'like').length
  }, [published, allReactions])

  const totalPlays = useMemo(() => {
    const myIds = new Set(published.map(p => p.recordId))
    return (allReactions as any[]).filter(r => myIds.has(r.data.projectId) && r.data.reactionType === 'play').length
  }, [published, allReactions])

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-xl mx-auto">

        {/* ── Profile header ──────────────────────────────────────────────── */}
        <div className="px-4 pt-8 pb-6">
          <div className="flex items-start gap-5">

            {/* Avatar */}
            <div className="relative shrink-0">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-20 h-20 rounded-full ring-2 ring-primary/40 object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-3xl font-black text-white">
                  {user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              {/* Live indicator if user has published content */}
              {published.length > 0 && (
                <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-success border-2 border-background" />
              )}
            </div>

            {/* Stats */}
            <div className="flex-1">
              <h1 className="text-xl font-black text-foreground leading-tight">
                {user?.name ?? 'Producer'}
              </h1>
              <p className="text-sm text-muted-foreground mb-3">@{user?.publicUsername ?? user?.email?.split('@')[0] ?? 'user'}</p>

              <div className="flex gap-6">
                <StatPill label="Tracks"    value={published.length} />
                <StatPill label="Followers" value={myFollowers.length} />
                <StatPill label="Following" value={followingIds.length} />
              </div>
            </div>
          </div>

          {/* Aggregate stats row */}
          {(totalPlays > 0 || totalLikes > 0) && (
            <div className="flex gap-4 mt-4 px-1">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Play className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{totalPlays}</span>
                <span>total plays</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Heart className="w-3.5 h-3.5" />
                <span className="font-semibold text-foreground">{totalLikes}</span>
                <span>total likes</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => navigate('/studio')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Track
            </button>
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-muted/40 border border-border text-foreground hover:bg-muted/60 transition-colors"
            >
              <Radio className="w-4 h-4" /> Community
            </button>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex border-b border-border px-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px',
                tab === t.id
                  ? 'text-foreground border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs font-bold',
                  tab === t.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="px-4 pb-12 pt-4">

          {/* Published + Remixed — 3-col grid */}
          {(tab === 'published' || tab === 'remixed') && (
            <>
              {gridItems.length === 0 ? (
                <div className="text-center py-16">
                  <Music2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  {tab === 'published' ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">No published tracks yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Record something in the studio and hit Publish
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground">No remixes yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Head to Community and hit Remix on any track
                      </p>
                    </>
                  )}
                  <button
                    onClick={() => navigate('/studio')}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors mx-auto"
                  >
                    <Plus className="w-4 h-4" /> Open Studio
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {gridItems.map((project: any) => (
                    <TrackGridCell
                      key={project.recordId}
                      project={project}
                      reactions={allReactions as any[]}
                      onClick={() => navigate(`/community?videoId=${project.recordId}&tab=new`)}
                      onDelete={() => setConfirmDelete({ id: project.recordId, type: 'published', name: project.data.name })}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Drafts — list view */}
          {tab === 'drafts' && (
            <>
              {drafts.length === 0 ? (
                <div className="text-center py-16">
                  <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No drafts in progress</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Projects you save in the studio appear here
                  </p>
                  <button
                    onClick={() => navigate('/studio')}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/80 transition-colors mx-auto"
                  >
                    <Plus className="w-4 h-4" /> Start a Draft
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {drafts.map((project: any) => (
                    <DraftRow
                      key={project.recordId}
                      project={project}
                      onOpen={() => { load(project); navigate('/studio') }}
                      onDelete={() => setConfirmDelete({ id: project.recordId, type: 'draft', name: project.data.name })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Confirm delete dialog ─────────────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDelete
          title={confirmDelete.type === 'draft' ? 'Delete draft?' : 'Delete published track?'}
          desc={`"${confirmDelete.name}" will be permanently removed.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete.type === 'draft') removeDraft(confirmDelete.id)
            else removePublished(confirmDelete.id)
            setConfirmDelete(null)
          }}
        />
      )}
    </div>
  )
}
