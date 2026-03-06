import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// import ErrorBoundary from './components/ErrorBoundary.jsx'

const root = document.getElementById('root')
if (!root) {
  console.error('❌ Root element not found!')
} else {
  console.log('✅ Root element found, rendering App...')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

