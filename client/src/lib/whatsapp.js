// Lien WhatsApp vers le support, avec un premier message déjà écrit (modifiable avant l'envoi).
export function lienWhatsapp(numero, message) {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

// Message pré-rempli : le support retrouve le compte grâce au nom et à l'email.
export function messageSupport(utilisateur) {
  return `Bonjour, je suis ${utilisateur.nom}, développeur sur Nakayo (${utilisateur.email}). J’ai une question :`
}
