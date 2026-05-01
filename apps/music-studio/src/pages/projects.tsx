/**
 * Projects Page — browse, load, and delete saved projects
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Trash2, Music2, Plus, ArrowLeft } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useStudio } from '../hooks/useStudio'
import { cn } from '../components/ui'

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ProjectsPage() {
  const navigate    = useNavigate()
  const { dispatch } = useStudio()
  const { projects, status, save, load, deleteProject } = useProjects()

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/studio')}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Projects</h1>
            <p className="text-sm text-muted-foreground">{projects.length} saved project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { dispatch({ type: 'NEW_PROJECT' }); navigate('/studio') }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-muted/40 border border-border text-foreground hover:bg-muted/60 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/80 transition-colors"
            >
              Save current
            </button>
          </div>
        </div>

        {/* Project list */}
        {status === 'loading' && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {status === 'ready' && projects.length === 0 && (
          <div className="text-center py-16">
            <Music2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No saved projects yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create something in the studio and save it here.</p>
          </div>
        )}

        {status === 'ready' && projects.length > 0 && (
          <div className="space-y-2">
            {projects.map(project => (
              <div
                key={project.recordId}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Music2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{project.data.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.data.bpm} BPM · {timeAgo(project.data.updatedAt)}
                    {project.data.visibility === 'public' && (
                      <span className="ml-2 text-primary font-medium">· Public</span>
                    )}
                    {project.data.remixedFrom && (
                      <span className="ml-2 text-muted-foreground">· Remix</span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { load(project); navigate('/studio') }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <FolderOpen className="w-3 h-3" /> Open
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${project.data.name}"? This cannot be undone.`)) {
                        deleteProject(project.recordId)
                      }
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
