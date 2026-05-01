/**
 * ProducerPage — public profile for a producer.
 * Shows cover art grid, stats, follow button, and track list.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Play, Square, GitFork, Music2, UserPlus, UserCheck, Heart, MessageCircle } from 'lucide-react'
import { useQuery, useUser } from 'deepspace'
import { useRemix } from '../../hooks/useProjects'
import { useFollow, useTrackInteractions } from '../../hooks/useSocial'
import { cn } from '../../components/ui'

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function coverGradient(name: string) {
  let h = 0
  for (const c of name) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff
  const h1 = h % 360
  const h2 = (h1 + 140) % 360
  return `linear-gradient(135deg, hsl(${h1},60%,12%), hsl(${h2},70%,22%))`
}

// ── Mini track card for the profile grid ──────────────────────────────────────

function ProfileTrackCard({ project }: { project: any }) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { remix } = useRemix()
  const { liked, likeCount, playCount, commentCount, toggleLike } = useTrackInteractions(project.recordId)

  const audioRef  = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [remixing, setRemixing] = useState(false)

  const togglePlay = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }, [playing])

  const handleRemix = async () => {
    if (!user) return
    setRemixing(true)
    try { await remix(project); navigate('/studio') }
    finally { setRemixing(false) }
  }

  const hasCover = !!project.data.coverImageUrl

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-colors">

      {/* Cover art */}
      <div
        className="w-full aspect-square relative overflow-hidden"
        style={hasCover ? {} : { background: coverGradient(project.data.name) }}
      >
        {hasCover && (
          <img src={project.data.coverImageUrl} alt="" className="w-full h-full object-cover" />
        )}
        {/* Hover play button */}
        {project.data.publishedUrl && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
            <audio
              ref={audioRef}
              src={project.data.publishedUrl}
              onTimeUpdate={e => {
                const a = e.currentTarget
                if (a.duration) setProgress(a.currentTime / a.duration)
              }}
              onEnded={() => { setPlaying(false); setProgress(0) }}
            />
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-primary/90 text-white flex items-center justify-center hover:bg-primary transition-colors shadow-lg"
            >
              {playing ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
          </div>
        )}
        {/* Remix badge */}
        {project.data.remixedFrom && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-primary/90 text-white text-xs font-medium">
            Remix
          </div>
        )}
        {/* Progress bar */}
        {playing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-semibold text-foreground truncate">{project.data.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{project.data.bpm} BPM · {timeAgo(project.data.publishedAt)}</p>

        {/* Stats + remix */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={toggleLike}
            disabled={!user}
            className={cn('flex items-center gap-0.5 text-xs transition-colors',
              liked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground')}
          >
            <Heart className={cn('w-3 h-3', liked && 'fill-current')} />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <MessageCircle className="w-3 h-3" />
            {commentCount > 0 && <span>{commentCount}</span>}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground ml-auto">
            <Play className="w-3 h-3" />
            {playCount}
          </span>
          {user && (
            <button
              onClick={handleRemix}
              disabled={remixing}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              title="Remix"
            >
              <GitFork className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main producer page ────────────────────────────────────────────────────────

export default function ProducerPage() {
  const { producerId } = useParams<{ producerId: string }>()
  const navigate       = useNavigate()
  const { user }       = useUser()
  const [tab, setTab]  = useState<'all' | 'remixes'>('all')

  const { records: allProjects, status } = useQuery('published-projects', {
    orderBy: 'publishedAt', orderDir: 'desc',
  })
  const projects = (allProjects as any[]).filter(p => p.data.authorId === producerId)

  const producerName     = projects[0]?.data.authorName    ?? 'Producer'
  const producerImageUrl = projects[0]?.data.authorImageUrl ?? ''
  const producerUsername = projects[0]?.data.authorUsername ?? ''

  const { following, followerCount, followingCount, toggle, isOwnProfile } = useFollow(producerId ?? '')

  const remixes        = useMemo(() => projects.filter(p => !!p.data.remixedFrom), [projects])
  const displayedTracks = tab === 'remixes' ? remixes : projects

  const totalTracks  = projects.length
  const avatarLetter = producerName[0]?.toUpperCase() ?? '?'

  const avatarBg = (() => {
    let h = 0
    for (const c of (producerId ?? '')) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff
    return `hsl(${h % 360}, 65%, 30%)`
  })()

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pb-12">

        {/* Back */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pt-4 pb-2">
          <button onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Profile header */}
        <div className="flex flex-col items-center text-center pb-6 pt-2">
          {/* Avatar */}
          {producerImageUrl ? (
            <img
              src={producerImageUrl}
              alt={producerName}
              className="w-20 h-20 rounded-full object-cover shadow-lg mb-4 ring-4 ring-border"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4 ring-4 ring-border"
              style={{ background: avatarBg }}
            >
              {avatarLetter}
            </div>
          )}

          <h1 className="text-xl font-bold text-foreground">{producerName}</h1>
          {producerUsername && (
            <p className="text-sm text-muted-foreground mt-0.5">@{producerUsername}</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-3">
            <div className="text-center">
              <p className="text-base font-bold text-foreground">{totalTracks}</p>
              <p className="text-xs text-muted-foreground">Tracks</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-base font-bold text-foreground">{followerCount}</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-base font-bold text-foreground">{followingCount}</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>

          {/* Follow button */}
          {!isOwnProfile && user && (
            <button
              onClick={toggle}
              className={cn(
                'mt-4 flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-all border',
                following
                  ? 'bg-muted/40 text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40'
                  : 'bg-primary text-white border-primary hover:bg-primary/80'
              )}
            >
              {following
                ? <><UserCheck className="w-4 h-4" /> Following</>
                : <><UserPlus className="w-4 h-4" /> Follow</>
              }
            </button>
          )}

          {isOwnProfile && (
            <Link to="/community"
              className="mt-4 px-6 py-2 rounded-full text-sm font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
              View Community
            </Link>
          )}
        </div>

        {/* Tab bar — only show Remixes tab if they have any */}
        {totalTracks > 0 && (
          <div className="flex border-b border-border mb-4">
            <button
              onClick={() => setTab('all')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                tab === 'all' ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
              )}
            >
              All
              <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-bold',
                tab === 'all' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                {totalTracks}
              </span>
            </button>
            {remixes.length > 0 && (
              <button
                onClick={() => setTab('remixes')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  tab === 'remixes' ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                Remixes
                <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-bold',
                  tab === 'remixes' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>
                  {remixes.length}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {status === 'loading' && (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {status === 'ready' && projects.length === 0 && (
          <div className="text-center py-16">
            <Music2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No published tracks yet.</p>
          </div>
        )}

        {/* Grid */}
        {status === 'ready' && displayedTracks.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {displayedTracks.map(project => (
              <ProfileTrackCard key={project.recordId} project={project} />
            ))}
          </div>
        )}
        {status === 'ready' && projects.length > 0 && displayedTracks.length === 0 && (
          <div className="text-center py-16">
            <Music2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No remixes yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
