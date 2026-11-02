import 'dart:io';

import 'package:firebase_core/firebase_core.dart';

// Configuration lue au build (équivalent de mobile/.env) :
//   flutter run --dart-define-from-file=env.json
// Voir env.example.json.

const String apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8080');

/// Formulaire « Donner mon avis » des testeurs (sans lui, l'avis part par email).
const String feedbackUrl = String.fromEnvironment('FEEDBACK_URL');

/// Connexion Google (Android seulement, comme l'app Expo).
const String googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

/// Émulateur Android : comportement d'iOS (défilement, retour par glissement…)
/// pour tester l'app comme sur iPhone (scripts/android.sh).
const bool iosLook = bool.fromEnvironment('IOS_LOOK');

const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
const _appId = String.fromEnvironment('FIREBASE_APP_ID');
// L'app Android a son propre identifiant Firebase (google-services.json).
const _androidApiKey = String.fromEnvironment('FIREBASE_ANDROID_API_KEY');
const _androidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');

/// Firebase : application iOS (FIREBASE_*) ou Android (FIREBASE_ANDROID_*)
/// déclarée dans la console Firebase.
FirebaseOptions get firebaseOptions => FirebaseOptions(
      apiKey: Platform.isAndroid && _androidApiKey.isNotEmpty ? _androidApiKey : _apiKey,
      appId: Platform.isAndroid && _androidAppId.isNotEmpty ? _androidAppId : _appId,
      messagingSenderId: const String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
      projectId: const String.fromEnvironment('FIREBASE_PROJECT_ID'),
      authDomain: const String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
      storageBucket: const String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
      iosBundleId: 'com.wavitooo.medflowlearning',
    );
