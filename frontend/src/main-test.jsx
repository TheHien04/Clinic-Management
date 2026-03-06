import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Simple test component
function TestApp() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      color: 'white',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: '#16213e',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>✅ React Works!</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8 }}>
          If you see this, React is rendering correctly.
        </p>
        <p style={{ marginTop: '20px', fontSize: '0.9rem', opacity: 0.6 }}>
          Port: 5173 | Time: {new Date().toLocaleTimeString()}
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
