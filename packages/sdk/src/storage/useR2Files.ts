/**
 * useR2Files — Scoped file storage hook for DeepSpace apps.
 *
 * Provides upload, download, list, and delete for files in R2, scoped to:
 *   - The current app ("self", the default — uses hostname-based scoping on the server)
 *   - The authenticated user's personal files ("user")
 *
 * @example Default (app's own files)
 * ```tsx
 * const { upload, downloadFile, deleteFile, list } = useR2Files()
 * await upload(myFile, 'photo.png')
 *
 * const files = await list()
 * await downloadFile(files[0])  // uses originalName automatically
 * await deleteFile(files[0])
 * ```
 *
 * @example User-scoped files
 * ```tsx
 * const userFiles = useR2Files({ scope: 'user' })
 * await userFiles.upload(avatar, 'avatar.png')
 * const myFiles = await userFiles.list()
 * await userFiles.downloadFile(myFiles[0])
 * ```
 */

import { useCallback, useState, useMemo } from 'react'
import { getAuthToken } from '../auth'

// ============================================================================
// Types
// ============================================================================

export interface R2UploadResult {
  success: boolean
  key?: string
  url?: string
  name?: string
  error?: string
}

export interface R2FileInfo {
  key: string
  size: number
  uploaded: string
  url: string
  originalName?: string
  uploadedBy?: string
}

export interface UseR2FilesReturn {
  /** Upload a File or Blob. Optionally provide a display name. */
  upload: (file: File | Blob, name?: string) => Promise<R2UploadResult>
  /** Upload raw base64 data. */
  uploadBase64: (base64Data: string, name: string, mimeType?: string) => Promise<R2UploadResult>
  /**
   * Delete a file. Accepts an R2FileInfo from `list()` or a raw key string.
   *
   * @example
   * ```tsx
   * const files = await list()
   * await deleteFile(files[0])          // pass the object
   * await deleteFile('widgets/abc/f.pdf') // or a raw key
   * ```
   */
  deleteFile: (fileOrKey: R2FileInfo | string) => Promise<{ success: boolean; error?: string }>
  /** List files, optionally filtered by a sub-prefix within the scope. */
  list: (prefix?: string) => Promise<R2FileInfo[]>
  /**
   * Download a file. Accepts an R2FileInfo from `list()` or a raw key string.
   * Uses an authenticated fetch and triggers a browser download via blob URL.
   *
   * When an R2FileInfo is passed, `originalName` is used as the download
   * filename automatically. When a string key is passed, an optional
   * `fileName` override can be provided.
   *
   * @example
   * ```tsx
   * const files = await list()
   * await downloadFile(files[0])                         // uses originalName
   * await downloadFile('widgets/abc/f.pdf', 'report.pdf') // explicit name
   * ```
   */
  downloadFile: (fileOrKey: R2FileInfo | string, fileName?: string) => Promise<{ success: boolean; error?: string }>
  /**
   * Read a file's contents with authentication. Returns the raw Response.
   * Unlike `downloadFile`, this does NOT trigger a browser download —
   * it returns the Response so you can call `.text()`, `.blob()`,
   * `.arrayBuffer()`, `.json()`, etc.
   *
   * @example
   * ```tsx
   * const resp = await readFile('data/cleaned.txt')
   * const text = await resp.text()
   * ```
   */
  readFile: (fileOrKey: R2FileInfo | string) => Promise<Response>
  /**
   * Build a plain URL for a file. Accepts an R2FileInfo or a raw key string.
   *
   * **Warning**: This URL has no auth token attached. It only works for
   * unauthenticated reads — specifically `scope=self` on deployed sites
   * where the prefix is derived from the hostname. For user-scoped files,
   * use `downloadFile` or `readFile` instead.
   */
  getUrl: (fileOrKey: R2FileInfo | string) => string
  /** Whether an upload is currently in progress. */
  isUploading: boolean
}

export type R2Scope =
  | { scope?: 'self' }
  | { scope: 'user' }

// ============================================================================
// Helpers
// ============================================================================

/** Extract key (and optional original name) from an R2FileInfo or raw string. */
function resolveFile(fileOrKey: R2FileInfo | string): { key: string; name: string | undefined } {
  if (typeof fileOrKey === 'string') {
    return { key: fileOrKey, name: undefined }
  }
  return { key: fileOrKey.key, name: fileOrKey.originalName }
}

