/**
 * useProjects — project persistence via RecordRoom storage.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useQuery, useMutations } from 'deepspace'
import { useStudio } from './useStudio'
import { DEFAULT_TIME_SIGNATURE } from '../constants'

export interface SavedProject {
  recordId: string
  data: {
    name:          string
    bpm:           number
    timeSignature: string
    tracks:        string
    visibility:    'private' | 'public'
    publishedUrl?: string
    remixedFrom?:  string
    updatedAt:     string
  }
  createdBy: string
}

export function useProjects() {
  const { state, dispatch } = useStudio()
  const { records: rawProjects, status } = useQuery('projects', { orderBy: 'updatedAt', orderDir: 'desc' })
  const { create, put, remove } = useMutations('projects')
  const [isSaving, setIsSaving] = useState(false)

  const projects = rawProjects as unknown as SavedProject[]

  const save = useCallback(async () => {
    setIsSaving(true)
    const payload = {
      name:          state.projectName,
      bpm:           state.bpm,
      timeSignature: DEFAULT_TIME_SIGNATURE,
      tracks:        JSON.stringify(state.tracks),
      visibility:    'private' as const,
      updatedAt:     new Date().toISOString(),
    }
    try {
      if (state.savedProjectId) {
        put(state.savedProjectId, payload)
        dispatch({ type: 'MARK_SAVED', projectId: state.savedProjectId })
      } else {
        const id = await create(payload)
        dispatch({ type: 'MARK_SAVED', projectId: id })
      }
    } finally {
      setIsSaving(false)
    }
  }, [state, create, put, dispatch])

  const load = useCallback((project: SavedProject) => {
    try {
      const tracks = JSON.parse(project.data.tracks)
      dispatch({
        type: 'LOAD_PROJECT',
        state: {
          projectName:    project.data.name,
          bpm:            project.data.bpm,
          tracks,
          savedProjectId: project.recordId,
          isDirty:        false,
        },
      })
    } catch (e) {
      console.error('[useProjects] Failed to parse project tracks', e)
    }
  }, [dispatch])

  const deleteProject = useCallback((recordId: string) => {
    remove(recordId)
    if (state.savedProjectId === recordId) {
      dispatch({ type: 'NEW_PROJECT' })
    }
  }, [remove, state.savedProjectId, dispatch])

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!state.isDirty) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { save() }, 3000)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [state.isDirty, save])

  return { projects, status, isSaving, save, load, deleteProject }
}

export function useRemix() {
  const { dispatch } = useStudio()
  const { create } = useMutations('projects')

  const remix = useCallback(async (publishedProject: {
    recordId: string
    data: { name: string; bpm: number; tracks: string }
  }) => {
    const tracks = JSON.parse(publishedProject.data.tracks)
    const remixedTracks = tracks.map((t: any) => ({
      ...t,
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clips: t.clips?.map((c: any) => ({
        ...c,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        notes: c.notes.map((n: any) => ({
          ...n,
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        })),
      })),
    }))

    const projectName = `${publishedProject.data.name} (Remix)`
    const id = await create({
      name:          projectName,
      bpm:           publishedProject.data.bpm,
      timeSignature: DEFAULT_TIME_SIGNATURE,
      tracks:        JSON.stringify(remixedTracks),
      visibility:    'private',
      remixedFrom:   publishedProject.recordId,
      updatedAt:     new Date().toISOString(),
    })
    dispatch({
      type: 'LOAD_PROJECT',
      state: {
        projectName,
        bpm:            publishedProject.data.bpm,
        tracks:         remixedTracks,
        savedProjectId: id,
        isDirty:        false,
      },
    })
    return id
  }, [create, dispatch])

  return { remix }
}
