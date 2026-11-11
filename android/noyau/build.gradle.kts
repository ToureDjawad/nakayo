plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

// Même JDK partout (local et CI) : Gradle le télécharge au besoin.
kotlin {
    jvmToolchain(17)
}

// Tests contre la vraie API (serveur Node démarré par le test, base PostgreSQL de test).
val testApiReelle by sourceSets.creating {
    compileClasspath += sourceSets.main.get().output
    runtimeClasspath += sourceSets.main.get().output
}
configurations[testApiReelle.implementationConfigurationName].extendsFrom(configurations.testImplementation.get())
configurations[testApiReelle.runtimeOnlyConfigurationName].extendsFrom(configurations.testRuntimeOnly.get())

dependencies {
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.core)

    testImplementation(kotlin("test-junit"))
    testImplementation(libs.junit4)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}

val apiReelle by tasks.registering(Test::class) {
    description = "Teste le client contre le vrai serveur Node (base de test sur le port 5433 par défaut)."
    group = "verification"
    testClassesDirs = testApiReelle.output.classesDirs
    classpath = testApiReelle.runtimeClasspath
    systemProperty("nakayo.racine", rootDir.parentFile.absolutePath)
    environment("DATABASE_URL_TEST", System.getenv("DATABASE_URL_TEST") ?: "postgres://nakayo:nakayo@localhost:5433/nakayo_test")
    shouldRunAfter(tasks.test)
    testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}

tasks.test {
    testLogging { events("failed"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
}
