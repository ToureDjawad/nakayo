import { Navigate } from 'react-router'
import AppsAVerifier from './pages/admin/AppsAVerifier.jsx'
import Campagnes from './pages/admin/Campagnes.jsx'
import AlertesFraude from './pages/admin/AlertesFraude.jsx'
import JournalAdmin from './pages/admin/JournalAdmin.jsx'
import Garanties from './pages/admin/Garanties.jsx'
import FicheTesteur from './pages/admin/FicheTesteur.jsx'
import DevisAfrique from './pages/admin/DevisAfrique.jsx'
import TableauDeBord from './pages/admin/TableauDeBord.jsx'
import ComptesEnAttente from './pages/admin/ComptesEnAttente.jsx'
import ContactSupport from './pages/admin/ContactSupport.jsx'
import MessagesSupport from './pages/admin/MessagesSupport.jsx'
import EcrireAuSupport from './pages/support/EcrireAuSupport.jsx'
import FormulaireApp from './pages/apps/FormulaireApp.jsx'
import PreparationLancement from './pages/apps/PreparationLancement.jsx'
import SuiviCampagne from './pages/apps/SuiviCampagne.jsx'
import BugsSignales from './pages/apps/BugsSignales.jsx'
import DemandeDevis from './pages/apps/DemandeDevis.jsx'
import MesPaiements from './pages/paiements/MesPaiements.jsx'
import PayerApp, { MonteeEnGamme } from './pages/paiements/PayerApp.jsx'
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
  { path: '/mon-compte/apps/:id/campagne', element: <SuiviCampagne /> },
  { path: '/mon-compte/apps/:id/bugs', element: <BugsSignales /> },
  { path: '/mon-compte/apps/:id/devis', element: <DemandeDevis /> },
  { path: '/mon-compte/apps/:id/paiement', element: <PayerApp /> },
  { path: '/mon-compte/apps/:id/montee-en-gamme', element: <MonteeEnGamme /> },
  { path: '/mon-compte/paiements', element: <MesPaiements /> },
  { path: '/mon-compte/paiements/:reference', element: <RetourPaiement /> },
  { path: '/paiement/simulation/:reference', element: <SimulationPaiement /> },
  { path: '/connexion', element: <Connexion /> },
  { path: '/mot-de-passe-oublie', element: <MotDePasseOublie /> },
  { path: '/reinitialiser-mot-de-passe', element: <ReinitialiserMotDePasse /> },
  { path: '/admin', element: <Navigate to="/admin/tableau-de-bord" replace /> },
  { path: '/admin/tableau-de-bord', element: <TableauDeBord /> },
  { path: '/admin/comptes', element: <ComptesEnAttente /> },
  { path: '/admin/apps', element: <AppsAVerifier /> },
  { path: '/admin/campagnes', element: <Campagnes /> },
  { path: '/admin/alertes', element: <AlertesFraude /> },
  { path: '/admin/journal', element: <JournalAdmin /> },
  { path: '/admin/garanties', element: <Garanties /> },
  { path: '/admin/testeurs/:id', element: <FicheTesteur /> },
  { path: '/admin/devis', element: <DevisAfrique /> },
  { path: '/admin/messages', element: <MessagesSupport /> },
  { path: '/admin/support', element: <ContactSupport /> },
  { path: '/conditions-utilisation', element: <PageEnPreparation titre="Conditions d’utilisation" /> },
  { path: '/confidentialite', element: <PageEnPreparation titre="Politique de confidentialité" /> },
  { path: '/mentions-legales', element: <PageEnPreparation titre="Mentions légales" /> },
  { path: '*', element: <PageIntrouvable /> },
]
