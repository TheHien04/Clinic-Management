import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './pages/Login.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'

const root = document.getElementById('root')
if (!root) {
  console.error('Root element not found')
} else {
  createRoot(root).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  )
}

