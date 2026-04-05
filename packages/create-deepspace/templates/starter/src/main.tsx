import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppShell from './AppShell'
import './styles.css'

const root = document.getElementById('root')!

createRoot(root).render(
  <BrowserRouter>
    <AppShell />
  </BrowserRouter>,
)
