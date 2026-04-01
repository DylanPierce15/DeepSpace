import { DeepSpaceAuthProvider } from '@deepspace/sdk/auth'
import { RecordProvider } from '@deepspace/sdk/storage'
import { Routes, Route, Navigate } from 'react-router-dom'
import { schemas } from './schemas'
import { HomePage } from './pages/HomePage'

export function App() {
  return (
    <DeepSpaceAuthProvider>
      <RecordProvider schemas={schemas}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <meta name="generator" content="deepspace-sdk/0.1.0" />
      </RecordProvider>
    </DeepSpaceAuthProvider>
  )
}
