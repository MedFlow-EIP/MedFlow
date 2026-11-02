import 'package:firebase_auth/firebase_auth.dart';

// Notifications push (demandes d'ami, défis, cours prêt).
//
// Le backend envoie les push via le service Expo (backend/services/push.py),
// qui n'accepte que des jetons Expo : une app Flutter ne peut pas en obtenir.
// En attendant l'envoi par FCM côté serveur, l'app garde ses notifications
// locales (vérification à l'ouverture et toutes les 2 minutes), exactement
// comme l'app Expo quand FCM n'est pas configuré.

String? _currentToken;

/// Vrai quand le serveur peut joindre ce téléphone : les notifications locales doublonneraient.
bool isPushActive() => _currentToken != null;

/// Enregistre le jeton de l'appareil auprès du serveur (inactif pour l'instant).
Future<String?> registerForPushNotifications(User user) async => null;

/// À la déconnexion : ce téléphone ne doit plus recevoir les notifications de ce compte.
Future<void> unregisterPushNotifications(User user) async {
  _currentToken = null;
}

/// Écran à ouvrir quand on touche une notification (données envoyées avec elle).
({String screen, Map<String, dynamic>? params})? notificationTarget(Map<String, dynamic>? data) {
  if (data == null) return null;
  if (data['courseId'] is String) return (screen: 'CourseDetail', params: {'courseId': data['courseId']});
  if (data['screen'] == 'Challenge' && data['challengeId'] is num) {
    return (screen: 'Challenge', params: {'challengeId': (data['challengeId'] as num).toInt()});
  }
  if (data['screen'] == 'ClinicalCase' && data['caseId'] is num) {
    return (screen: 'ClinicalCase', params: {'caseId': (data['caseId'] as num).toInt()});
  }
  if (data['screen'] == 'Friends') return (screen: 'Friends', params: null);
  return null;
}
