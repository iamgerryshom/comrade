import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initServices } from './services'
import { applyTheme } from './hooks/useTheme'
import { registerServiceWorker, notificationPermission } from './lib/push'

applyTheme()

// Pick the data source (mock now, Firebase in Phase 9) before rendering
initServices()
  .then(() => {
    if (notificationPermission() === 'granted') void registerServiceWorker()
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err) => {
    console.error(err)
    document.getElementById('root').innerHTML =
      '<div style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:1.5rem;border:1px solid #ddd;border-radius:12px">' +
      '<h1 style="font-size:1.25rem">Comrade could not start</h1><p style="color:#555">' +
      String(err && err.message ? err.message : err) +
      '</p></div>'
  })
