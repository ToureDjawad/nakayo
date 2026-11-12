package bj.nakayo.testeur.ui

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ProfilTesteur
import java.net.URLEncoder
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// Mises en forme partagées par les écrans (sans dépendance à Android, testées sur la JVM).

// 42 -> « 0:42 », comme sur la maquette.
fun minutes(secondes: Int): String = "${secondes / 60}:${(secondes % 60).toString().padStart(2, '0')}"

// +2290197000000 -> 01 97 00 00 00
fun afficher(telephone: String): String =
    telephone.removePrefix("+229").chunked(2).joinToString(" ").ifEmpty { telephone }

// « Afi Dossou » -> « Afi ». Le nom est saisi « Nom et prénom » ou « Prénom Nom » : on garde le premier mot.
fun prenom(nom: String): String = nom.trim().substringBefore(' ').ifEmpty { nom }

fun operateur(code: String?) = when (code) {
    "mtn" -> "MTN MoMo"
    "moov" -> "Moov Money"
    else -> code ?: ""
}

// « Afi Dossou » -> « AD ».
fun initiales(nom: String): String =
    nom.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }

// Date ISO du serveur -> « nov. 2026 », à l'heure du Bénin.
fun depuis(iso: String): String? = try {
    DateTimeFormatter.ofPattern("MMM yyyy", Locale.FRENCH).withZone(ZoneId.of("Africa/Porto-Novo")).format(Instant.parse(iso))
} catch (_: Exception) {
    null
}

fun descriptionAppareil(appareil: Appareil): String {
    val nom = listOfNotNull(appareil.fabricant?.replaceFirstChar(Char::uppercase), appareil.modele)
        .distinct()
        .joinToString(" ")
    return "$nom · Android ${appareil.versionAndroid}"
}

// Lien WhatsApp du support : « https://wa.me/ » suivi des chiffres du numéro international,
// avec un premier message déjà écrit (le testeur peut le modifier avant l'envoi).
fun lienWhatsapp(numero: String, message: String): String =
    "https://wa.me/" + numero.filter(Char::isDigit) + "?text=" + URLEncoder.encode(message, "UTF-8").replace("+", "%20")

// Message pré-rempli : le support retrouve le compte grâce au numéro de connexion.
fun messageSupport(profil: ProfilTesteur?): String =
    if (profil == null) {
        "Bonjour, je suis testeur Nakayo et j'ai une question."
    } else {
        "Bonjour, je suis ${profil.nom}, testeur Nakayo (numéro ${afficher(profil.telephone)}). J'ai une question :"
    }
