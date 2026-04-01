import { Routes, Route } from 'react-router-dom'
import { AppsPage } from './pages/AppsPage'
import { BillingPage } from './pages/BillingPage'
import { SettingsPage } from './pages/SettingsPage'
import { Sidebar } from './components/Sidebar'

export function App() {
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<AppsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
