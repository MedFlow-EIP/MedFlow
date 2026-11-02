import 'package:firebase_core/firebase_core.dart';

// Configuration lue au build (équivalent de mobile/.env) :
//   flutter run --dart-define-from-file=env.json
// Voir env.example.json.

const String apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8080');

/// Formulaire « Donner mon avis » des testeurs (sans lui, l'avis part par email).
const String feedbackUrl = String.fromEnvironment('FEEDBACK_URL');

/// Connexion Google (Android seulement, comme l'app Expo).
const String googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');

/// Firebase : application iOS (ou Android) déclarée dans la console Firebase.
const FirebaseOptions firebaseOptions = FirebaseOptions(
  apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
  appId: String.fromEnvironment('FIREBASE_APP_ID'),
  messagingSenderId: String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID'),
  projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
  authDomain: String.fromEnvironment('FIREBASE_AUTH_DOMAIN'),
  storageBucket: String.fromEnvironment('FIREBASE_STORAGE_BUCKET'),
  iosBundleId: 'com.wavitooo.medflowlearning',
);
