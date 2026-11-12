plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Adresse de l'API. En debug, l'émulateur joint le serveur de la machine par 10.0.2.2.
// Pour un vrai téléphone en debug : ./gradlew installDebug -Pnakayo.api.debug=http://192.168.x.x:3000/
// La release exige une adresse HTTPS (-Pnakayo.api.release=https://...) : sans elle, l'app pointe vers
// un domaine réservé qui n'existe pas, pour qu'aucune build ne parte par erreur vers une mauvaise adresse.
val apiDebug = providers.gradleProperty("nakayo.api.debug").getOrElse("http://10.0.2.2:3000/")
val apiRelease = providers.gradleProperty("nakayo.api.release").getOrElse("https://api.nakayo.invalid/")
require(apiRelease.startsWith("https://")) { "nakayo.api.release doit commencer par https://" }

android {
    namespace = "bj.nakayo.testeur"
    compileSdk = 36

    defaultConfig {
        applicationId = "bj.nakayo.testeur"
        // Android 8.0 : couvre la quasi-totalité des téléphones en circulation au Bénin.
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_URL", "\"$apiDebug\"")
        }
        release {
            buildConfigField("String", "API_URL", "\"$apiRelease\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        warningsAsErrors = false
        abortOnError = true
        checkDependencies = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(project(":noyau"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.work.runtime)
    implementation(libs.kotlinx.coroutines.android)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)

    testImplementation(testFixtures(project(":noyau")))
    testImplementation(kotlin("test-junit"))
    testImplementation(libs.junit4)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(testFixtures(project(":noyau")))
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(kotlin("test-junit"))
    debugImplementation(libs.compose.ui.test.manifest)
}
