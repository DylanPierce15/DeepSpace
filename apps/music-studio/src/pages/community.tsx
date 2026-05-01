/**
 * Community — TikTok-style snap-scroll music feed.
 *
 * Each track card fills the full viewport height. CSS scroll-snap
 * locks the feed to one card at a time. IntersectionObserver
 * auto-plays the card in view and pauses the rest.
 *
 * Tabs: For You (trending) · Following · New
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Play, Pause, Heart, MessageCircle, GitFork,
  Music2, TrendingUp, Users, Clock, Send, Trash2,
  UserPlus, UserCheck, ChevronUp, ChevronDown, X, Tag,
} from 'lucide-react'
import { useQuery, useUser } from 'deepspace'
import { useRemix } from '../hooks/useProjects'
import {
  useTrackInteractions, useTrackPlay,
  useComments, useFollow, useFollowingIds,
} from '../hooks/useSocial'
import { cn } from '../components/ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d` : `${Math.floor(d / 30)}mo`
}

/** Deterministic gradient from a seed string */
function seedGradient(seed: string): string {
  let h = 0
  for (const c of seed) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff
  const h1 = h % 360
  const h2 = (h1 + 130) % 360
  return `linear-gradient(160deg, hsl(${h1},55%,10%) 0%, hsl(${h2},65%,18%) 60%, hsl(${(h2 + 40) % 360},50%,8%) 100%)`
}

/** Pseudo-random waveform bars seeded by track name */
function waveformBars(seed: string, count: number): number[] {
  let s = 0
  for (const c of seed) s = ((s << 5) - s + c.charCodeAt(0)) & 0x7fffffff
  return Array.from({ length: count }, (_, i) => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const base = (s >>> 0) / 0xffffffff
    // Add a "musical" shape — higher in middle
    const envelope = Math.sin((i / count) * Math.PI)
    return 0.15 + envelope * 0.55 + base * 0.3
  })
}

function trendScore(p: any, reactions: any[], comments: any[]) {
  const likes = reactions.filter((r: any) => r.data.projectId === p.recordId && r.data.reactionType === 'like').length
  const plays = reactions.filter((r: any) => r.data.projectId === p.recordId && r.data.reactionType === 'play').length
  const comms = comments.filter((c: any) => c.data.projectId === p.recordId).length
  return likes * 3 + plays + comms * 2
}

// ── Comments slide-up drawer ──────────────────────────────────────────────────

function CommenterAvatar({ comment }: { comment: any }) {
  const imageUrl = comment.data.authorImageUrl
  const name     = comment.data.authorName ?? '?'
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
      {name[0].toUpperCase()}
    </div>
  )
}

function CommentsDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { user }    = useUser()
  const { comments, addComment, deleteComment, canDelete } = useComments(projectId)
  const [text, setText] = useState('')

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-black/90 backdrop-blur-xl border-t border-white/10"
      style={{ height: '60%' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Handle */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
        <span className="text-sm font-bold text-white">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
        <button onClick={onClose} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
        {comments.length === 0 && (
          <p className="text-center text-sm text-white/40 py-8">No comments yet. Be the first!</p>
        )}
        {comments.map((c: any) => (
          <div key={c.recordId} className="flex items-start gap-3 group">
            <Link
              to={`/producer/${c.createdBy}`}
              onClick={e => e.stopPropagation()}
              className="shrink-0 hover:opacity-80 transition-opacity"
            >
              <CommenterAvatar comment={c} />
            </Link>
            <div className="flex-1">
              <Link
                to={`/producer/${c.createdBy}`}
                onClick={e => e.stopPropagation()}
                className="text-xs font-semibold text-white/80 mr-2 hover:text-primary transition-colors"
              >
                {c.data.authorName ?? 'User'}
              </Link>
              <span className="text-sm text-white/70">{c.data.text}</span>
            </div>
            {canDelete(c) && (
              <button
                onClick={() => deleteComment(c.recordId)}
                className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      {user && (
        <div className="px-4 pb-5 pt-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { addComment(text); setText('') } }}
              placeholder="Add a comment…"
              className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={() => { if (text.trim()) { addComment(text); setText('') } }}
              disabled={!text.trim()}
              className="p-2 rounded-full bg-primary text-white disabled:opacity-30 hover:bg-primary/80 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Right rail action button ──────────────────────────────────────────────────

function RailBtn({
  icon, label, onClick, active = false, disabled = false,
}: {
  icon: React.ReactNode; label?: string; onClick?: (e: React.MouseEvent) => void; active?: boolean; disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1 disabled:opacity-40 transition-all active:scale-90',
        active ? 'text-primary' : 'text-white'
      )}
    >
      <div className={cn(
        'w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors',
        active ? 'bg-primary/25 ring-1 ring-primary/50' : 'bg-white/15 hover:bg-white/25'
      )}>
        {icon}
      </div>
      {label !== undefined && (
        <span className="text-xs font-semibold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          {label}
        </span>
      )}
    </button>
  )
}

// ── Full-height track card ────────────────────────────────────────────────────

function TrackFeedCard({
  project, isActive, rank, onTagClick,
}: {
  project: any; isActive: boolean; rank?: number; key?: React.Key; onTagClick?: (tag: string) => void
}) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { remix } = useRemix()

  const { liked, likeCount, playCount, commentCount, toggleLike } = useTrackInteractions(project.recordId)
  const { recordPlay } = useTrackPlay(project.recordId)
  const { following, toggle: toggleFollow, isOwnProfile } = useFollow(project.data.authorId)

  const [playing,       setPlaying]       = useState(false)
  const [progress,      setProgress]      = useState(0)
  const [showComments,  setShowComments]  = useState(false)
  const [remixing,      setRemixing]      = useState(false)
  const [liked2, setLiked2]               = useState(false)  // animation state

  const audioRef = useRef<HTMLAudioElement>(null)
  const cardRef  = useRef<HTMLDivElement>(null)

  const bars    = useMemo(() => waveformBars(project.recordId, 60), [project.recordId])
  const hasCover = !!project.data.coverImageUrl

  // Auto-play / pause based on whether this card is the active one
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !project.data.publishedUrl) return
    if (isActive) {
      audio.play().then(() => { setPlaying(true); recordPlay() }).catch(() => {})
    } else {
      audio.pause()
      setPlaying(false)
    }
  }, [isActive, recordPlay, project.data.publishedUrl])

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true); recordPlay() }
  }, [playing, recordPlay])

  const handleLike = () => {
    toggleLike()
    setLiked2(true)
    setTimeout(() => setLiked2(false), 600)
  }

  const handleRemix = async () => {
    if (!user) return
    setRemixing(true)
    try { await remix(project); navigate('/studio') }
    finally { setRemixing(false) }
  }

  const tags = useMemo(() => {
    try { return JSON.parse(project.data.tags || '[]') as string[] } catch { return [] }
  }, [project.data.tags])

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden"
      style={{ height: '100%', scrollSnapAlign: 'start', flexShrink: 0 }}
    >
      {/* ── Background ──────────────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {hasCover ? (
          <img src={project.data.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: seedGradient(project.recordId) }} />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
      </div>

      {/* ── Rank badge ──────────────────────────────────────────────────── */}
      {rank !== undefined && rank < 3 && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-warning/50">
          <TrendingUp className="w-3 h-3 text-warning" />
          <span className="text-xs font-bold text-warning">#{rank + 1} Trending</span>
        </div>
      )}

      {/* ── Tap anywhere to play/pause (except right rail and bottom) ───── */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
      />

      {/* ── Right action rail ────────────────────────────────────────────── */}
      <div className="absolute right-3 bottom-40 z-20 flex flex-col gap-5">
        {/* Play count (read-only display) */}
        <div className="flex flex-col items-center gap-1 text-white">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <span className="text-xs font-semibold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {playCount || ''}
          </span>
        </div>

        {/* Like */}
        <RailBtn
          icon={
            <Heart
              className={cn(
                'w-6 h-6 transition-all duration-200',
                liked ? 'fill-current text-red-500' : '',
                liked2 ? 'scale-150' : 'scale-100'
              )}
            />
          }
          label={likeCount > 0 ? String(likeCount) : ''}
          onClick={e => { e.stopPropagation(); handleLike() }}
          active={liked}
          disabled={!user}
        />

        {/* Comments */}
        <RailBtn
          icon={<MessageCircle className="w-6 h-6" />}
          label={commentCount > 0 ? String(commentCount) : ''}
          onClick={e => { e.stopPropagation(); setShowComments(s => !s) }}
          active={showComments}
        />

        {/* Remix */}
        {user && (
          <RailBtn
            icon={<GitFork className={cn('w-5 h-5', remixing && 'animate-spin')} />}
            label="Remix"
            onClick={e => { e.stopPropagation(); handleRemix() }}
            disabled={remixing}
          />
        )}

        {/* Follow */}
        {!isOwnProfile && user && (
          <RailBtn
            icon={following ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            label={following ? 'Following' : 'Follow'}
            onClick={e => { e.stopPropagation(); toggleFollow() }}
            active={following}
          />
        )}
      </div>

      {/* ── Bottom info + player ─────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5 pt-8 pointer-events-none">

        {/* Track title */}
        <h2
          className="text-2xl font-black text-white leading-tight mb-1 drop-shadow-lg"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
        >
          {project.data.name}
        </h2>

        {/* Producer + meta */}
        <div className="flex items-center gap-2 mb-2 flex-wrap pointer-events-auto">
          <Link
            to={`/producer/${project.data.authorId}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            {project.data.authorImageUrl ? (
              <img
                src={project.data.authorImageUrl}
                alt={project.data.authorName}
                className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/40 flex items-center justify-center text-xs font-bold text-white ring-1 ring-white/20">
                {(project.data.authorName ?? '?')[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-primary drop-shadow">
              @{project.data.authorName ?? 'producer'}
            </span>
          </Link>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-xs text-white/70">{project.data.bpm} BPM</span>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-xs text-white/70">{timeAgo(project.data.publishedAt)}</span>
          {project.data.remixedFrom && (
            <span className="px-2 py-0.5 rounded-full bg-primary/30 border border-primary/50 text-primary text-xs font-semibold">
              Remix
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap pointer-events-auto">
            {tags.slice(0, 4).map((tag: string) => (
              <button
                key={tag}
                onClick={e => { e.stopPropagation(); onTagClick?.(tag) }}
                className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-xs text-white/80 font-medium border border-white/10 hover:bg-white/20 hover:border-white/20 transition-colors"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Waveform player */}
        {project.data.publishedUrl && (
          <div className="flex items-center gap-3 pointer-events-auto">
            <audio
              ref={audioRef}
              src={project.data.publishedUrl}
              onTimeUpdate={e => {
                const a = e.currentTarget
                if (a.duration) setProgress(a.currentTime / a.duration)
              }}
              onEnded={() => { setPlaying(false); setProgress(0) }}
            />

            {/* Play/Pause btn */}
            <button
              onClick={e => { e.stopPropagation(); togglePlay() }}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                playing
                  ? 'bg-white text-black'
                  : 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
              )}
            >
              {playing
                ? <Pause className="w-4 h-4 fill-current" />
                : <Play className="w-4 h-4 fill-current" />
              }
            </button>

            {/* Waveform scrubber */}
            <div
              className="flex-1 flex items-end gap-px h-10 cursor-pointer"
              onClick={e => {
                e.stopPropagation()
                if (!audioRef.current?.duration) return
                const rect = e.currentTarget.getBoundingClientRect()
                const pct  = (e.clientX - rect.left) / rect.width
                audioRef.current.currentTime = pct * audioRef.current.duration
                setProgress(pct)
              }}
            >
              {bars.map((h, i) => {
                const pct  = i / bars.length
                const done = pct < progress
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-colors"
                    style={{
                      height: `${h * 100}%`,
                      background: done ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
                      opacity: done ? 1 : 0.6,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Comments drawer ──────────────────────────────────────────────── */}
      {showComments && (
        <CommentsDrawer
          projectId={project.recordId}
          onClose={() => setShowComments(false)}
        />
      )}
    </div>
  )
}

// ── Feed scroll container with nav controls ───────────────────────────────────

type Tab = 'trending' | 'following' | 'new'

export default function PublicPage() {
  const { user } = useUser()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const targetVideoId = params.get('videoId')
  const tabParam = params.get('tab') as Tab | null

  const [tab, setTab]           = useState<Tab>(tabParam ?? 'trending')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const { records: rawProjects } = useQuery('published-projects', { orderBy: 'publishedAt', orderDir: 'desc' })
  const { records: allReactions } = useQuery('track-reactions')
  const { records: allComments  } = useQuery('track-comments')
  const followingIds              = useFollowingIds()

  const projects = rawProjects as any[]

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    projects.forEach(p => {
      try { (JSON.parse(p.data.tags || '[]') as string[]).forEach(t => tagSet.add(t)) } catch {}
    })
    return [...tagSet].sort()
  }, [projects])

  const sortedProjects = useMemo(() => {
    let list: any[]
    if (tab === 'new')       list = [...projects]
    else if (tab === 'following') list = projects.filter(p => followingIds.includes(p.data.authorId))
    else list = [...projects].sort((a, b) =>
      trendScore(b, allReactions as any[], allComments as any[]) -
      trendScore(a, allReactions as any[], allComments as any[])
    )
    if (selectedTag) {
      list = list.filter(p => {
        try { return (JSON.parse(p.data.tags || '[]') as string[]).includes(selectedTag) }
        catch { return false }
      })
    }
    return list
  }, [tab, projects, followingIds, allReactions, allComments, selectedTag])

  // Track which card is in view via scroll position
  const feedRef = useRef<HTMLDivElement>(null)
  const didScrollToTarget = useRef(false)

  const handleScroll = useCallback(() => {
    const el = feedRef.current
    if (!el || el.clientHeight === 0) return
    const idx = Math.round(el.scrollTop / el.clientHeight)
    setCurrentIdx(idx)
  }, [])

  const scrollTo = useCallback((idx: number) => {
    const el = feedRef.current
    if (!el) return
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' })
  }, [])

  // Scroll to a specific video when navigating from the library
  useEffect(() => {
    if (!targetVideoId || didScrollToTarget.current || sortedProjects.length === 0) return
    const idx = sortedProjects.findIndex(p => p.recordId === targetVideoId)
    if (idx === -1) return
    didScrollToTarget.current = true
    // Use instant scroll first (no animation) then sync state
    const el = feedRef.current
    if (el) el.scrollTo({ top: idx * el.clientHeight, behavior: 'instant' as ScrollBehavior })
    setCurrentIdx(idx)
  }, [targetVideoId, sortedProjects])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'trending',  label: 'For You',   icon: <TrendingUp className="w-3 h-3" /> },
    { id: 'following', label: 'Following', icon: <Users className="w-3 h-3" /> },
    { id: 'new',       label: 'New',       icon: <Clock className="w-3 h-3" /> },
  ]

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden relative">

      {/* ── Floating tab bar ──────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-30 flex flex-col items-center pt-3 gap-2 pointer-events-none">
        <div className="flex gap-0.5 bg-black/50 backdrop-blur-xl rounded-full px-1 py-1 border border-white/10 pointer-events-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setCurrentIdx(0); feedRef.current?.scrollTo({ top: 0 }) }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                tab === t.id
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/60 hover:text-white'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Genre filter chips */}
        {allTags.length > 0 && (
          <div className="flex gap-1.5 px-4 overflow-x-auto pointer-events-auto w-full justify-center" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => { setSelectedTag(null); setCurrentIdx(0); feedRef.current?.scrollTo({ top: 0 }) }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0',
                !selectedTag
                  ? 'bg-white/20 text-white border-white/30'
                  : 'text-white/50 border-white/10 hover:text-white hover:border-white/20'
              )}
            >
              <Tag className="w-2.5 h-2.5" />
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setSelectedTag(tag === selectedTag ? null : tag)
                  setCurrentIdx(0)
                  feedRef.current?.scrollTo({ top: 0 })
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border shrink-0',
                  selectedTag === tag
                    ? 'bg-primary/80 text-white border-primary'
                    : 'text-white/50 border-white/10 hover:text-white hover:border-white/20'
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Snap-scroll feed ─────────────────────────────────────────────── */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory' }}
        onScroll={handleScroll}
      >
        {sortedProjects.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
            <Music2 className="w-16 h-16 text-white/20" />
            {tab === 'following' ? (
              <>
                <p className="text-lg font-bold text-white">No tracks from people you follow</p>
                <p className="text-sm text-white/50">Switch to "For You" to find producers to follow</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-white">Nothing here yet</p>
                <p className="text-sm text-white/50">Record a track and hit Publish to be first!</p>
              </>
            )}
          </div>
        )}

        {sortedProjects.map((project, i) => (
          <TrackFeedCard
            key={`${tab}-${project.recordId}`}
            project={project}
            isActive={i === currentIdx}
            rank={tab === 'trending' ? i : undefined}
            onTagClick={tag => {
              setSelectedTag(tag)
              setCurrentIdx(0)
              feedRef.current?.scrollTo({ top: 0 })
            }}
          />
        ))}
      </div>

      {/* ── Up / Down nav arrows ─────────────────────────────────────────── */}
      {sortedProjects.length > 1 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
          <button
            onClick={() => scrollTo(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => scrollTo(Math.min(sortedProjects.length - 1, currentIdx + 1))}
            disabled={currentIdx === sortedProjects.length - 1}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Track counter pill ───────────────────────────────────────────── */}
      {sortedProjects.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
          <span className="text-xs font-semibold text-white/70">
            {currentIdx + 1} / {sortedProjects.length}
          </span>
        </div>
      )}
    </div>
  )
}
