import { PageCompte } from '../components/MiseEnPage.jsx'

// Emplacement des textes juridiques (US-04), en attendant leur rédaction.
export default function PageEnPreparation({ titre }) {
  return (
    <PageCompte titre={titre}>
      <p className="text-texte">Ce document est en cours de rédaction et sera publié ici avant l’ouverture du service.</p>
    </PageCompte>
  )
}
