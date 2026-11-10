import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './index.css'
import App from './App.jsx'

// API simulée : active seulement avec `npm run dev:mocks` (mode Vite « mocks »).
// Pour la retirer : supprimer ce bloc et le dossier src/mocks/.
if (import.meta.env.MODE === 'mocks') {
  const { installerMocks } = await import('./mocks/index.js')
  installerMocks()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
