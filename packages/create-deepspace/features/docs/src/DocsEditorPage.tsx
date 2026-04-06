/**
 * DocsEditorPage — Collaborative document editor.
 *
 * Gets docId from URL params and renders the Yjs collaborative
 * editor connected to a per-document YjsRoom DO.
 *
 * Demonstrates character-by-character collaborative editing using
 * useYjsRoom + Y.Text directly. On each input event we compute
 * the minimal diff (what was inserted/deleted at what position)
 * and apply only those operations to Y.Text. This means concurrent
 * edits from multiple users merge correctly without overwriting
 * each other's changes.
 *
 * Installed at: src/pages/docs/[docId].tsx
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from 'deepspace'
import { useQuery } from 'deepspace'
import { useYjsRoom } from 'deepspace'
import * as Y from 'yjs'
import { Badge } from 'deepspace'

// ============================================================================
// Types
// ============================================================================

interface Document {
  title: string
  ownerId: string
}

// ============================================================================
// Character-level diff helper
// ============================================================================

/**
 * Compute the minimal insert/delete to transform `prev` into `next`,
 * given the cursor position after the edit. This avoids the O(n^2) full
 * diff by leveraging the fact that textarea edits happen at a single
 * contiguous range (the selection).
 */
function diffAtCursor(
  prev: string,
  next: string,
  cursorAfter: number,
): { pos: number; deleteCount: number; insert: string } {
  // Walk forward from the start to find the first difference
  let start = 0
  const minLen = Math.min(prev.length, next.length)
  while (start < minLen && prev[start] === next[start]) {
    start++
  }

  // Walk backward from the end to find the last difference
  let endPrev = prev.length
  let endNext = next.length
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--
    endNext--
  }

  return {
    pos: start,
    deleteCount: endPrev - start,
    insert: next.slice(start, endNext),
  }
}

// ============================================================================
// Collaborative Editor Component
// ============================================================================

interface CollabEditorProps {
  documentId: string
  title: string
}

function CollabEditor({ documentId, title }: CollabEditorProps) {
  // Each document gets its own YjsRoom DO -- direct WebSocket, no RecordScope needed
  const { doc, text, setText, synced, canWrite } = useYjsRoom(documentId, 'content')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const yTextRef = useRef<Y.Text | null>(null)
  const prevTextRef = useRef('')
  const isRemoteRef = useRef(false)

  // Grab the Y.Text instance once
  useEffect(() => {
    yTextRef.current = doc.getText('content')
  }, [doc])

  // Keep prevTextRef in sync with remote changes
  useEffect(() => {
    prevTextRef.current = text
  }, [text])

  // Handle local edits -- compute character-level diff and apply to Y.Text
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value
      const cursorAfter = e.target.selectionStart ?? next.length

      if (!yTextRef.current || !canWrite) {
        setText(next)
        return
      }

      const { pos, deleteCount, insert } = diffAtCursor(prevTextRef.current, next, cursorAfter)

      if (deleteCount > 0 || insert.length > 0) {
        isRemoteRef.current = true
        doc.transact(() => {
          const yText = yTextRef.current!
          if (deleteCount > 0) yText.delete(pos, deleteCount)
          if (insert.length > 0) yText.insert(pos, insert)
        })
        isRemoteRef.current = false
      }

      prevTextRef.current = next
      // Update local display without going through setText (which does full replacement)
      textareaRef.current!.value = next
    },
    [doc, canWrite, setText],
  )

  return (
    <div className="bg-card/60 rounded-xl border border-border overflow-hidden">
      {/* Editor header */}
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
              <span className="w-1.5 h-1.5 bg-success rounded-full" />
              Synced
            </span>
          ) : (
            <span className="text-xs text-warning flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-warning rounded-full animate-pulse" />
              Syncing...
            </span>
          )}
          {canWrite ? (
            <Badge variant="success">Edit</Badge>
          ) : (
            <Badge variant="secondary">View</Badge>
          )}
        </div>
      </div>

      {/* Textarea with character-level sync */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        disabled={!synced || !canWrite}
        placeholder={canWrite ? 'Start typing -- every keystroke syncs in real-time...' : 'View only'}
        className="w-full h-64 px-4 py-3 bg-transparent text-foreground placeholder-muted-foreground resize-none focus:outline-none disabled:opacity-50 font-mono text-sm leading-relaxed"
      />
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export default function DocsEditorPage() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const { user } = useUser()

  const { records: documents, status } = useQuery<Document>('documents', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  const selectedDoc = useMemo(
    () => docId ? documents.find((d) => d.recordId === docId) : null,
    [documents, docId],
  )

  const isLoading = status === 'loading'

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!selectedDoc) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Document not found</p>
        <button
          onClick={() => navigate('/docs')}
          className="text-primary hover:underline"
        >
          Back to documents
        </button>
      </div>
    )
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Back header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/docs')}
            className="p-2 hover:bg-muted/60 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-xl font-semibold text-foreground">{selectedDoc.data.title}</h2>
        </div>

        {/* Each document gets its own YjsRoom DO for collaborative editing */}
        <CollabEditor key={selectedDoc.recordId} documentId={selectedDoc.recordId} title={selectedDoc.data.title} />
      </div>
    </div>
  )
}
