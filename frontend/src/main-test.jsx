import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { formatTimeShort } from './utils/i18nFormat'

// Simple test component
export function TestApp() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #d4effa 0%, #eef8fc 38%, #f8fcfe 100%)',
      color: 'white',
      fontFamily: 'IBM Plex Sans, Manrope, sans-serif'
    }}>
      <div style={{
        background: 'linear-gradient(160deg, var(--brand-700), var(--brand-500))',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>✅ React Works!</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8 }}>
          If you see this, React is rendering correctly.
        </p>
        <p style={{ marginTop: '20px', fontSize: '0.9rem', opacity: 0.6 }}>
          Port: 5173 | Time: {formatTimeShort(new Date())}
        </p>
      </div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <TestApp />
    </StrictMode>
  )
} else {
  console.error('Root element not found!')
}
