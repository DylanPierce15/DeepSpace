/**
 * Example: Todo App built with DeepSpace SDK
 *
 * Demonstrates:
 * - RecordProvider for real-time storage
 * - useQuery for subscribing to records
 * - useMutations for CRUD operations
 * - Schema-driven RBAC
 */

import { useState } from 'react'
import { DeepSpaceAuthProvider } from '@deepspace/sdk/auth'
import { RecordProvider } from '@deepspace/sdk/storage'
// import { useQuery, useMutations } from '@deepspace/sdk/storage'
import { schemas } from './schemas'

function TodoList() {
  // const { records: todos, loading } = useQuery('todos', { orderBy: 'createdAt', orderDir: 'desc' })
  // const { create, put, remove } = useMutations('todos')
  const [newTitle, setNewTitle] = useState('')

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
        Todo App
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!newTitle.trim()) return
          // create({ Title: newTitle, Done: false })
          setNewTitle('')
        }}
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What needs to be done?"
          style={{
            flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
            border: '1px solid #333', background: '#111', color: '#eee',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem',
            background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer',
          }}
        >
          Add
        </button>
      </form>

      <p style={{ color: '#666', textAlign: 'center' }}>
        Connect to a RecordRoom to see real-time todos here.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <DeepSpaceAuthProvider>
      <RecordProvider schemas={schemas} allowAnonymous>
        <TodoList />
      </RecordProvider>
    </DeepSpaceAuthProvider>
  )
}
