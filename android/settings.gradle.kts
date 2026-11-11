pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

// Télécharge le JDK 17 demandé par les modules s'il n'est pas installé (dans ~/.gradle/jdks).
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "nakayo-android"

// Logique sans Android (client de l'API, règles de validation) : se teste sur n'importe quelle machine Java.
include(":noyau")

// L'app a besoin du SDK Android. Sans SDK (ni ANDROID_HOME, ni local.properties), seul le noyau est construit.
val sdkDisponible = System.getenv("ANDROID_HOME") != null ||
    System.getenv("ANDROID_SDK_ROOT") != null ||
    file("local.properties").takeIf { it.exists() }?.readText()?.contains("sdk.dir") == true
if (sdkDisponible) {
    include(":app")
} else {
    logger.lifecycle("SDK Android absent : seul le module :noyau est construit (voir android/README.md).")
}
