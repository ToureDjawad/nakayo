import { Navigate } from 'react-router'
import AppsAVerifier from './pages/admin/AppsAVerifier.jsx'
import ComptesEnAttente from './pages/admin/ComptesEnAttente.jsx'
import ContactSupport from './pages/admin/ContactSupport.jsx'
import MessagesSupport from './pages/admin/MessagesSupport.jsx'
import EcrireAuSupport from './pages/support/EcrireAuSupport.jsx'
import FormulaireApp from './pages/apps/FormulaireApp.jsx'
import PreparationLancement from './pages/apps/PreparationLancement.jsx'
import MesPaiements from './pages/paiements/MesPaiements.jsx'
import PayerApp from './pages/paiements/PayerApp.jsx'
import RetourPaiement from './pages/paiements/RetourPaiement.jsx'
import SimulationPaiement from './pages/paiements/SimulationPaiement.jsx'
import Connexion from './pages/connexion/Connexion.jsx'
import MotDePasseOublie from './pages/connexion/MotDePasseOublie.jsx'
import ReinitialiserMotDePasse from './pages/connexion/ReinitialiserMotDePasse.jsx'
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
  { path: '/mon-compte', element: <CompteEnAttente /> },
  { path: '/mon-compte/support', element: <EcrireAuSupport /> },
  { path: '/mon-compte/apps/nouvelle', element: <FormulaireApp /> },
  { path: '/mon-compte/apps/:id/modifier', element: <FormulaireApp /> },
  { path: '/mon-compte/apps/:id/preparation', element: <PreparationLancement /> },
  { path: '/mon-compte/apps/:id/paiement', element: <PayerApp /> },
  { path: '/mon-compte/paiements', element: <MesPaiements /> },
  { path: '/mon-compte/paiements/:reference', element: <RetourPaiement /> },
  { path: '/paiement/simulation/:reference', element: <SimulationPaiement /> },
  { path: '/connexion', element: <Connexion /> },
  { path: '/mot-de-passe-oublie', element: <MotDePasseOublie /> },
  { path: '/reinitialiser-mot-de-passe', element: <ReinitialiserMotDePasse /> },
  { path: '/admin', element: <Navigate to="/admin/comptes" replace /> },
  { path: '/admin/comptes', element: <ComptesEnAttente /> },
  { path: '/admin/apps', element: <AppsAVerifier /> },
  { path: '/admin/messages', element: <MessagesSupport /> },
  { path: '/admin/support', element: <ContactSupport /> },
  { path: '/conditions-utilisation', element: <PageEnPreparation titre="Conditions d’utilisation" /> },
  { path: '/confidentialite', element: <PageEnPreparation titre="Politique de confidentialité" /> },
  { path: '/mentions-legales', element: <PageEnPreparation titre="Mentions légales" /> },
  { path: '*', element: <PageIntrouvable /> },
]
