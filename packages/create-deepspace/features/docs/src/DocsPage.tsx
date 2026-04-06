/**
 * Docs Page
 *
 * Demonstrates character-by-character collaborative editing using
 * useYjsRoom + Y.Text directly. On each input event we compute
 * the minimal diff (what was inserted/deleted at what position)
 * and apply only those operations to Y.Text. This means concurrent
 * edits from multiple users merge correctly without overwriting
 * each other's changes.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from 'deepspace'
import { useQuery } from 'deepspace'
import { useMutations } from 'deepspace'
import { useYjsRoom } from 'deepspace'
import * as Y from 'yjs'
import { Button, Modal, EmptyState, Badge } from 'deepspace'
import { ROLES, type Role } from 'deepspace'

// ============================================================================
// Types
// ============================================================================

interface Document {
  title: string
  ownerId: string
}

interface DocsPageProps {
  className?: string
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
// Create Document Modal
// ============================================================================

interface CreateDocModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (title: string) => void
}

function CreateDocModal({ isOpen, onClose, onCreate }: CreateDocModalProps) {
  const [title, setTitle] = useState('')

  const handleSubmit = () => {
    if (title.trim()) {
      onCreate(title.trim())
      setTitle('')
      onClose()
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} size="sm">
      <Modal.Header onClose={onClose}>
        <Modal.Title>New Document</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Meeting Notes"
            className="w-full px-3 py-2 bg-transparent border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-ring"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!title.trim()}>Create</Button>
      </Modal.Footer>
    </Modal>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export function DocsPage({ className }: DocsPageProps) {
  const { user } = useUser()
  const { '*': subpath } = useParams()
  const navigate = useNavigate()
  const urlDocId = subpath || null
  const userRole = (user?.role ?? ROLES.VIEWER) as Role
  const canCreate = userRole === ROLES.MEMBER || userRole === ROLES.ADMIN

  const [showCreateModal, setShowCreateModal] = useState(false)

  const { records: documents, status } = useQuery<Document>('documents', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { create, remove } = useMutations<Document>('documents')

  const handleCreate = async (title: string) => {
    await create({ title, ownerId: user!.id })
  }

  const handleDelete = async (docId: string) => {
    if (confirm('Delete this document?')) {
      if (urlDocId === docId) navigate('/docs')
      await remove(docId)
    }
  }

  const selectedDoc = useMemo(
    () => urlDocId ? documents.find((d) => d.recordId === urlDocId) : null,
    [documents, urlDocId],
  )

  const isLoading = status === 'loading'

  // If a document is selected, show the editor in a per-document DO
  if (urlDocId && selectedDoc) {
    return (
      <div className={`h-full bg-background overflow-y-auto ${className ?? ''}`}>
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

  return (
    <div className={`h-full bg-background overflow-y-auto ${className ?? ''}`}>
      {/* Header */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Documents</h1>
              <p className="text-muted-foreground mt-1">Real-time collaborative editing</p>
            </div>
            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Document
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description={canCreate ? 'Create your first document to start editing' : 'No documents have been created yet'}
            icon={
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {documents.map((doc) => {
              const isOwner = doc.data.ownerId === user?.id
              return (
                <div
                  key={doc.recordId}
                  className="group p-4 bg-card/60 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/docs/${doc.recordId}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="font-medium text-foreground truncate">{doc.data.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                        {isOwner && ' · You'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(doc.recordId)
                          }}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <svg className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CreateDocModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
