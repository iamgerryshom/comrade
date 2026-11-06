import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initServices } from './services'
import { applyTheme } from './hooks/useTheme'
import { registerServiceWorker, notificationPermission } from './lib/push'

applyTheme()

const root = createRoot(document.getElementById('root'))

// Render right away: public pages (welcome, login) don't need data. Signed-in screens wait for
// the data source (mock now, Firebase in Phase 9) via servicesReady().
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Public pages (welcome, login) don't need the data source: start it on first interaction or
// when the browser is idle, so the landing page paints fast on slow phones. Everything else
// (and any existing session) starts it immediately.
const isPublic = ['/', '/login'].includes(location.pathname) && !sessionStorage.getItem('comrade.session.uid')
const boot = new Promise((resolve) => {
  if (!isPublic) return resolve()
  const go = () => resolve()
  ;['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, go, { once: true, passive: true }))
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 6000 })
  else setTimeout(go, 3000)
})

boot
  .then(() => initServices())
  .then(() => {
    if (notificationPermission() === 'granted') void registerServiceWorker()
  })
  .catch((err) => {
    console.error(err)
    root.render(
      <div role="alert" style={{ fontFamily: 'system-ui', maxWidth: '32rem', margin: '4rem auto', padding: '1.5rem', border: '1px solid #ddd', borderRadius: 12 }}>
        <h1 style={{ fontSize: '1.25rem' }}>Comrade could not start</h1>
        <p style={{ color: '#555' }}>{String(err?.message ?? err)}</p>
      </div>,
    )
  })
