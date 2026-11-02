import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../services/api.dart';

/// Journalise une étape d'un parcours clé (import, révision, chat…), pour voir
/// où les gens s'arrêtent. Jamais bloquant. Le nom doit figurer dans la liste
/// du serveur (ANALYTICS_EVENTS), sinon il est refusé.
Future<void> logEvent(String event, [String? detail]) async {
  if (FirebaseAuth.instance.currentUser == null) return;
  try {
    await Api.post('/api/analytics/event', detail == null ? {'event': event} : {'event': event, 'detail': detail});
  } catch (_) {
    // Silencieux : l'analytique ne doit jamais gêner l'utilisateur.
  }
}

/// Journalise qu'un écran a été vu (diagnostic de frictions). Appeler au montage.
Future<void> logScreenView(String screenName) async {
  if (FirebaseAuth.instance.currentUser == null) return;
  try {
    await Api.post('/api/analytics/screen-view', {'screen': screenName});
  } catch (e) {
    debugPrint('Erreur tracking screen_view ($screenName): $e');
  }
}
