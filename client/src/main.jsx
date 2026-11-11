import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices de la maquette : Bricolage Grotesque (titres), DM Sans (texte), Instrument Serif italique (accent).
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/dm-sans'
import '@fontsource/instrument-serif/400-italic.css'
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
