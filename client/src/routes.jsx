import { Navigate } from 'react-router'
import ComptesEnAttente from './pages/admin/ComptesEnAttente.jsx'
import Accueil from './pages/Accueil.jsx'
import PageIntrouvable from './pages/PageIntrouvable.jsx'
import PageEnPreparation from './pages/PageEnPreparation.jsx'
import CompteEnAttente from './pages/inscription/CompteEnAttente.jsx'
import Inscription from './pages/inscription/Inscription.jsx'
import VerificationEmail from './pages/inscription/VerificationEmail.jsx'
import VerifiezVotreEmail from './pages/inscription/VerifiezVotreEmail.jsx'

export const routes = [
  { path: '/', element: <Accueil /> },
  { path: '/inscription', element: <Inscription /> },
  { path: '/verifiez-votre-email', element: <VerifiezVotreEmail /> },
  { path: '/verification-email', element: <VerificationEmail /> },
  { path: '/compte-en-attente', element: <CompteEnAttente /> },
  { path: '/admin', element: <Navigate to="/admin/comptes" replace /> },
  { path: '/admin/comptes', element: <ComptesEnAttente /> },
  { path: '/conditions-utilisation', element: <PageEnPreparation titre="Conditions d’utilisation" /> },
  { path: '/confidentialite', element: <PageEnPreparation titre="Politique de confidentialité" /> },
  { path: '*', element: <PageIntrouvable /> },
]
