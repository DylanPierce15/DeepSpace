/**
 * TestPage — exercises RBAC and CRUD against the RecordRoom.
 *
 * Shows current role, lets you try creating/reading/updating/deleting items,
 * and displays results. Used by Playwright tests to verify real data flow.
 */

import { useState } from 'react'
import { useQuery, useMutations, useUser } from '@deepspace/sdk/storage'
import { useAuth } from '@deepspace/sdk/auth'

interface ItemData {
  title: string
  description: string
  status: string
  createdBy: string
}

export function TestPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { records: items, isLoading } = useQuery<ItemData>('items')
  const { create, put, remove } = useMutations<ItemData>('items')

  const [lastResult, setLastResult] = useState<string>('')
  const [lastError, setLastError] = useState<string>('')

  const clearStatus = () => { setLastResult(''); setLastError('') }

  const tryCreate = async () => {
    clearStatus()
    try {
      const id = `test-${Date.now()}`
      create({ title: 'Test Item', description: 'Created by test', status: 'draft', createdBy: user?.id ?? 'anonymous' }, id)
      setLastResult(`created:${id}`)
    } catch (e: any) {
      setLastError(e.message ?? String(e))
    }
  }

  const tryCreatePublished = async () => {
    clearStatus()
    try {
      const id = `pub-${Date.now()}`
      create({ title: 'Public Item', description: 'Visible to anonymous', status: 'published', createdBy: user?.id ?? 'anonymous' }, id)
      setLastResult(`created:${id}`)
    } catch (e: any) {
      setLastError(e.message ?? String(e))
    }
  }

  const tryUpdate = async (recordId: string) => {
    clearStatus()
    try {
      put({ title: 'Updated Title', description: 'Updated by test' }, recordId)
      setLastResult(`updated:${recordId}`)
    } catch (e: any) {
      setLastError(e.message ?? String(e))
    }
  }

  const tryDelete = async (recordId: string) => {
    clearStatus()
    try {
      remove(recordId)
      setLastResult(`deleted:${recordId}`)
    } catch (e: any) {
      setLastError(e.message ?? String(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-8" data-testid="test-page">
      {/* Status */}
      <div className="mb-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">Connection Status</h2>
        <div className="space-y-1 text-sm">
          <div>Signed in: <span data-testid="test-signed-in">{String(isSignedIn)}</span></div>
          <div>User ID: <span data-testid="test-user-id">{user?.id ?? 'none'}</span></div>
          <div>Role: <span data-testid="test-user-role">{user?.role ?? 'anonymous'}</span></div>
          <div>User Name: <span data-testid="test-user-name">{user?.name ?? 'Anonymous'}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-8 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="test-create-item"
            onClick={tryCreate}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Create Draft Item
          </button>
          <button
            data-testid="test-create-published"
            onClick={tryCreatePublished}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Create Published Item
          </button>
        </div>

        {/* Result */}
        {lastResult && (
          <div data-testid="test-last-result" className="mt-3 rounded bg-success/20 px-3 py-2 text-sm text-success">
            {lastResult}
          </div>
        )}
        {lastError && (
          <div data-testid="test-last-error" className="mt-3 rounded bg-destructive/20 px-3 py-2 text-sm text-destructive">
            {lastError}
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Items {isLoading ? '(loading...)' : `(${items?.length ?? 0})`}
        </h2>
        <div data-testid="test-items-list" className="space-y-2">
          {items?.map((item) => (
            <div
              key={item.recordId}
              data-testid={`test-item-${item.recordId}`}
              className="flex items-center justify-between rounded border border-border px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium text-foreground">{item.data.title}</span>
                <span className="ml-2 text-muted-foreground">({item.data.status})</span>
                <span className="ml-2 text-muted-foreground text-xs">by {item.data.createdBy}</span>
              </div>
              <div className="flex gap-1">
                <button
                  data-testid={`test-update-${item.recordId}`}
                  onClick={() => tryUpdate(item.recordId)}
                  className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground hover:opacity-90"
                >
                  Update
                </button>
                <button
                  data-testid={`test-delete-${item.recordId}`}
                  onClick={() => tryDelete(item.recordId)}
                  className="rounded bg-destructive/20 px-2 py-1 text-xs text-destructive hover:opacity-90"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!isLoading && (!items || items.length === 0) && (
            <div data-testid="test-items-empty" className="text-sm text-muted-foreground">No items</div>
          )}
        </div>
      </div>
    </div>
  )
}