// ============================================================================
// Hook
// ============================================================================

export function useR2Files(options?: R2Scope): UseR2FilesReturn {
  const [isUploading, setIsUploading] = useState(false)

  /** Query string that tells the worker which scope to use. */
  const scopeParams = useMemo(() => {
    const params = new URLSearchParams()
    if (!options || !options.scope || options.scope === 'self') {
      params.set('scope', 'self')
    } else if (options.scope === 'user') {
      params.set('scope', 'user')
    }
    return params.toString()
  }, [options])

  /** Get auth headers using the DeepSpace auth token. */
  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAuthToken()
    if (token) {
      return { Authorization: `Bearer ${token}` }
    }
    return {}
  }, [])

  const upload = useCallback(async (file: File | Blob, name?: string): Promise<R2UploadResult> => {
    setIsUploading(true)
    try {
      const headers = await authHeaders()
      const formData = new FormData()
      formData.append('file', file)
      if (name) formData.append('name', name)

      const response = await fetch(`/api/files/upload?${scopeParams}`, {
        method: 'POST',
        headers,
        body: formData,
      })
      return await response.json() as R2UploadResult
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
    } finally {
      setIsUploading(false)
    }
  }, [scopeParams, authHeaders])

  const uploadBase64 = useCallback(async (base64Data: string, name: string, mimeType?: string): Promise<R2UploadResult> => {
    setIsUploading(true)
    try {
      const headers = await authHeaders()
      const response = await fetch(`/api/files/upload?${scopeParams}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64Data, name, mimeType }),
      })
      return await response.json() as R2UploadResult
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Upload failed' }
    } finally {
      setIsUploading(false)
    }
  }, [scopeParams, authHeaders])

  const deleteFile = useCallback(async (fileOrKey: R2FileInfo | string): Promise<{ success: boolean; error?: string }> => {
    const { key } = resolveFile(fileOrKey)
    try {
      const headers = await authHeaders()
      const response = await fetch(`/api/files/${key}?${scopeParams}`, { method: 'DELETE', headers })
      return await response.json() as { success: boolean; error?: string }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Delete failed' }
    }
  }, [scopeParams, authHeaders])

  const list = useCallback(async (prefix?: string): Promise<R2FileInfo[]> => {
    try {
      const headers = await authHeaders()
      const params = new URLSearchParams(scopeParams)
      if (prefix) params.set('prefix', prefix)
      const response = await fetch(`/api/files?${params.toString()}`, { headers })
      const result = await response.json() as { files: R2FileInfo[] }
      return result.files || []
    } catch {
      return []
    }
  }, [scopeParams, authHeaders])

  const downloadFile = useCallback(async (fileOrKey: R2FileInfo | string, fileName?: string): Promise<{ success: boolean; error?: string }> => {
    const { key, name: infoName } = resolveFile(fileOrKey)
    try {
      const headers = await authHeaders()
      const response = await fetch(`/api/files/${key}?${scopeParams}`, { headers })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        return { success: false, error: body?.error ?? `Download failed (${response.status})` }
      }

      // Derive a display name: explicit arg > R2FileInfo.originalName > Content-Disposition > last key segment
      const disposition = response.headers.get('Content-Disposition')
      const dispositionName = disposition?.match(/filename="(.+?)"/)?.[1]
      const fallbackName = key.split('/').pop() ?? 'download'
      const resolvedName = fileName ?? infoName ?? dispositionName ?? fallbackName

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = resolvedName
      document.body.appendChild(anchor)
      anchor.click()

      // Clean up
      document.body.removeChild(anchor)
      URL.revokeObjectURL(blobUrl)

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Download failed' }
    }
  }, [scopeParams, authHeaders])

  const readFile = useCallback(async (fileOrKey: R2FileInfo | string): Promise<Response> => {
    const { key } = resolveFile(fileOrKey)
    const headers = await authHeaders()
    const response = await fetch(`/api/files/${key}?${scopeParams}`, { headers })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Failed to read file (${response.status}): ${body}`)
    }
    return response
  }, [scopeParams, authHeaders])

  const getUrl = useCallback((fileOrKey: R2FileInfo | string): string => {
    const { key } = resolveFile(fileOrKey)
    return `/api/files/${key}?${scopeParams}`
  }, [scopeParams])

  return { upload, uploadBase64, deleteFile, downloadFile, readFile, list, getUrl, isUploading }
}
